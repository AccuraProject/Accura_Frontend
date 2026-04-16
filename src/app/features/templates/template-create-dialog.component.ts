import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { read, utils, writeFileXLSX } from 'xlsx';

import { ValidationRulesService } from '../validation-rules/validation-rules.service';
import {
  TemplateCreatePayload,
  TemplateColumnPayload,
  TemplateColumnResponse,
  TemplateColumnRulePayload,
  TemplateResponse,
  TemplatesService
} from './templates.service';

interface StepOneFormModel {
  name: string;
  tableName: string;
  description: string;
}

interface TemplateRuleOption {
  id: string;
  name: string;
  dataType: string;
  headerRule: string[];
}

interface ColumnRuleSelection {
  id: string;
  option: TemplateRuleOption;
  headerSelection: string | null;
}

interface ColumnRowErrors {
  name?: string;
  rules?: string;
  headerSelections?: Record<string, string>;
}

interface ColumnRowDraft {
  id: string;
  name: string;
  description: string;
  ruleSelections: ColumnRuleSelection[];
  errors: ColumnRowErrors;
}

export interface TemplateCreateDialogResult {
  template: TemplateResponse;
  columns: TemplateColumnResponse[];
}

export interface TemplateDialogData {
  mode: 'create' | 'edit';
  template?: TemplateResponse;
  columns?: TemplateColumnResponse[];
}

@Component({
  selector: 'app-template-create-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './template-create-dialog.component.html',
  styleUrl: './template-create-dialog.component.scss'
})
export class TemplateCreateDialogComponent {
  protected readonly mode: 'create' | 'edit';
  protected currentStep: 1 | 2 = 1;
  protected readonly stepOneForm: StepOneFormModel = {
    name: '',
    tableName: '',
    description: ''
  };

  protected generalError: string | null = null;
  protected generalLoading = false;

  protected columns: ColumnRowDraft[] = [];
  protected columnsError: string | null = null;
  protected columnsLoading = false;

  protected rules: TemplateRuleOption[] = [];
  protected rulesLoading = false;
  protected rulesError: string | null = null;

  protected templateResponse: TemplateResponse | null = null;

  private readonly dialogData: TemplateDialogData;
  private pendingColumns: TemplateColumnResponse[] | null = null;

  constructor(
    private readonly dialogRef: MatDialogRef<TemplateCreateDialogComponent, TemplateCreateDialogResult | undefined>,
    private readonly templatesService: TemplatesService,
    private readonly validationRulesService: ValidationRulesService,
    @Inject(MAT_DIALOG_DATA) data: TemplateDialogData | null
  ) {
    this.dialogData = data ?? { mode: 'create' };
    this.mode = this.dialogData.mode === 'edit' ? 'edit' : 'create';

    if (this.mode === 'edit' && this.dialogData.template) {
      this.templateResponse = this.dialogData.template;
      this.stepOneForm.name = this.dialogData.template.name ?? '';
      this.stepOneForm.tableName = this.dialogData.template.table_name ?? '';
      this.stepOneForm.description = this.dialogData.template.description ?? '';
    }

    if (this.mode === 'edit' && Array.isArray(this.dialogData.columns)) {
      this.pendingColumns = this.dialogData.columns.map((column) => ({
        ...column,
        rules: Array.isArray(column.rules)
          ? column.rules.map((rule) => ({ ...rule }))
          : []
      }));
    }
  }

  protected get isEditMode(): boolean {
    return this.mode === 'edit';
  }

  protected close(): void {
    if (this.generalLoading || this.columnsLoading) {
      return;
    }

    this.dialogRef.close();
  }

