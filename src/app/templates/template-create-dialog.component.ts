import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { read, utils, writeFileXLSX } from 'xlsx';

import {
  TemplateService,
  TemplateCreatePayload,
  TemplateWithColumns,
  TemplateColumnPayload,
  TemplateColumnRulePayload
} from './template.service';
import { ValidationRulesService } from '../validation-rules/validation-rules.service';

interface RuleOption {
  id: string;
  label: string;
  type: string | null;
  headerOptions: string[];
}

interface ColumnRuleDraft {
  id: string;
  header: string | null;
}

interface TemplateColumnDraft {
  name: string;
  description: string;
  rules: ColumnRuleDraft[];
  ruleDraft: string | null;
}

@Component({
  selector: 'app-template-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './template-create-dialog.component.html',
  styleUrl: './template-create-dialog.component.scss'
})
export class TemplateCreateDialogComponent {
  protected step: 1 | 2 = 1;

  protected generalModel = {
    name: '',
    tableName: '',
    description: ''
  };

  protected generalSubmitting = false;
  protected generalError: string | null = null;

  protected columns: TemplateColumnDraft[] = [];
  protected columnsSubmitting = false;
  protected columnsError: string | null = null;

  protected createdTemplate: TemplateWithColumns | null = null;

  protected ruleOptions: RuleOption[] = [];
  protected rulesLoading = false;
  protected rulesError: string | null = null;
  private rulesLoaded = false;
  private ruleOptionLookup = new Map<string, RuleOption>();

  constructor(
    private readonly dialogRef: MatDialogRef<TemplateCreateDialogComponent, boolean>,
    private readonly templateService: TemplateService,
    private readonly validationRulesService: ValidationRulesService
  ) {}

  protected close(): void {
    this.dialogRef.close();
  }

  protected async submitGeneral(form: NgForm): Promise<void> {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    const payload: TemplateCreatePayload = {
      name: this.generalModel.name.trim(),
      table_name: this.generalModel.tableName.trim(),
      description: this.generalModel.description.trim() || undefined
    };

    this.generalSubmitting = true;
    this.generalError = null;

    try {
      const template = await this.templateService.createTemplate(payload);
      this.createdTemplate = template;
      this.step = 2;
      this.ensureInitialColumnRow();
      await this.ensureRulesLoaded();
    } catch (error) {
      this.generalError = this.extractErrorMessage(error);
    } finally {
      this.generalSubmitting = false;
    }
  }

  protected addColumnRow(): void {
    this.columns = [...this.columns, this.createEmptyColumn()];
  }

  protected removeColumnRow(index: number): void {
    const updated = this.columns.filter((_, i) => i !== index);
    this.columns = updated.length > 0 ? updated : [];
    this.ensureInitialColumnRow();
  }

  protected trackByColumnIndex(index: number): number {
    return index;
  }

  protected getRuleLabel(ruleId: string): string {
    const option = this.getRuleOption(ruleId);
    return option?.label ?? 'Regla sin nombre';
  }

  protected getRuleType(ruleId: string): string | null {
    const option = this.getRuleOption(ruleId);
    return option?.type ?? null;
  }

  protected trackByRuleIndex(index: number): number {
    return index;
  }

  protected requiresRuleHeader(ruleId: string): boolean {
    const option = this.getRuleOption(ruleId);
    if (!option) {
      return false;
    }

    const type = option.type?.toLowerCase() ?? '';
    return option.headerOptions.length > 0 && (type === 'lista compleja' || type === 'dependencia');
  }

  protected headerOptionsForRule(ruleId: string): string[] {
    const option = this.getRuleOption(ruleId);
    return option?.headerOptions ?? [];
  }

  protected isRuleSelected(column: TemplateColumnDraft, ruleId: string): boolean {
    return column.rules.some((rule) => rule.id === ruleId);
  }

  protected addRuleToColumn(columnIndex: number): void {
    const column = this.columns[columnIndex];
    if (!column) {
      return;
    }

    const draftRuleId = column.ruleDraft;
    if (!draftRuleId) {
      return;
    }

    if (this.isRuleSelected(column, draftRuleId)) {
      const updated: TemplateColumnDraft = { ...column, ruleDraft: null };
      this.columns = this.columns.map((col, index) => (index === columnIndex ? updated : col));
      return;
    }

    const option = this.getRuleOption(draftRuleId);
    const requiresHeader = option ? this.requiresRuleHeader(option.id) : false;
    const defaultHeader = requiresHeader ? this.pickDefaultHeader(option) : null;

    const updatedColumn: TemplateColumnDraft = {
      ...column,
      ruleDraft: null,
      rules: [...column.rules, { id: draftRuleId, header: defaultHeader }]
    };

    this.columns = this.columns.map((col, index) => (index === columnIndex ? updatedColumn : col));
  }

