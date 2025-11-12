import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import * as XLSX from 'xlsx';

import { ValidationRulesService } from '../validation-rules/validation-rules.service';
import {
  TemplateColumnPayload,
  TemplateColumnResponse,
  TemplateColumnRulePayload,
  TemplateCreatePayload,
  TemplateResponse,
  TemplateService,
} from './template.service';

interface RuleOption {
  id: number;
  name: string;
  dataType: string;
  description: string;
  headerRule: string[];
}

interface ColumnRuleSelection {
  ruleId: number;
  name: string;
  dataType: string;
  description: string;
  headerRule: string[];
  selectedHeader: string | null;
}

interface TemplateColumnDraft {
  id: string;
  name: string;
  description: string;
  rules: ColumnRuleSelection[];
}

export interface TemplateCreateDialogResult {
  template: TemplateResponse;
  columns: TemplateColumnResponse[];
}

@Component({
  selector: 'app-template-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './template-create-dialog.component.html',
  styleUrl: './template-create-dialog.component.scss',
})
export class TemplateCreateDialogComponent implements OnInit {
  private readonly dialogRef = inject(
    MatDialogRef<TemplateCreateDialogComponent, TemplateCreateDialogResult | undefined>
  );
  private readonly templateService = inject(TemplateService);
  private readonly validationRulesService = inject(ValidationRulesService);

  protected step: 'general' | 'columns' = 'general';
  protected template: TemplateResponse | null = null;

  protected generalForm: { name: string; tableName: string; description: string } = {
    name: '',
    tableName: '',
    description: '',
  };
  protected generalFormTouched = false;
  protected generalLoading = false;
  protected generalError: string | null = null;

  protected rules: RuleOption[] = [];
  protected rulesLoading = false;
  protected rulesError: string | null = null;