  protected async submitGeneralStep(form: NgForm): Promise<void> {
    if (this.generalLoading) {
      return;
    }

    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    const description = this.stepOneForm.description.trim();
    const payload: TemplateCreatePayload = {
      name: this.stepOneForm.name.trim(),
      table_name: this.stepOneForm.tableName.trim(),
      ...(description ? { description } : {})
    };

    if (!payload.name || !payload.table_name) {
      form.form.markAllAsTouched();
      return;
    }

    this.generalLoading = true;
    this.generalError = null;

    try {
      let response: TemplateResponse;

      if (this.isEditMode) {
        const templateId = this.templateResponse?.id ?? this.dialogData.template?.id;

        if (templateId === undefined || templateId === null) {
          throw new Error('No fue posible identificar la plantilla a editar.');
        }

        response = await this.templatesService.updateTemplate2(templateId, payload);
        this.templateResponse = { ...(this.templateResponse ?? {}), ...response };
      } else {
        response = await this.templatesService.createTemplate(payload);
        this.templateResponse = response;
      }

      this.currentStep = 2;
      await this.loadRules();
      if (this.columns.length === 0) {
        this.addColumn();
      }
    } catch (error) {
      console.error('[TemplateCreateDialog] Error al guardar plantilla:', error);
      this.generalError = this.getErrorMessage(error);
    } finally {
      this.generalLoading = false;
    }
  }