  protected removeRuleFromColumn(columnIndex: number, ruleIndex: number): void {
    const column = this.columns[columnIndex];
    if (!column) {
      return;
    }

    const updatedColumn: TemplateColumnDraft = {
      ...column,
      rules: column.rules.filter((_, index) => index !== ruleIndex)
    };

    this.columns = this.columns.map((col, index) => (index === columnIndex ? updatedColumn : col));
  }

  protected async submitColumns(): Promise<void> {
    if (!this.createdTemplate) {
      this.columnsError = 'No se encontró la plantilla creada.';
      return;
    }

    this.columnsError = null;

    const sanitized = this.columns.map((column) => ({
      name: column.name.trim(),
      description: column.description.trim(),
      rules: column.rules.map((rule) => ({
        id: rule.id,
        header: rule.header ? rule.header.trim() : null
      }))
    }));

    if (sanitized.length === 0 || sanitized.every((column) => column.name.length === 0)) {
      this.columnsError = 'Agrega al menos una columna con un nombre válido.';
      return;
    }

    if (sanitized.some((column) => column.name.length === 0)) {
      this.columnsError = 'Todas las columnas deben tener un nombre.';
      return;
    }

    for (const column of sanitized) {
      const seen = new Set<string>();
      for (const rule of column.rules) {
        if (seen.has(rule.id)) {
          this.columnsError = `La columna "${column.name}" tiene reglas duplicadas.`;
          return;
        }
        seen.add(rule.id);

        if (this.requiresRuleHeader(rule.id) && !rule.header) {
          const ruleLabel = this.getRuleLabel(rule.id);
          this.columnsError = `Selecciona un header para la regla "${ruleLabel}" en la columna "${column.name}".`;
          return;
        }
      }
    }

    this.columnsSubmitting = true;

    try {
      for (const column of sanitized) {
        const payload = this.buildColumnPayload(column);
        await this.templateService.createColumn(this.createdTemplate.id, payload);
      }
      this.dialogRef.close(true);
    } catch (error) {
      this.columnsError = this.extractErrorMessage(error);
    } finally {
      this.columnsSubmitting = false;
    }
  }

  protected async importColumnsFromExcel(event: Event): Promise<void> {
    const file = this.extractFileFromEvent(event);
    if (!file) {
      return;
    }

    try {
      const rows = await this.readExcelRows(file);
      const imported = this.buildColumnsFromRows(rows);

      if (imported.length === 0) {
        throw new Error('El archivo no contiene registros válidos en las columnas requeridas.');
      }

      const next = this.columns.map((column) => ({
        name: column.name.trim(),
        description: column.description.trim(),
        rules: column.rules.map((rule) => ({ ...rule })),
        ruleDraft: column.ruleDraft
      }));

      const existing = new Map<string, TemplateColumnDraft>();
      next.forEach((column) => {
        if (column.name) {
          existing.set(column.name.toLowerCase(), column);
        }
      });

      imported.forEach((item) => {
        const lower = item.name.toLowerCase();
        const found = existing.get(lower);
        if (found) {
          if (!found.description && item.description) {
            found.description = item.description;
          }
        } else {
          const draft = this.createEmptyColumn();
          draft.name = item.name;
          draft.description = item.description;
          next.push(draft);
          existing.set(lower, draft);
        }
      });

      if (next.length === 0) {
        next.push(this.createEmptyColumn());
      }

      this.columns = next.map((column) => ({
        name: column.name,
        description: column.description,
        rules: column.rules.map((rule) => ({ ...rule })),
        ruleDraft: column.ruleDraft
      }));
      this.columnsError = null;
    } catch (error) {
      this.columnsError = this.extractErrorMessage(error);
    } finally {
      this.resetFileInput(event);
    }
  }

  protected downloadTemplate(): void {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([[this.columnHeaderLabel, this.columnDescriptionLabel]]);
    utils.book_append_sheet(workbook, sheet, 'Plantilla');
    writeFileXLSX(workbook, 'plantilla-columnas.xlsx');
  }