  protected columns: TemplateColumnDraft[] = [];
  protected columnError: string | null = null;
  protected columnSaveLoading = false;
  protected importError: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadRules();
    this.addColumn();
  }

  protected async submitGeneralStep(): Promise<void> {
    this.generalFormTouched = true;
    this.generalError = null;

    if (!this.generalForm.name.trim() || !this.generalForm.tableName.trim()) {
      return;
    }

    const payload: TemplateCreatePayload = {
      name: this.generalForm.name.trim(),
      table_name: this.generalForm.tableName.trim(),
      description: this.generalForm.description.trim() || undefined,
    };

    this.generalLoading = true;

    try {
      this.template = await this.templateService.createTemplate(payload);
      this.step = 'columns';
    } catch (error) {
      console.error('[TemplateCreateDialog] Error creating template', error);
      this.generalError = this.getErrorMessage(error, 'No fue posible crear la plantilla.');
    } finally {
      this.generalLoading = false;
    }
  }

  protected async saveColumns(): Promise<void> {
    this.columnError = null;
    this.importError = null;

    if (!this.template) {
      this.columnError = 'Primero debes completar la configuración general.';
      return;
    }

    const validation = this.validateColumns();
    if (!validation.valid) {
      this.columnError = validation.message ?? null;
      return;
    }

    this.columnSaveLoading = true;
    const createdColumns: TemplateColumnResponse[] = [];

    try {
      for (const draft of this.columns) {
        const payload: TemplateColumnPayload = {
          name: draft.name.trim(),
          description: draft.description.trim() || undefined,
          rules: draft.rules.map((rule) => this.mapRuleSelection(rule)),
        };

        const column = await this.templateService.createColumn(this.template.id, payload);
        createdColumns.push(column);
      }

      this.dialogRef.close({ template: this.template, columns: createdColumns });
    } catch (error) {
      console.error('[TemplateCreateDialog] Error creating column', error);
      this.columnError = this.getErrorMessage(error, 'No fue posible registrar las columnas.');
    } finally {
      this.columnSaveLoading = false;
    }
  }

  protected addColumn(): void {
    const id = crypto.randomUUID?.() ?? `column-${Date.now()}-${Math.random()}`;
    this.columns = [
      ...this.columns,
      { id, name: '', description: '', rules: [] },
    ];
  }

  protected removeColumn(columnId: string): void {
    this.columns = this.columns.filter((column) => column.id !== columnId);
    if (this.columns.length === 0) {
      this.addColumn();
    }
  }

  protected getSelectedRuleIds(column: TemplateColumnDraft): number[] {
    return column.rules.map((rule) => rule.ruleId);
  }

  protected onRulesChange(column: TemplateColumnDraft, ruleIds: number[]): void {
    const normalized = Array.isArray(ruleIds)
      ? ruleIds
          .map((id) => Number(id))
          .filter((id, index, array) => Number.isFinite(id) && array.indexOf(id) === index)
      : [];

    const updatedSelections: ColumnRuleSelection[] = [];

    for (const ruleId of normalized) {
      const existing = column.rules.find((rule) => rule.ruleId === ruleId);
      if (existing) {
        updatedSelections.push(existing);
        continue;
      }

      const rule = this.rules.find((item) => item.id === ruleId);
      if (!rule) {
        continue;
      }

      const selection: ColumnRuleSelection = {
        ruleId: rule.id,
        name: rule.name,
        dataType: rule.dataType,
        description: rule.description,
        headerRule: [...rule.headerRule],
        selectedHeader: null,
      };

      updatedSelections.push(selection);
    }

    column.rules = updatedSelections;
  }

  protected onHeaderChange(column: TemplateColumnDraft, ruleId: number, value: string): void {
    const selection = column.rules.find((item) => item.ruleId === ruleId);
    if (!selection) {
      return;
    }

    selection.selectedHeader = value ? value.trim() : null;
  }

  protected requiresHeaderSelection(selection: ColumnRuleSelection): boolean {
    return selection.headerRule.length > 0;
  }

  protected removeRule(column: TemplateColumnDraft, ruleId: number): void {
    const remaining = column.rules
      .filter((rule) => rule.ruleId !== ruleId)
      .map((rule) => rule.ruleId);

    this.onRulesChange(column, remaining);
  }

  protected trackByRuleSelection(_: number, selection: ColumnRuleSelection): number {
    return selection.ruleId;
  }

  protected importColumns(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      this.importError = 'Solo se admiten archivos con extensión .xlsx o .xls';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          throw new Error('El archivo no contiene hojas.');
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('La plantilla no contiene registros.');
        }

        const importedColumns: TemplateColumnDraft[] = rows
          .map((row, index) => this.mapRowToColumn(row, index))
          .filter((row): row is TemplateColumnDraft => row !== null);

        if (importedColumns.length === 0) {
          throw new Error('No se encontraron columnas válidas en el archivo.');
        }

        this.columns = [...this.columns, ...importedColumns];
        this.importError = null;
      } catch (error) {
        console.error('[TemplateCreateDialog] Error importing columns', error);
        this.importError = this.getErrorMessage(error, 'No fue posible procesar el archivo.');
      } finally {
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.importError = 'Ocurrió un error al leer el archivo.';
      input.value = '';
    };

    reader.readAsArrayBuffer(file);
  }

  protected downloadTemplate(): void {
    const headers = [['Nombre', 'Descripción']];
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');
    XLSX.writeFile(workbook, 'plantilla-columnas.xlsx');
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected trackByColumnId(_: number, column: TemplateColumnDraft): string {
    return column.id;
  }

  private async loadRules(): Promise<void> {
    this.rulesLoading = true;
    this.rulesError = null;

    try {
      const response = await this.validationRulesService.fetchRules();
      this.rules = this.parseRuleListResponse(response);
    } catch (error) {
      console.error('[TemplateCreateDialog] Error loading rules', error);
      this.rulesError = this.getErrorMessage(error, 'No fue posible obtener las reglas disponibles.');
      this.rules = [];
    } finally {
      this.rulesLoading = false;
    }
  }

  private parseRuleListResponse(data: unknown): RuleOption[] {
    if (Array.isArray(data)) {
      return data
        .map((item) => this.parseRuleItem(item))
        .filter((rule): rule is RuleOption => rule !== null);
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const collectionKeys = ['items', 'rules', 'data'];

      for (const key of collectionKeys) {
        const collection = record[key];
        if (Array.isArray(collection)) {
          return collection
            .map((item) => this.parseRuleItem(item))
            .filter((rule): rule is RuleOption => rule !== null);
        }
      }

      const single = this.parseRuleItem(record);
      return single ? [single] : [];
    }

    return [];
  }

  private parseRuleItem(entry: unknown): RuleOption | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const payloadCandidate = record['payload'] ?? record['rule'] ?? entry;
    if (!payloadCandidate || typeof payloadCandidate !== 'object') {
      return null;
    }

    const payload = payloadCandidate as Record<string, unknown>;
    const idValue = record['id'] ?? record['uuid'] ?? record['pk'];
    const id = Number(idValue);
    if (!Number.isFinite(id)) {
      return null;
    }

    const name = this.toString(payload['Nombre de la regla']);
    const dataType = this.toString(payload['Tipo de dato']);
    const description = this.toString(payload['Descripción']);
    const headerRule = this.toStringArray(payload['Header rule']);

    if (!name || !dataType) {
      return null;
    }

    return {
      id,
      name,
      dataType,
      description,
      headerRule,
    };
  }

  private toString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toString(item))
        .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
    }

    const text = this.toString(value);
    return text ? [text] : [];
  }

  private mapRowToColumn(row: Record<string, string>, index: number): TemplateColumnDraft | null {
    const possibleKeys = Object.keys(row);
    const nameKey = possibleKeys.find((key) => key.toLowerCase() === 'nombre');
    const descriptionKey = possibleKeys.find((key) => key.toLowerCase().startsWith('descrip'));

    const name = nameKey ? row[nameKey]?.toString().trim() : '';
    const description = descriptionKey ? row[descriptionKey]?.toString().trim() : '';

    if (!name) {
      console.warn('[TemplateCreateDialog] Ignoring row without name', { rowIndex: index, row });
      return null;
    }

    return {
      id: `import-${Date.now()}-${index}-${Math.random()}`,
      name,
      description: description ?? '',
      rules: [],
    };
  }

  private mapRuleSelection(selection: ColumnRuleSelection): TemplateColumnRulePayload {
    const payload: TemplateColumnRulePayload = {
      id: selection.ruleId,
    };

    if (selection.headerRule.length > 0) {
      const header = selection.selectedHeader?.trim();
      if (header) {
        payload['header rule'] = [header];
      }
    }

    return payload;
  }

  private validateColumns(): { valid: boolean; message?: string } {
    if (this.columns.length === 0) {
      return { valid: false, message: 'Debes registrar al menos una columna.' };
    }

    for (const column of this.columns) {
      if (!column.name.trim()) {
        return { valid: false, message: 'Todas las columnas deben tener un nombre.' };
      }

      for (const rule of column.rules) {
        if (rule.headerRule.length > 0 && !rule.selectedHeader?.trim()) {
          return {
            valid: false,
            message: `Selecciona un header para la regla "${rule.name}" en la columna "${column.name}".`,
          };
        }
      }
    }

    return { valid: true };
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const record = error as Record<string, unknown>;

    const detail = record['detail'];
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }

    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String(item['msg']);
          }
          return null;
        })
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join('\n');

      if (message) {
        return message;
      }
    }

    const message = record['message'];
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    return fallback;
  }
}
