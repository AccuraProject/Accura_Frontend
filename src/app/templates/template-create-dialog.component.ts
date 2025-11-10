import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { read, utils, writeFileXLSX } from 'xlsx';

import { TemplateService, TemplateCreatePayload, TemplateWithColumns } from './template.service';
import { ValidationRulesService } from '../validation-rules/validation-rules.service';

interface RuleOption {
  id: string;
  label: string;
}

interface TemplateColumnDraft {
  name: string;
  ruleId: string | null;
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
    this.columns = [...this.columns, { name: '', ruleId: null }];
  }

  protected removeColumnRow(index: number): void {
    this.columns = this.columns.filter((_, i) => i !== index);
    if (this.columns.length === 0) {
      this.addColumnRow();
    }
  }

  protected trackByColumnIndex(index: number): number {
    return index;
  }

  protected async submitColumns(): Promise<void> {
    if (!this.createdTemplate) {
      this.columnsError = 'No se encontró la plantilla creada.';
      return;
    }

    this.columnsError = null;

    const sanitized = this.columns.map((column) => ({
      name: column.name.trim(),
      ruleId: column.ruleId && column.ruleId.trim().length > 0 ? column.ruleId.trim() : null
    }));

    if (sanitized.length === 0 || sanitized.every((column) => column.name.length === 0)) {
      this.columnsError = 'Agrega al menos una columna con un nombre válido.';
      return;
    }

    if (sanitized.some((column) => column.name.length === 0)) {
      this.columnsError = 'Todas las columnas deben tener un nombre.';
      return;
    }

    this.columnsSubmitting = true;

    try {
      const payload = sanitized.map((column, index) => ({
        name: column.name,
        rule_id: this.normalizeRuleId(column.ruleId),
        order: index + 1
      }));

      await this.templateService.createColumns(this.createdTemplate.id, payload);
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
      const names = this.buildColumnNames(rows);

      if (names.length === 0) {
        throw new Error('El archivo no contiene registros válidos en la primera columna.');
      }

      const next: TemplateColumnDraft[] = this.columns
        .map((column) => ({ name: column.name.trim(), ruleId: column.ruleId }))
        .filter((column) => column.name.length > 0);

      const existing = new Set(next.map((column) => column.name.toLowerCase()));
      names.forEach((name) => {
        const lower = name.toLowerCase();
        if (!existing.has(lower)) {
          next.push({ name, ruleId: null });
          existing.add(lower);
        }
      });

      if (next.length === 0) {
        next.push({ name: '', ruleId: null });
      }

      this.columns = next;
      this.columnsError = null;
    } catch (error) {
      this.columnsError = this.extractErrorMessage(error);
    } finally {
      this.resetFileInput(event);
    }
  }

  protected downloadTemplate(): void {
    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([[this.columnHeaderLabel]]);
    utils.book_append_sheet(workbook, sheet, 'Plantilla');
    writeFileXLSX(workbook, 'plantilla-columnas.xlsx');
  }

  protected get columnHeaderLabel(): string {
    return 'Nombre';
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
      this.rulesLoaded = true;
    } catch (error) {
      this.rulesError = this.extractErrorMessage(error);
      this.ruleOptions = [];
    } finally {
      this.rulesLoading = false;
    }
  }

  private ensureInitialColumnRow(): void {
    if (this.columns.length === 0) {
      this.columns = [{ name: '', ruleId: null }];
    }
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

  private buildColumnNames(rows: string[][]): string[] {
    if (rows.length === 0) {
      return [];
    }

    const headers = (rows[0] ?? []).map((cell) => cell.trim());
    let columnIndex = headers.findIndex((header) => header.toLowerCase() === this.columnHeaderLabel.toLowerCase());
    if (columnIndex < 0) {
      columnIndex = 0;
    }

    const names = rows
      .slice(1)
      .map((row) => (row[columnIndex] ?? '').trim())
      .filter((cell) => cell.length > 0);

    const unique: string[] = [];
    names.forEach((name) => {
      if (!unique.includes(name)) {
        unique.push(name);
      }
    });

    return unique;
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

    const directName =
      this.sanitizeString(record['name']) ||
      this.sanitizeString(record['Nombre de la regla']);

    if (directName) {
      return { id, label: directName };
    }

    const payload = this.extractRulePayload(record['rule'] ?? record['payload']);
    if (payload?.name) {
      return { id, label: payload.name };
    }

    return null;
  }

  private extractRulePayload(value: unknown): { name: string } | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const name =
      this.sanitizeString(record['Nombre de la regla']) ||
      this.sanitizeString(record['name']);

    if (!name) {
      return null;
    }

    return { name };
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