  protected get columnHeaderLabel(): string {
    return 'Nombre';
  }

  protected get columnDescriptionLabel(): string {
    return 'Descripción';
  }

  private async ensureRulesLoaded(): Promise<void> {
    if (this.rulesLoaded) {
      return;
    }

    this.rulesLoading = true;
    this.rulesError = null;

    try {
      const data = await this.validationRulesService.fetchRules();
      this.ruleOptions = this.parseRuleOptions(data);
      this.rebuildRuleLookup();
      this.rulesLoaded = true;
    } catch (error) {
      this.rulesError = this.extractErrorMessage(error);
      this.ruleOptions = [];
      this.ruleOptionLookup.clear();
    } finally {
      this.rulesLoading = false;
    }
  }

  private ensureInitialColumnRow(): void {
    if (this.columns.length === 0) {
      this.columns = [this.createEmptyColumn()];
    }
  }

  private createEmptyColumn(): TemplateColumnDraft {
    return {
      name: '',
      description: '',
      rules: [],
      ruleDraft: null
    };
  }

  private pickDefaultHeader(option: RuleOption | null): string | null {
    if (!option || option.headerOptions.length === 0) {
      return null;
    }

    return option.headerOptions[0] ?? null;
  }

  private getRuleOption(ruleId: string): RuleOption | null {
    return this.ruleOptionLookup.get(ruleId) ?? null;
  }

  private rebuildRuleLookup(): void {
    this.ruleOptionLookup.clear();
    this.ruleOptions.forEach((option) => {
      this.ruleOptionLookup.set(option.id, option);
    });
  }

  private buildColumnPayload(column: {
    name: string;
    description: string;
    rules: Array<{ id: string; header: string | null }>;
  }): TemplateColumnPayload {
    const rules: TemplateColumnRulePayload[] = column.rules.map((rule) => {
      const option = this.getRuleOption(rule.id);
      const normalizedId = this.normalizeRuleId(rule.id) ?? rule.id;
      const payload: TemplateColumnRulePayload = { id: normalizedId };

      const requiresHeader = option ? this.requiresRuleHeader(option.id) : false;
      if (requiresHeader && rule.header) {
        payload['header rule'] = [rule.header];
      } else if (rule.header) {
        payload['header rule'] = [rule.header];
      }

      return payload;
    });

    const result: TemplateColumnPayload = {
      name: column.name,
      rules
    };

    if (column.description.length > 0) {
      result.description = column.description;
    }

    return result;
  }

  private normalizeRuleId(ruleId: string | null): number | string | null {
    if (ruleId === null) {
      return null;
    }

    const numeric = Number(ruleId);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    return ruleId;
  }

  private extractFileFromEvent(event: Event): File | null {
    const input = event.target as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) {
      return null;
    }