  protected addColumn(): void {
    const draft: ColumnRowDraft = {
      id: `column-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: '',
      description: '',
      ruleSelections: [],
      errors: {}
    };

    this.columns = [...this.columns, draft];
  }

  protected removeColumn(columnId: string): void {
    this.columns = this.columns.filter((column) => column.id !== columnId);

    if (this.columns.length === 0) {
      this.columnsError = 'Agrega al menos una columna para continuar.';
    }
  }

  protected trackByColumnId(_: number, column: ColumnRowDraft): string {
    return column.id;
  }

  protected trackByRuleId(_: number, rule: ColumnRuleSelection): string {
    return rule.id;
  }

  protected onRuleSelected(column: ColumnRowDraft, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const ruleId = select.value;

    if (!ruleId) {
      return;
    }

    select.value = '';

    if (column.ruleSelections.some((selection) => selection.id === ruleId)) {
      return;
    }

    const option = this.rules.find((rule) => rule.id === ruleId);
    if (!option) {
      return;
    }

    const selection: ColumnRuleSelection = {
      id: ruleId,
      option,
      headerSelection: this.requiresHeaderSelection(option) ? null : option.headerRule?.[0] ?? null
    };

    column.ruleSelections = [...column.ruleSelections, selection];
    column.errors = { ...column.errors, rules: undefined };
  }

  protected removeRule(column: ColumnRowDraft, ruleId: string): void {
    column.ruleSelections = column.ruleSelections.filter((selection) => selection.id !== ruleId);

    if (Object.keys(column.errors.headerSelections ?? {}).length > 0) {
      const nextHeaderErrors = { ...(column.errors.headerSelections ?? {}) };
      delete nextHeaderErrors[ruleId];
      column.errors = { ...column.errors, headerSelections: nextHeaderErrors };
    }
  }

  protected requiresHeaderSelection(option: TemplateRuleOption): boolean {
    const normalized = option.dataType.trim().toLowerCase();
    return normalized === 'lista compleja' || normalized === 'dependencia';
  }

  protected updateHeaderSelection(column: ColumnRowDraft, rule: ColumnRuleSelection, value: string): void {
    rule.headerSelection = value || null;

    if (rule.headerSelection) {
      const nextHeaderErrors = { ...(column.errors.headerSelections ?? {}) };
      delete nextHeaderErrors[rule.id];
      column.errors = { ...column.errors, headerSelections: nextHeaderErrors };
    }
  }

  protected getRuleHeaderOptions(rule: TemplateRuleOption): string[] {
    if (!Array.isArray(rule.headerRule)) {
      return [];
    }

    return rule.headerRule.filter((item) => typeof item === 'string' && item.trim().length > 0);
  }

  protected async submitColumns(): Promise<void> {
    if (this.columnsLoading || !this.templateResponse) {
      return;
    }

    const hasValidationErrors = this.validateColumns();
    if (hasValidationErrors) {
      return;
    }

    this.columnsLoading = true;
    this.columnsError = null;

    try {
      const payload = this.columns.map<TemplateColumnPayload>((column) => {
        const name = column.name.trim();
        const description = column.description.trim();

        return {
          name,
          ...(description ? { description } : {}),
          rules: column.ruleSelections.map((selection) => {
            const headerRule = this.requiresHeaderSelection(selection.option)
              ? selection.headerSelection
                ? [selection.headerSelection]
                : []
              : selection.option.headerRule ?? [];

            return {
              id: this.toNumericId(selection.id),
              'header rule': headerRule
            };
          }),
          is_active: true
        };
      });

      const columnsResponse = this.isEditMode
        ? await this.templatesService.updateTemplateColumns(this.templateResponse.id, payload)
        : await this.templatesService.createTemplateColumns(this.templateResponse.id, payload);

      // this.dialogRef.close({
      //   template: this.templateResponse,
      //   columns: columnsResponse
      // });
    } catch (error) {
      console.error('[TemplateCreateDialog] Error al crear columnas:', error);
      this.columnsError = this.getErrorMessage(error);
    } finally {
      this.columnsLoading = false;
    }
  }

  protected downloadTemplate(): void {
    const worksheet = utils.json_to_sheet([
      { Nombre: 'Ejemplo de Columna', Descripción: 'Descripción opcional' }
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Columnas');
    writeFileXLSX(workbook, 'plantilla-columnas.xlsx');
  }

  protected async importColumns(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        throw new Error('La plantilla no contiene datos.');
      }

      const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const imported: ColumnRowDraft[] = [];

      for (const row of rows) {
        const name = this.extractCellValue(row, ['Nombre', 'name', 'columna']);
        const description = this.extractCellValue(row, ['Descripción', 'description', 'descripcion']);

        if (!name) {
          continue;
        }

        imported.push({
          id: `column-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          description,
          ruleSelections: [],
          errors: {}
        });
      }

      if (imported.length === 0) {
        this.columnsError = 'No se encontraron columnas válidas en el archivo seleccionado.';
        return;
      }

      this.columns = [...this.columns, ...imported];
      this.columnsError = null;
    } catch (error) {
      console.error('[TemplateCreateDialog] Error al importar columnas:', error);
      this.columnsError = 'No fue posible importar el archivo seleccionado. Verifica el formato.';
    } finally {
      input.value = '';
    }
  }

  protected get hasColumns(): boolean {
    return this.columns.length > 0;
  }

  private hydratePendingColumns(): void {
    if (!this.pendingColumns || this.pendingColumns.length === 0) {
      return;
    }

    const drafts = this.pendingColumns
      .map((column) => this.createDraftFromResponse(column))
      .filter((draft): draft is ColumnRowDraft => draft !== null);

    if (drafts.length > 0) {
      this.columns = drafts;
      this.columnsError = null;
    }

    this.pendingColumns = null;
  }

  private createDraftFromResponse(column: TemplateColumnResponse): ColumnRowDraft | null {
    if (!column || typeof column.name !== 'string') {
      return null;
    }

    const rules = Array.isArray(column.rules) ? column.rules : [];
    const ruleSelections: ColumnRuleSelection[] = [];

    for (const rule of rules) {
      const ruleIdValue = (rule as TemplateColumnRulePayload)?.id;
      if (ruleIdValue === undefined || ruleIdValue === null) {
        continue;
      }

      const ruleId = String(ruleIdValue);
      const headerRule = this.extractStringArray(
        rule['header rule'] ??
          (typeof rule === 'object' && rule !== null
            ? ((rule as unknown) as Record<string, unknown>)['header_rule']
            : undefined)
      );

      const option = this.rules.find((candidate) => candidate.id === ruleId);
      const selectionOption = option ?? this.buildFallbackRuleOption(rule, ruleId, headerRule);

      const headerSelection = this.requiresHeaderSelection(selectionOption)
        ? headerRule[0] ?? null
        : selectionOption.headerRule?.[0] ?? null;

      ruleSelections.push({
        id: ruleId,
        option: selectionOption,
        headerSelection,
      });
    }

    return {
      id: `column-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: column.name,
      description: column.description ?? '',
      ruleSelections,
      errors: {},
    };
  }

  private buildFallbackRuleOption(
    rule: TemplateColumnRulePayload,
    ruleId: string,
    headerRule: string[]
  ): TemplateRuleOption {
    const requiresHeader = headerRule.length > 0;
    const ruleRecord = (rule as unknown) as Record<string, unknown>;
    const name =
      this.extractString(ruleRecord['name']) ??
      this.extractString(ruleRecord['rule_name']) ??
      this.extractString(ruleRecord['Nombre de la regla']) ??
      `Regla #${ruleId}`;

    return {
      id: ruleId,
      name,
      dataType: requiresHeader ? 'Dependencia' : 'Regla',
      headerRule,
    };
  }

  private async loadRules(): Promise<void> {
    if (this.rulesLoading) {
      return;
    }

    if (this.rules.length > 0) {
      this.hydratePendingColumns();
      return;
    }

    this.rulesLoading = true;
    this.rulesError = null;

    try {
      const data = await this.validationRulesService.fetchRules();
      this.rules = this.parseRuleList(data);
    } catch (error) {
      console.error('[TemplateCreateDialog] Error al obtener reglas:', error);
      this.rulesError = this.getErrorMessage(error);
      this.rules = [];
    } finally {
      this.hydratePendingColumns();
      this.rulesLoading = false;
    }
  }

  private validateColumns(): boolean {
    let hasErrors = false;

    if (this.columns.length === 0) {
      this.columnsError = 'Agrega al menos una columna para continuar.';
      return true;
    }

    this.columnsError = null;

    this.columns = this.columns.map((column) => {
      const errors: ColumnRowErrors = {};
      const name = column.name.trim();

      if (!name) {
        errors.name = 'El nombre de la columna es obligatorio.';
      }

      if (column.ruleSelections.length > 0) {
        const headerErrors: Record<string, string> = {};
        for (const selection of column.ruleSelections) {
          if (this.requiresHeaderSelection(selection.option) && !selection.headerSelection) {
            headerErrors[selection.id] = 'Selecciona un encabezado para esta regla.';
          }
        }

        if (Object.keys(headerErrors).length > 0) {
          errors.headerSelections = headerErrors;
        }
      }

      if (Object.keys(errors).length > 0) {
        hasErrors = true;
      }

      return {
        ...column,
        name,
        description: column.description.trim(),
        errors
      };
    });

    return hasErrors;
  }

  private extractCellValue(row: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }

      if (typeof value === 'number') {
        return String(value);
      }
    }

    return '';
  }

  private parseRuleList(data: unknown): TemplateRuleOption[] {
    if (Array.isArray(data)) {
      return data
        .map((entry) => this.parseRuleItem(entry))
        .filter((rule): rule is TemplateRuleOption => rule !== null);
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const collectionKeys = ['items', 'rules', 'data'];

      for (const key of collectionKeys) {
        const candidate = record[key];
        if (Array.isArray(candidate)) {
          return candidate
            .map((entry) => this.parseRuleItem(entry))
            .filter((rule): rule is TemplateRuleOption => rule !== null);
        }
      }

      const single = this.parseRuleItem(record);
      return single ? [single] : [];
    }

    return [];
  }

  private parseRuleItem(entry: unknown): TemplateRuleOption | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const payloadCandidate = record['payload'] ?? record['rule'] ?? entry;

    if (!payloadCandidate || typeof payloadCandidate !== 'object') {
      return null;
    }

    const payload = payloadCandidate as Record<string, unknown>;
    const id = this.extractIdentifier(record['id'] ?? payload['id']);
    const name = this.extractString(payload['Nombre de la regla'] ?? payload['name']);
    const dataType = this.extractString(payload['Tipo de dato'] ?? payload['data_type'] ?? record['data_type']);
    const headerRule = this.extractStringArray(
      payload['Header rule'] ?? payload['header rule'] ?? record['header_rule'] ?? record['headerRule']
    );

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      dataType: dataType ?? 'Regla',
      headerRule
    };
  }

  private extractIdentifier(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return null;
  }

  private extractString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return null;
  }

  private extractStringArray(value: unknown): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : null))
        .filter((item): item is string => !!item && item.length > 0);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    return [];
  }

  private toNumericId(id: string): number | string {
    const numeric = Number(id);
    return Number.isNaN(numeric) ? id : numeric;
  }

  private getErrorMessage(error: unknown): string {
    if (!error) {
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null) {
      const record = error as Record<string, unknown>;

      if (record['error']) {
        return this.getErrorMessage(record['error']);
      }

      const detail = record['detail'];

      if (Array.isArray(detail)) {
        const first = detail[0];
        if (first && typeof first === 'object') {
          const message = (first as Record<string, unknown>)['msg'];
          if (typeof message === 'string' && message.trim().length > 0) {
            return message;
          }
        }
      }

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      const message = record['message'];
      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