    return input.files[0] ?? null;
  }

  private resetFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  private async readExcelRows(file: File): Promise<string[][]> {
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return [];
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false
    });

    return (rawRows as unknown[]).map((row) => {
      if (!Array.isArray(row)) {
        return [this.stringifyCell(row)];
      }

      return row.map((cell) => this.stringifyCell(cell));
    });
  }

  private buildColumnsFromRows(rows: string[][]): Array<{ name: string; description: string }> {
    if (rows.length === 0) {
      return [];
    }

    const headers = (rows[0] ?? []).map((cell) => cell.trim());
    const lowerHeaders = headers.map((header) => header.toLowerCase());

    let nameIndex = lowerHeaders.indexOf(this.columnHeaderLabel.toLowerCase());
    if (nameIndex < 0) {
      nameIndex = 0;
    }

    let descriptionIndex = lowerHeaders.indexOf(this.columnDescriptionLabel.toLowerCase());
    if (descriptionIndex < 0) {
      descriptionIndex = headers.findIndex((header) => header.toLowerCase() === 'descripcion');
    }

    const seen = new Set<string>();
    const result: Array<{ name: string; description: string }> = [];

    rows.slice(1).forEach((row) => {
      const name = (row[nameIndex] ?? '').trim();
      if (!name) {
        return;
      }

      const lower = name.toLowerCase();
      if (seen.has(lower)) {
        return;
      }

      const description = descriptionIndex >= 0 ? (row[descriptionIndex] ?? '').trim() : '';
      seen.add(lower);
      result.push({ name, description });
    });

    return result;
  }

  private parseRuleOptions(source: unknown): RuleOption[] {
    const collection = this.extractRuleCollection(source);
    if (!collection) {
      return [];
    }

    return collection
      .map((entry) => this.buildRuleOption(entry))
      .filter((option): option is RuleOption => option !== null);
  }

  private extractRuleCollection(value: unknown): unknown[] | null {
    if (Array.isArray(value)) {
      return value;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const keys = ['items', 'rules', 'data', 'results'];
      for (const key of keys) {
        const maybe = record[key];
        if (Array.isArray(maybe)) {
          return maybe;
        }
      }
    }

    return null;
  }

  private buildRuleOption(entry: unknown): RuleOption | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const id = this.toId(record['id'] ?? record['rule_id'] ?? record['uuid']);
    if (!id) {
      return null;
    }

    const name = this.extractRuleName(record);
    if (!name) {
      return null;
    }

    const type = this.extractRuleType(record);
    const headerOptions = this.extractRuleHeaders(record);

    return {
      id,
      label: name,
      type,
      headerOptions
    };
  }

  private extractRulePayload(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private toId(value: unknown): string | null {
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 ? text : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return null;
  }

  private sanitizeString(value: unknown): string | null {
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 ? text : null;
    }

    return null;
  }

  private extractRuleName(record: Record<string, unknown>): string | null {
    const directName =
      this.sanitizeString(record['name']) ||
      this.sanitizeString(record['Nombre de la regla']) ||
      this.sanitizeString(record['rule_name']) ||
      this.sanitizeString(record['title']);

    if (directName) {
      return directName;
    }

    const payload = this.extractRulePayload(record['rule'] ?? record['payload']);
    if (payload) {
      return (
        this.sanitizeString(payload['Nombre de la regla']) ||
        this.sanitizeString(payload['name']) ||
        this.sanitizeString(payload['rule_name']) ||
        null
      );
    }

    return null;
  }

  private extractRuleType(record: Record<string, unknown>): string | null {
    const directType =
      this.sanitizeString(record['type']) ||
      this.sanitizeString(record['Tipo de dato']) ||
      this.sanitizeString(record['data_type']) ||
      this.sanitizeString(record['rule_type']);

    if (directType) {
      return directType;
    }

    const payload = this.extractRulePayload(record['rule'] ?? record['payload']);
    if (payload) {
      return (
        this.sanitizeString(payload['Tipo de dato']) ||
        this.sanitizeString(payload['type']) ||
        this.sanitizeString(payload['data_type']) ||
        null
      );
    }

    return null;
  }

  private extractRuleHeaders(record: Record<string, unknown>): string[] {
    const headers: string[] = [];
    const keys = [
      'Header rule',
      'header rule',
      'Header_rule',
      'header_rule',
      'headerRule',
      'Header'
    ];

    keys.forEach((key) => {
      const value = record[key];
      this.appendHeaderValues(headers, value);
    });

    const payload = this.extractRulePayload(record['rule'] ?? record['payload']);
    if (payload) {
      keys.forEach((key) => {
        const value = payload[key];
        this.appendHeaderValues(headers, value);
      });
    }

    return headers;
  }

  private appendHeaderValues(target: string[], value: unknown): void {
    const values = this.toStringArray(value);
    values.forEach((item) => {
      if (!target.includes(item)) {
        target.push(item);
      }
    });
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeString(item))
        .filter((item): item is string => item !== null);
    }

    const text = this.sanitizeString(value);
    if (text) {
      return [text];
    }

    return [];
  }

  private stringifyCell(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value.toString() : '';
    }

    if (value === null || value === undefined) {
      return '';
    }

    return String(value);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const detail = error.error ?? error.message;
      if (typeof detail === 'string') {
        return detail;
      }

      return this.extractErrorMessage(detail);
    }

    if (error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const detail = record['detail'] ?? record['message'];

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      if (Array.isArray(detail)) {
        const messages = detail
          .map((item) => {
            if (item && typeof item === 'object' && 'msg' in item) {
              const msg = (item as Record<string, unknown>)['msg'];
              return typeof msg === 'string' ? msg.trim() : null;
            }
            return null;
          })
          .filter((msg): msg is string => Boolean(msg));

        if (messages.length > 0) {
          return messages.join('. ');
        }
      }
    }

    return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
