import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { read, utils, writeFileXLSX } from 'xlsx';

import { environment } from '../../environments/environment';
import { selectSessionState, SessionState } from '../core/store/session/session.reducer';
import {
  VALIDATION_RULE_AI_SCHEMA,
  RulePayload,
  RuleExample,
  describeRuleConfig as describeRuleConfigUtil,
  extractAiPayloads,
  generateDefaultRuleConfig,
  getExampleEntries as getExampleEntriesUtil,
  normalizeAiPayload,
  DEFAULT_RULE_ERROR_MESSAGE
} from './validation-rule-ai.utils';

export interface ValidationRuleFormDialogResult {
  name: string;
  dataType: string;
  mandatory: boolean;
  status: 'Activa' | 'Inactiva';
  description: string;
  primaryHeader: string;
  secondaryHeaders: string[];
  exampleEntries: Array<{ key: string; value: string }>;
  ruleConfig: Record<string, unknown>;
}

export interface ValidationRuleFormDialogSubmitResult extends ValidationRuleFormDialogResult {
  payload: RulePayload;
}

export interface ValidationRuleFormDialogData {
  mode: 'create' | 'edit';
  rule?: ValidationRuleFormDialogResult;
  payload?: RulePayload;
}

interface AiSuggestion {
  id: string;
  payload: RulePayload;
}

@Component({
  selector: 'app-validation-rule-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './validation-rule-form-dialog.component.html',
  styleUrl: './validation-rule-form-dialog.component.scss'
})
export class ValidationRuleFormDialogComponent {
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;
  protected readonly formModel: ValidationRuleFormDialogResult;
  protected readonly dataTypeOptions: string[] = [
    'Texto',
    'Número',
    'Documento',
    'Lista',
    'Lista compleja',
    'Telefono',
    'Correo',
    'Fecha',
    'Dependencia',
    'Validación conjunta',
    'Duplicados'
  ];
  protected readonly statusOptions: Array<ValidationRuleFormDialogResult['status']> = [
    'Activa',
    'Inactiva'
  ];
  protected readonly decimalOptions: number[] = [0, 1, 2, 3, 4, 5, 6];

  private readonly defaultListTableHeader = 'Valores permitidos';
  protected secondaryHeaderDraft = '';
  protected listItemDraft = '';
  protected jointFieldDraft = '';
  protected duplicateFieldDraft = '';
  protected advancedConfigError: string | null = null;
  protected advancedTableColumns: string[] = [];
  protected advancedTableRows: Array<Record<string, string>> = [];
  protected advancedColumnDraft = '';
  protected complexListDraftRow: Record<string, string> = {};
  protected dependencyDraftRow: Record<string, string> = {};
  protected showRuleConfigJson = true;
  protected manualFormEnabled: boolean;
  protected listTableHeader = this.defaultListTableHeader;

  private referencePayload: RulePayload | null;
  private headerRuleReference: string[] = [];

  protected aiPrompt = '';
  protected aiIsLoading = false;
  protected aiError: string | null = null;
  protected aiSuggestions: AiSuggestion[] = [];
  protected selectedAiSuggestionId: string | null = null;

  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly aiRuleSchema = VALIDATION_RULE_AI_SCHEMA;
  private readonly defaultErrorMessage = DEFAULT_RULE_ERROR_MESSAGE;

  constructor(
    private readonly dialogRef: MatDialogRef<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) data: ValidationRuleFormDialogData,
    private readonly http: HttpClient,
    private readonly store: Store
  ) {
    this.isEditMode = data.mode === 'edit';
    this.title = this.isEditMode ? 'Editar Regla de Validación' : 'Crear Regla de Validación Global';
    this.description = this.isEditMode
      ? 'Actualiza la configuración de la regla global que se asignará a las plantillas.'
      : 'Define una regla global que podrás asignar a columnas de plantillas según su tipo de dato.';
    this.actionLabel = this.isEditMode ? 'Guardar Cambios' : 'Guardar Regla';
    this.formModel = data.rule ? this.cloneRule(data.rule) : this.createEmptyForm();
    this.manualFormEnabled = this.isEditMode;
    this.referencePayload = data.payload ? this.clonePayload(data.payload) : null;
    this.headerRuleReference = this.extractHeaderRule(this.referencePayload);
    this.ensureCollections();
    this.syncAdvancedTableFromRule();
    this.syncListTableHeader();
    this.syncComplexListDraftRow();
    this.syncDependencyDraftRow();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (!this.canSave) {
      return;
    }

    const primaryHeader = this.formModel.primaryHeader.trim();
    const sanitizedPrimaryHeader = primaryHeader.length > 0 ? primaryHeader : 'Plantilla Global';

    const secondaryHeaders = this.formModel.secondaryHeaders
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

    const exampleEntries = this.formModel.exampleEntries.map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim()
    }));

    this.formModel.exampleEntries = exampleEntries.map((entry) => ({ ...entry }));
    this.formModel.primaryHeader = sanitizedPrimaryHeader;

    const submissionPayload = this.buildSubmissionPayload(
      sanitizedPrimaryHeader,
      secondaryHeaders,
      exampleEntries
    );
    this.referencePayload = this.clonePayload(submissionPayload);
    this.headerRuleReference = this.extractHeaderRule(this.referencePayload);

    const result: ValidationRuleFormDialogSubmitResult = {
      ...this.formModel,
      name: this.formModel.name.trim(),
      description: this.formModel.description.trim(),
      primaryHeader: sanitizedPrimaryHeader,
      secondaryHeaders,
      exampleEntries,
      ruleConfig: JSON.parse(JSON.stringify(this.formModel.ruleConfig)) as Record<string, unknown>,
      payload: submissionPayload
    };

    this.dialogRef.close(result);
  }

  protected get canSave(): boolean {
    if (!this.formModel.name.trim()) {
      return false;
    }

    if (!this.formModel.exampleEntries.every((entry) => entry.value.trim().length > 0)) {
      return false;
    }

    if (this.advancedConfigError) {
      return false;
    }

    if (this.isDataType('Lista')) {
      return this.listValues.length > 0;
    }

    if (this.isDataType('Lista compleja')) {
      return this.complexListColumns.length > 0 && this.hasAdvancedTableValues;
    }

    if (this.isDataType('Dependencia')) {
      return this.dependencyTableColumns.length > 0 && this.hasDependencyValues;
    }

    if (this.isDataType('Validación conjunta')) {
      return this.jointFieldValues.length > 0;
    }

    if (this.isDataType('Duplicados')) {
      return this.duplicateFieldValues.length > 0;
    }

    return true;
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  protected trackBySuggestionId(_: number, suggestion: AiSuggestion): string {
    return suggestion.id;
  }

  protected onDataTypeChange(): void {
    this.formModel.ruleConfig = this.createDefaultRuleConfig(this.formModel.dataType);
    this.listItemDraft = '';
    this.jointFieldDraft = '';
    this.duplicateFieldDraft = '';
    this.advancedColumnDraft = '';
    this.syncAdvancedTableFromRule();
    this.syncListTableHeader();
    this.advancedConfigError = null;
    this.syncComplexListDraftRow(false);
    this.syncDependencyDraftRow(false);
  }

  protected addSecondaryHeader(): void {
    const value = this.secondaryHeaderDraft.trim();
    if (!value) {
      return;
    }

    if (!this.formModel.secondaryHeaders.includes(value)) {
      this.formModel.secondaryHeaders.push(value);
      if (this.isDataType('Lista compleja')) {
        this.syncAdvancedTableFromRule();
        this.syncComplexListDraftRow();
      }
      if (this.isDataType('Dependencia')) {
        this.syncDependencyDraftRow();
      }
    }

    this.secondaryHeaderDraft = '';
  }

  protected removeSecondaryHeader(index: number): void {
    this.formModel.secondaryHeaders.splice(index, 1);
    if (this.isDataType('Lista compleja')) {
      this.syncAdvancedTableFromRule();
      this.syncComplexListDraftRow();
    }
    if (this.isDataType('Dependencia')) {
      this.syncDependencyDraftRow();
    }
  }

  protected addListValue(): void {
    const value = this.listItemDraft.trim();
    if (!value) {
      return;
    }

    const values = this.listValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Lista'] = values;
    this.listItemDraft = '';
    this.advancedConfigError = null;
  }

  protected removeListValue(index: number): void {
    const values = this.listValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Lista'] = values;
    this.advancedConfigError = null;
  }

  protected addJointField(): void {
    const value = this.jointFieldDraft.trim();
    if (!value) {
      return;
    }

    const values = this.jointFieldValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Nombre de campos'] = values;
    this.jointFieldDraft = '';
  }

  protected removeJointField(index: number): void {
    const values = this.jointFieldValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Nombre de campos'] = values;
  }

  protected addDuplicateField(): void {
    const value = this.duplicateFieldDraft.trim();
    if (!value) {
      return;
    }

    const values = this.duplicateFieldValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Campos'] = values;
    this.duplicateFieldDraft = '';
  }

  protected removeDuplicateField(index: number): void {
    const values = this.duplicateFieldValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Campos'] = values;
  }

  protected removeDependencyRow(index: number): void {
    if (!this.isDataType('Dependencia')) {
      return;
    }

    if (index < 0) {
      return;
    }

    const rules = this.getDependencyRules();
    if (index >= rules.length) {
      return;
    }

    this.advancedConfigError = null;
    const updated = rules.filter((_, i) => i !== index);
    this.formModel.ruleConfig['reglas especifica'] = updated;
    this.syncDependencyDraftRow();
  }

  protected toggleIgnoreEmpty(value: boolean): void {
    this.formModel.ruleConfig['Ignorar vacios'] = value;
  }

  protected get listValues(): string[] {
    return this.getRawListValues()
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
  }

  protected get listTableRows(): string[] {
    return this.getRawListValues();
  }

  protected get canAddListDraft(): boolean {
    return this.listItemDraft.trim().length > 0;
  }

  protected get jointFieldValues(): string[] {
    const values = this.formModel.ruleConfig['Nombre de campos'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  }

  protected get duplicateFieldValues(): string[] {
    const values = this.formModel.ruleConfig['Campos'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  }

  protected get ignoreEmptyDuplicates(): boolean {
    return Boolean(this.formModel.ruleConfig['Ignorar vacios']);
  }

  protected get ruleConfig(): Record<string, any> {
    return this.formModel.ruleConfig as Record<string, any>;
  }

  protected get hasRuleConfigJson(): boolean {
    const config = this.formModel.ruleConfig;
    return Boolean(config && typeof config === 'object' && Object.keys(config).length > 0);
  }

  protected get ruleConfigJson(): string {
    const config = this.formModel.ruleConfig ?? {};
    return JSON.stringify(config, null, 2);
  }

  protected get ruleConfigSummary(): string[] {
    const headers = [this.formModel.primaryHeader, ...this.formModel.secondaryHeaders]
      .map((item) => item?.toString().trim())
      .filter((item): item is string => Boolean(item))
      .filter((item, index, array) => array.indexOf(item) === index);

    const payload: RulePayload = {
      'Nombre de la regla': this.formModel.name,
      'Tipo de dato': this.formModel.dataType,
      'Campo obligatorio': this.formModel.mandatory,
      Header: headers,
      'Mensaje de error': this.referenceErrorMessage,
      'Descripción': this.formModel.description,
      'Ejemplo': {},
      'Regla': this.formModel.ruleConfig ?? {}
    };

    return describeRuleConfigUtil(payload);
  }

  protected get requiresAdvancedTableData(): boolean {
    return this.getAdvancedConfigKey(this.formModel.dataType) !== null;
  }

  protected get hasAdvancedTableValues(): boolean {
    return this.advancedTableRows.some((row) =>
      this.advancedTableColumns.some((column) => (row[column] ?? '').trim().length > 0)
    );
  }

  protected get dependencyTableColumns(): string[] {
    if (!this.isDataType('Dependencia')) {
      return [];
    }

    const headers = [this.formModel.primaryHeader, ...this.formModel.secondaryHeaders]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

    if (headers.length > 0) {
      return headers;
    }

    return this.collectDependencyColumnsFromRules();
  }

  protected get dependencyTableRows(): Array<Record<string, string>> {
    if (!this.isDataType('Dependencia')) {
      return [];
    }

    const columns = this.dependencyTableColumns;
    const rules = this.getDependencyRules();

    if (columns.length === 0 || rules.length === 0) {
      return [];
    }

    return rules.map((rule) => this.buildDependencyRow(rule, columns));
  }

  protected get canAddDependencyDraft(): boolean {
    if (!this.isDataType('Dependencia')) {
      return false;
    }

    return this.dependencyTableColumns.some(
      (column) => (this.dependencyDraftRow[column] ?? '').trim().length > 0
    );
  }

  protected get complexListColumns(): string[] {
    if (!this.isDataType('Lista compleja')) {
      return [];
    }

    return this.advancedTableColumns;
  }

  protected get complexListRows(): Array<Record<string, string>> {
    if (!this.isDataType('Lista compleja')) {
      return [];
    }

    return this.advancedTableRows;
  }

  protected get canAddComplexListDraft(): boolean {
    if (!this.isDataType('Lista compleja')) {
      return false;
    }

    return this.complexListColumns.some((column) => (this.complexListDraftRow[column] ?? '').trim().length > 0);
  }

  protected get dependencyTableEmptyMessage(): string {
    if (this.dependencyTableColumns.length === 0) {
      return 'No se encontraron encabezados para las reglas de dependencia.';
    }

    return 'No hay reglas de dependencia configuradas.';
  }

  protected get hasDependencyValues(): boolean {
    const columns = this.dependencyTableColumns;
    if (columns.length === 0) {
      return false;
    }

    return this.dependencyTableRows.some((row) =>
      columns.some((column) => (row[column] ?? '').trim().length > 0)
    );
  }

  protected get advancedTableHelper(): string {
    if (this.isDataType('Dependencia')) {
      return 'Define las combinaciones válidas entre los campos dependientes. Cada fila representa una relación permitida.';
    }

    if (this.isDataType('Lista compleja')) {
      return 'Revisa los valores permitidos que componen la lista compleja y elimina los que ya no apliquen.';
    }

    return 'Organiza los elementos de la lista especificando sus atributos en columnas para facilitar su comprensión.';
  }

  protected get advancedTableEmptyMessage(): string {
    if (this.isDataType('Dependencia')) {
      return 'La tabla de dependencias se genera con los encabezados que define la regla recibida.';
    }

    if (this.isDataType('Lista compleja')) {
      return 'No hay elementos configurados para la lista compleja.';
    }

    return 'Agrega columnas para describir cada atributo de la lista (por ejemplo: Tipo Documento, Código, Descripción).';
  }

  protected get advancedTableColumnPlaceholder(): string {
    return this.isDataType('Dependencia')
      ? 'Nombre del campo dependiente'
      : 'Nombre del campo';
  }

  protected addAdvancedColumn(): void {
    const draft = this.advancedColumnDraft.trim();
    if (!draft) {
      return;
    }

    const exists = this.advancedTableColumns.some((column) => column.toLowerCase() === draft.toLowerCase());
    if (exists) {
      this.advancedConfigError = 'Ya existe una columna con ese nombre.';
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableColumns = [...this.advancedTableColumns, draft];
    this.advancedTableRows = this.advancedTableRows.map((row) => ({ ...row, [draft]: row[draft] ?? '' }));
    this.advancedColumnDraft = '';
    if (this.isDataType('Lista compleja')) {
      this.syncComplexListDraftRow();
    }
    this.updateAdvancedRuleConfigFromTable();
  }

  protected removeAdvancedColumn(index: number): void {
    const column = this.advancedTableColumns[index];
    if (!column) {
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableColumns = this.advancedTableColumns.filter((_, i) => i !== index);
    this.advancedTableRows = this.advancedTableColumns.length === 0
      ? []
      : this.advancedTableRows.map((row) => {
          const clone = { ...row };
          delete clone[column];
          return this.fillAdvancedRow(clone, this.advancedTableColumns);
        });

    if (this.isDataType('Lista compleja')) {
      this.syncComplexListDraftRow();
    }
    this.updateAdvancedRuleConfigFromTable();
  }

  protected addAdvancedRow(): void {
    if (this.advancedTableColumns.length === 0) {
      this.advancedConfigError = 'Agrega al menos una columna antes de crear filas.';
      return;
    }

    const row = this.advancedTableColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = '';
      return acc;
    }, {});

    this.advancedConfigError = null;
    this.advancedTableRows = [...this.advancedTableRows, row];
    if (this.isDataType('Lista compleja')) {
      this.syncComplexListDraftRow();
    }
    this.updateAdvancedRuleConfigFromTable();
  }

  protected removeAdvancedRow(index: number): void {
    if (index < 0 || index >= this.advancedTableRows.length) {
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableRows = this.advancedTableRows.filter((_, i) => i !== index);
    if (this.isDataType('Lista compleja')) {
      this.syncComplexListDraftRow();
    }
    this.updateAdvancedRuleConfigFromTable();
  }

  protected removeComplexListRow(index: number): void {
    if (!this.isDataType('Lista compleja')) {
      return;
    }

    if (index < 0 || index >= this.advancedTableRows.length) {
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableRows = this.advancedTableRows.filter((_, i) => i !== index);
    this.syncComplexListDraftRow();
    this.updateAdvancedRuleConfigFromTable();
  }

  protected addComplexListDraftRow(): void {
    if (!this.isDataType('Lista compleja')) {
      return;
    }

    if (this.advancedTableColumns.length === 0) {
      this.advancedConfigError = 'Agrega al menos una columna antes de crear filas.';
      return;
    }

    const row = this.advancedTableColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = (this.complexListDraftRow[column] ?? '').trim();
      return acc;
    }, {});

    const hasValue = this.advancedTableColumns.some((column) => row[column].length > 0);
    if (!hasValue) {
      this.advancedConfigError = 'Completa al menos un valor para agregar la fila.';
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableRows = [...this.advancedTableRows, row];
    this.updateAdvancedRuleConfigFromTable();
    this.syncComplexListDraftRow(false);
  }

  protected onComplexListDraftChange(): void {
    this.advancedConfigError = null;
  }

  protected addDependencyDraftRow(): void {
    if (!this.isDataType('Dependencia')) {
      return;
    }

    const columns = this.dependencyTableColumns;
    if (columns.length === 0) {
      this.advancedConfigError = 'Define encabezados para poder agregar nuevas dependencias.';
      return;
    }

    const record = columns.reduce<Record<string, string>>((acc, column) => {
      const value = (this.dependencyDraftRow[column] ?? '').trim();
      if (value.length > 0) {
        acc[column] = value;
      }
      return acc;
    }, {});

    if (Object.keys(record).length === 0) {
      this.advancedConfigError = 'Completa al menos un campo para agregar la dependencia.';
      return;
    }

    const rules = this.getDependencyRules();
    this.formModel.ruleConfig['reglas especifica'] = [...rules, record];
    this.advancedConfigError = null;
    this.syncDependencyDraftRow(false);
  }

  protected onDependencyDraftChange(): void {
    this.advancedConfigError = null;
  }

  protected async importListFromExcel(event: Event): Promise<void> {
    const file = this.extractFileFromEvent(event);
    if (!file) {
      return;
    }

    try {
      this.advancedConfigError = null;
      const rows = await this.readExcelRows(file);
      const values = this.buildListValuesFromRows(rows);
      this.formModel.ruleConfig['Lista'] = values;
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al importar lista:', error);
      this.advancedConfigError =
        'No se pudo importar el archivo. Verifica que el formato sea válido y que contenga los encabezados correctos.';
    } finally {
      this.listItemDraft = '';
      this.resetFileInput(event);
    }
  }

  protected async importComplexListFromExcel(event: Event): Promise<void> {
    const file = this.extractFileFromEvent(event);
    if (!file) {
      return;
    }

    try {
      this.advancedConfigError = null;
      const rows = await this.readExcelRows(file);
      const entries = this.buildComplexListRowsFromExcel(rows);
      this.advancedTableRows = entries.map((row) => this.fillAdvancedRow(row, this.advancedTableColumns));
      this.updateAdvancedRuleConfigFromTable();
      this.syncComplexListDraftRow(false);
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al importar lista compleja:', error);
      this.advancedConfigError =
        'No se pudo importar la lista compleja. Asegúrate de que el archivo tenga las columnas configuradas.';
    } finally {
      this.resetFileInput(event);
    }
  }

  protected async importDependencyFromExcel(event: Event): Promise<void> {
    const file = this.extractFileFromEvent(event);
    if (!file) {
      return;
    }

    try {
      this.advancedConfigError = null;
      const rows = await this.readExcelRows(file);
      const entries = this.buildDependencyRowsFromExcel(rows);
      this.formModel.ruleConfig['reglas especifica'] = entries;
      this.syncDependencyDraftRow(false);
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al importar dependencias:', error);
      this.advancedConfigError =
        'No se pudo importar el archivo de dependencias. Revisa que el encabezado coincida con la configuración actual.';
    } finally {
      this.resetFileInput(event);
    }
  }

  protected downloadListTemplate(): void {
    const header =
      typeof this.listTableHeader === 'string' && this.listTableHeader.trim().length > 0
        ? this.listTableHeader
        : this.defaultListTableHeader;
    this.downloadExcelTemplate('plantilla-lista.xlsx', [header]);
  }

  protected downloadComplexListTemplate(): void {
    const columns = this.complexListColumns;
    this.downloadExcelTemplate('plantilla-lista-compleja.xlsx', columns);
  }

  protected downloadDependencyTemplate(): void {
    const columns = this.dependencyTableColumns;
    this.downloadExcelTemplate('plantilla-dependencia.xlsx', columns);
  }

  protected onAdvancedCellChange(): void {
    this.advancedConfigError = null;
    this.updateAdvancedRuleConfigFromTable();
  }

  protected toggleJsonView(): void {
    this.showRuleConfigJson = !this.showRuleConfigJson;
  }

  protected async generateRuleWithAi(): Promise<void> {
    const prompt = this.aiPrompt.trim();
    if (!prompt) {
      this.aiError = 'Describe la validación que necesitas generar.';
      return;
    }

    this.aiIsLoading = true;
    this.aiError = null;

    try {
      const session = await this.getSessionSnapshot();
      const body = { schema: this.aiRuleSchema, message: prompt, is_admin: this.isAdmin(session) };
      const data = await this.postAuthorized<unknown>('/assistant/analyze', body, session);

      const payloads = extractAiPayloads(data)
        .map((item) => normalizeAiPayload(item))
        .filter((item): item is RulePayload => item !== null);

      if (payloads.length === 0) {
        throw new Error('El asistente no devolvió sugerencias para la descripción ingresada.');
      }

      this.aiSuggestions = payloads.map((payload) => ({
        id: this.generateSuggestionId(),
        payload: JSON.parse(JSON.stringify(payload)) as RulePayload
      }));

      this.selectedAiSuggestionId = this.aiSuggestions[0]?.id ?? null;

      const preview = this.aiPreview;
      if (preview) {
        this.applyAiPayload(preview);
      }
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al consultar la IA:', error);
      this.aiError = this.getErrorMessage(error);
      this.aiSuggestions = [];
      this.selectedAiSuggestionId = null;
    } finally {
      this.aiIsLoading = false;
    }
  }

  protected onAiSuggestionSelect(value: string): void {
    this.selectedAiSuggestionId = value;
    const preview = this.aiPreview;
    if (preview) {
      this.applyAiPayload(preview);
    }
  }

  protected get hasAiPreview(): boolean {
    return this.aiPreview !== null;
  }

  protected get aiPreview(): RulePayload | null {
    if (!this.selectedAiSuggestionId) {
      return null;
    }

    const suggestion = this.aiSuggestions.find((item) => item.id === this.selectedAiSuggestionId);
    return suggestion ? suggestion.payload : null;
  }

  protected get aiPreviewDetails(): string[] {
    const preview = this.aiPreview;
    if (!preview) {
      return [];
    }

    const details = describeRuleConfigUtil(preview);
    const dataType = typeof preview['Tipo de dato'] === 'string' ? preview['Tipo de dato'] : '';
    const tableSuggestion = this.buildAdvancedTableSuggestion(preview, dataType);

    if (tableSuggestion) {
      tableSuggestion.rows.forEach((row, index) => {
        const summary = tableSuggestion.columns
          .map((column) => {
            const value = (row[column] ?? '').trim();
            return `${column}: ${value.length > 0 ? value : '—'}`;
          })
          .join(' | ');

        details.push(`Fila ${index + 1}: ${summary}`);
      });
    }

    return details;
  }

  protected get aiPreviewHeaders(): string[] {
    const preview = this.aiPreview;
    if (!preview) {
      return [];
    }

    return Array.isArray(preview.Header)
      ? (preview.Header as unknown[])
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  }

  protected get aiPreviewExamples(): Array<{ key: string; value: string }> {
    const preview = this.aiPreview;
    if (!preview) {
      return [];
    }

    return getExampleEntriesUtil(preview).filter((entry) => entry.key.trim().length > 0);
  }

  private applyAiPayload(payload: RulePayload): void {
    this.manualFormEnabled = true;
    this.referencePayload = this.clonePayload(payload);
    this.headerRuleReference = this.extractHeaderRule(this.referencePayload);

    const headers = Array.isArray(payload.Header)
      ? (payload.Header as unknown[])
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
      : [];

    const [primaryHeader, ...secondaryHeaders] = headers.length > 0 ? headers : ['Plantilla Global'];

    const dataType = typeof payload['Tipo de dato'] === 'string' ? payload['Tipo de dato'] : 'Texto';

    this.formModel.name = typeof payload['Nombre de la regla'] === 'string'
      ? payload['Nombre de la regla']
      : this.formModel.name;
    this.formModel.dataType = dataType;
    this.formModel.mandatory = Boolean(payload['Campo obligatorio']);
    this.formModel.description = typeof payload['Descripción'] === 'string'
      ? payload['Descripción']
      : this.formModel.description;
    this.formModel.primaryHeader = primaryHeader;
    this.formModel.secondaryHeaders = secondaryHeaders;
    const normalizedDataType = this.normalizeDataType(dataType);
    this.syncListTableHeader(
      normalizedDataType === this.normalizeDataType('Lista') ? primaryHeader : null
    );

    const configSource = payload['Regla'] ?? generateDefaultRuleConfig(dataType);
    this.formModel.ruleConfig = JSON.parse(JSON.stringify(configSource)) as Record<string, unknown>;

    const exampleEntries = getExampleEntriesUtil(payload).map(({ key, value }) => ({
      key: key.trim(),
      value: value.trim()
    }));

    this.formModel.exampleEntries = this.normalizeExampleEntries(exampleEntries);

    this.secondaryHeaderDraft = '';
    this.listItemDraft = '';
    this.jointFieldDraft = '';
    this.duplicateFieldDraft = '';

    this.ensureCollections();

    const tableSuggestion = this.buildAdvancedTableSuggestion(payload, dataType);
    if (tableSuggestion) {
      this.applyAdvancedTableSuggestion(tableSuggestion);
    } else {
      this.syncAdvancedTableFromRule();
    }
    if (normalizedDataType !== this.normalizeDataType('Lista')) {
      this.syncListTableHeader();
    }
    this.syncComplexListDraftRow();
    this.syncDependencyDraftRow();
  }

  private generateSuggestionId(): string {
    return `ai-suggestion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildAdvancedTableSuggestion(
    payload: RulePayload,
    dataType: string
  ): { columns: string[]; rows: Array<Record<string, string>> } | null {
    const key = this.getAdvancedConfigKey(dataType);
    if (!key) {
      return null;
    }

    const config = payload['Regla'];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }

    const source = (config as Record<string, unknown>)[key];
    const rows = this.toAdvancedTableRows(source);
    const columns = this.extractAdvancedColumns(rows)
      .map((column) => column.trim())
      .filter((column, index, array) => column.length > 0 && array.indexOf(column) === index);

    if (columns.length === 0 || rows.length === 0) {
      return null;
    }

    const normalizedRows = rows
      .map((row) => this.fillAdvancedRow(row, columns))
      .map((row) => {
        const normalized: Record<string, string> = {};
        columns.forEach((column) => {
          normalized[column] = (row[column] ?? '').trim();
        });
        return normalized;
      })
      .filter((row) => columns.some((column) => row[column].length > 0));

    if (normalizedRows.length === 0) {
      return null;
    }

    return {
      columns,
      rows: normalizedRows.map((row) => ({ ...row }))
    };
  }

  private applyAdvancedTableSuggestion(data: {
    columns: string[];
    rows: Array<Record<string, string>>;
  }): void {
    const key = this.getAdvancedConfigKey(this.formModel.dataType);
    if (!key) {
      this.syncAdvancedTableFromRule();
      return;
    }

    this.advancedTableColumns = [...data.columns];
    this.advancedTableRows = data.rows.map((row) => this.fillAdvancedRow({ ...row }, data.columns));
    this.advancedColumnDraft = '';
    this.advancedConfigError = null;

    this.updateAdvancedRuleConfigFromTable();
    this.syncComplexListDraftRow();
  }

  private buildSubmissionPayload(
    primaryHeader: string,
    secondaryHeaders: string[],
    exampleEntries: Array<{ key: string; value: string }>
  ): RulePayload {
    const base = this.referencePayload ? this.clonePayload(this.referencePayload) : this.createBaselinePayload();
    const headers = [primaryHeader, ...secondaryHeaders];
    const example = this.buildExampleFromEntries(exampleEntries);
    const config = this.normalizeManualRuleConfig(
      JSON.parse(JSON.stringify(this.formModel.ruleConfig)) as Record<string, unknown>,
      this.formModel.dataType
    );

    base['Nombre de la regla'] = this.formModel.name.trim();
    base['Tipo de dato'] = this.formModel.dataType;
    base['Campo obligatorio'] = this.formModel.mandatory;
    base['Descripción'] = this.formModel.description.trim();
    base.Header = headers;
    base['Mensaje de error'] = this.referenceErrorMessage;
    base['Ejemplo'] = example;
    base['Regla'] = config;

    const headerRule = this.resolveHeaderRule(headers);
    base['Header rule'] = headerRule;
    this.headerRuleReference = [...headerRule];

    return base;
  }

  private clonePayload(payload: RulePayload): RulePayload {
    return JSON.parse(JSON.stringify(payload)) as RulePayload;
  }

  private get referenceErrorMessage(): string {
    const message = this.referencePayload?.['Mensaje de error'];
    return typeof message === 'string' && message.trim().length > 0
      ? message
      : this.defaultErrorMessage;
  }

  private createBaselinePayload(): RulePayload {
    const headers = [
      this.formModel.primaryHeader.trim().length > 0 ? this.formModel.primaryHeader.trim() : 'Plantilla Global',
      ...this.formModel.secondaryHeaders
    ]
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

    const example = this.buildExampleFromEntries(
      this.formModel.exampleEntries.map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
    );

    return {
      'Nombre de la regla': this.formModel.name.trim(),
      'Tipo de dato': this.formModel.dataType,
      'Campo obligatorio': this.formModel.mandatory,
      Header: headers,
      'Header rule': this.resolveHeaderRule(headers),
      'Mensaje de error': this.referenceErrorMessage,
      'Descripción': this.formModel.description.trim(),
      'Ejemplo': example,
      'Regla': this.normalizeManualRuleConfig(
        JSON.parse(JSON.stringify(this.formModel.ruleConfig)) as Record<string, unknown>,
        this.formModel.dataType
      )
    };
  }

  private resolveHeaderRule(headers: string[]): string[] {
    const reference = this.uniqueHeaderRuleValues(this.headerRuleReference);
    if (reference.length > 0) {
      return reference;
    }

    return this.uniqueHeaderRuleValues(headers);
  }

  private extractHeaderRule(payload: RulePayload | null): string[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const record = payload as unknown as Record<string, unknown>;
    const keys = ['Header rule', 'header rule', 'Header_rule', 'header_rule', 'HeaderRule', 'headerRule'];
    const collected: string[] = [];

    keys.forEach((key) => {
      if (key in record) {
        this.collectHeaderRuleValues(collected, record[key]);
      }
    });

    return this.uniqueHeaderRuleValues(collected);
  }

  private collectHeaderRuleValues(target: string[], value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectHeaderRuleValues(target, item));
      return;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0 && !target.includes(normalized)) {
        target.push(normalized);
      }
    }
  }

  private uniqueHeaderRuleValues(values: Array<string | unknown>): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    values.forEach((value) => {
      if (typeof value !== 'string') {
        return;
      }

      const normalized = value.trim();
      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      result.push(normalized);
    });

    return result;
  }

  private buildExampleFromEntries(entries: Array<{ key: string; value: string }>): RuleExample {
    return entries.reduce<RuleExample>((acc, entry) => {
      const key = entry.key.trim();
      if (!key) {
        return acc;
      }

      acc[key] = entry.value.trim();
      return acc;
    }, {});
  }

  private normalizeManualRuleConfig(
    config: Record<string, unknown>,
    dataType: string
  ): Record<string, unknown> {
    const clone = config && typeof config === 'object'
      ? JSON.parse(JSON.stringify(config))
      : generateDefaultRuleConfig(dataType);

    const record = clone as Record<string, unknown>;

    switch (dataType) {
      case 'Texto':
        record['Longitud minima'] = this.toNumber(record['Longitud minima'], 0);
        record['Longitud maxima'] = this.toNumber(record['Longitud maxima'], 0);
        break;
      case 'Número':
        record['Valor mínimo'] = this.toNumber(record['Valor mínimo'], null);
        record['Valor máximo'] = this.toNumber(record['Valor máximo'], null);
        record['Número de decimales'] = this.toNumber(record['Número de decimales'], 0);
        break;
      case 'Documento':
        record['Longitud minima'] = this.toNumber(record['Longitud minima'], 1);
        record['Longitud maxima'] = this.toNumber(record['Longitud maxima'], 1);
        break;
      case 'Lista': {
        const values = Array.isArray(record['Lista'])
          ? (record['Lista'] as unknown[])
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
          : [];
        record['Lista'] = values;
        break;
      }
      case 'Lista compleja':
        record['Lista compleja'] = Array.isArray(record['Lista compleja'])
          ? (record['Lista compleja'] as unknown[])
          : [];
        break;
      case 'Telefono':
        record['Longitud minima'] = this.toNumber(record['Longitud minima'], 1);
        record['Código de país'] = this.sanitizeString(record['Código de país']) ?? '+00';
        break;
      case 'Correo':
        record['Formato'] = this.sanitizeString(record['Formato']) ?? 'usuario@dominio.com';
        record['Longitud máxima'] = this.toNumber(record['Longitud máxima'], 1);
        break;
      case 'Fecha':
        record['Formato'] = this.sanitizeString(record['Formato']) ?? 'yyyy-MM-dd';
        record['Fecha mínima'] = this.sanitizeString(record['Fecha mínima']) ?? '1900-01-01';
        record['Fecha máxima'] = this.sanitizeString(record['Fecha máxima']) ?? '2100-12-31';
        break;
      case 'Dependencia':
        record['reglas especifica'] = Array.isArray(record['reglas especifica'])
          ? (record['reglas especifica'] as unknown[]).filter((item) => item && typeof item === 'object')
          : [];
        break;
      case 'Validación conjunta': {
        const values = Array.isArray(record['Nombre de campos'])
          ? (record['Nombre de campos'] as unknown[])
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
          : [];
        record['Nombre de campos'] = values;
        break;
      }
      case 'Duplicados': {
        const values = Array.isArray(record['Campos'])
          ? (record['Campos'] as unknown[])
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
          : [];
        record['Campos'] = values;
        record['Ignorar vacios'] = this.toBoolean(record['Ignorar vacios']);
        break;
      }
      default:
        break;
    }

    return record;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return false;
  }

  private toNumber(value: unknown, defaultValue: number | null): number | null {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return defaultValue;
    }

    return numeric;
  }

  private sanitizeString(value: unknown): string | null {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private async postAuthorized<T>(path: string, body: unknown, session: SessionState | null): Promise<T> {
    const snapshot = session ?? (await this.getSessionSnapshot());

    if (!snapshot?.accessToken) {
      throw new Error('No se encontró una sesión activa.');
    }

    const tokenType = snapshot.tokenType ?? 'Bearer';
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${tokenType} ${snapshot.accessToken}`
    });

    return await firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body, { headers }));
  }

  private async getSessionSnapshot(): Promise<SessionState | null> {
    return await firstValueFrom(this.store.select(selectSessionState));
  }

  private isAdmin(session: SessionState | null): boolean {
    if (!session) {
      return false;
    }

    return (session.role ?? '').toLowerCase() === 'admin';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      if (error.error?.detail) {
        return String(error.error.detail);
      }

      if (error.message) {
        return error.message;
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Ocurrió un error inesperado al consultar el asistente.';
  }

  private createEmptyForm(): ValidationRuleFormDialogResult {
    return {
      name: 'Nueva Regla de Validación',
      dataType: 'Texto',
      mandatory: false,
      status: 'Activa',
      description: 'Describe la regla para que otros usuarios entiendan su propósito.',
      primaryHeader: 'Plantilla Global',
      secondaryHeaders: [],
      exampleEntries: this.createDefaultExamples(),
      ruleConfig: this.createDefaultRuleConfig('Texto')
    };
  }

  private cloneRule(rule: ValidationRuleFormDialogResult): ValidationRuleFormDialogResult {
    return {
      ...rule,
      primaryHeader: typeof rule.primaryHeader === 'string' ? rule.primaryHeader : 'Plantilla Global',
      secondaryHeaders: [...(rule.secondaryHeaders ?? [])],
      exampleEntries: this.normalizeExampleEntries(rule.exampleEntries ?? []),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig ?? {})) as Record<string, unknown>
    };
  }

  private ensureCollections(): void {
    if (typeof this.formModel.primaryHeader !== 'string') {
      this.formModel.primaryHeader = 'Plantilla Global';
    }

    if (!Array.isArray(this.formModel.secondaryHeaders)) {
      this.formModel.secondaryHeaders = [];
    }

    this.ensureExampleEntries();
  }

  private syncListTableHeader(source?: string | null): void {
    if (!this.isDataType('Lista')) {
      this.listTableHeader = this.defaultListTableHeader;
      return;
    }

    const fallback = typeof source === 'string' ? source.trim() : this.formModel.primaryHeader.trim();
    this.listTableHeader = fallback.length > 0 ? fallback : this.defaultListTableHeader;
  }

  private getAdvancedConfigKey(dataType: string): 'Lista compleja' | null {
    if (this.normalizeDataType(dataType) === this.normalizeDataType('Lista compleja')) {
      return 'Lista compleja';
    }

    return null;
  }

  private syncAdvancedTableFromRule(): void {
    const key = this.getAdvancedConfigKey(this.formModel.dataType);
    if (!key) {
      this.advancedTableColumns = [];
      this.advancedTableRows = [];
      this.advancedColumnDraft = '';
      this.advancedConfigError = null;
      this.syncComplexListDraftRow();
      return;
    }

    const source = this.formModel.ruleConfig[key];
    const rows = this.toAdvancedTableRows(source);
    let columns = this.extractAdvancedColumns(rows);

    if (this.isDataType('Lista compleja')) {
      const headerColumns = this.getHeaderColumnsFromForm();
      if (headerColumns.length > 0) {
        columns = headerColumns;
      }
    }

    this.advancedTableColumns = columns;
    this.advancedTableRows = rows.map((row) => this.fillAdvancedRow(row, columns));
    this.advancedColumnDraft = '';
    this.advancedConfigError = null;

    this.updateAdvancedRuleConfigFromTable();
    this.syncComplexListDraftRow();
  }

  private toAdvancedTableRows(value: unknown): Array<Record<string, string>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item) => {
        const record: Record<string, string> = {};
        Object.entries(item).forEach(([key, cell]) => {
          const header = typeof key === 'string' ? key.trim() : '';
          if (!header) {
            return;
          }

          const text = this.stringifyExampleValue(cell).trim();
          if (text.length === 0 || text === '—') {
            return;
          }

          record[header] = text;
        });

        return Object.values(record).some((value) => value.trim().length > 0) ? record : null;
      })
      .filter((record): record is Record<string, string> => Boolean(record));
  }

  private extractAdvancedColumns(rows: Array<Record<string, string>>): string[] {
    const collected: string[] = [];
    const append = (label: string): void => {
      const header = label.trim();
      if (!header) {
        return;
      }

      const exists = collected.some((column) => column.toLowerCase() === header.toLowerCase());
      if (!exists) {
        collected.push(header);
      }
    };

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => append(key));
    });

    const preferred = this.getPreferredAdvancedColumns();
    const ordered = this.orderAdvancedColumns(preferred, collected);

    return ordered.length > 0 ? ordered : preferred;
  }

  private getPreferredAdvancedColumns(): string[] {
    const headers = [...this.formModel.secondaryHeaders]
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    const unique: string[] = [];
    headers.forEach((header) => {
      const exists = unique.some((item) => item.toLowerCase() === header.toLowerCase());
      if (!exists) {
        unique.push(header);
      }
    });

    return unique;
  }

  private orderAdvancedColumns(preferred: string[], columns: string[]): string[] {
    const normalize = (value: string): string => value.trim().toLowerCase();
    const result: string[] = [];
    const seen = new Set<string>();

    const append = (label: string): void => {
      const text = label.trim();
      if (!text) {
        return;
      }

      const key = normalize(text);
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      result.push(text);
    };

    preferred.forEach((label) => {
      const match = columns.find((column) => normalize(column) === normalize(label));
      append(match ?? label);
    });

    columns.forEach((column) => append(column));

    return result;
  }

  private fillAdvancedRow(row: Record<string, string>, columns: string[]): Record<string, string> {
    return columns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = row[column] ?? '';
      return acc;
    }, {});
  }

  private getHeaderColumnsFromForm(): string[] {
    const values = [this.formModel.primaryHeader, ...(this.formModel.secondaryHeaders ?? [])];

    return values
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
  }

  private updateAdvancedRuleConfigFromTable(): void {
    const key = this.getAdvancedConfigKey(this.formModel.dataType);
    if (!key) {
      return;
    }

    const entries = this.advancedTableRows
      .map((row) => {
        const record: Record<string, string> = {};
        this.advancedTableColumns.forEach((column) => {
          const value = (row[column] ?? '').trim();
          if (value.length > 0) {
            record[column] = value;
          }
        });
        return record;
      })
      .filter((record) => Object.keys(record).length > 0);

    this.formModel.ruleConfig[key] = entries;
  }

  private getRawListValues(): string[] {
    const values = this.formModel.ruleConfig['Lista'];
    if (!Array.isArray(values)) {
      return [];
    }

    return values.map((item) => this.stringifyExampleValue(item));
  }

  private getDependencyRules(): Array<Record<string, unknown>> {
    const config = this.formModel.ruleConfig;
    if (!config || typeof config !== 'object') {
      return [];
    }

    const source = (config as Record<string, unknown>)['reglas especifica'];
    if (!Array.isArray(source)) {
      return [];
    }

    return source.filter((item): item is Record<string, unknown> => this.isPlainObject(item));
  }

  private collectDependencyColumnsFromRules(): string[] {
    const collected: string[] = [];
    const rules = this.getDependencyRules();

    rules.forEach((rule) => this.collectColumnsFromRecord(rule, collected));

    return collected;
  }

  private collectColumnsFromRecord(record: Record<string, unknown>, collected: string[]): void {
    Object.entries(record).forEach(([key, value]) => {
      const label = typeof key === 'string' ? key.trim() : '';
      if (label && !this.isPlainObject(value)) {
        const exists = collected.some((item) => item.toLowerCase() === label.toLowerCase());
        if (!exists) {
          collected.push(label);
        }
      }

      if (this.isPlainObject(value)) {
        this.collectColumnsFromRecord(value as Record<string, unknown>, collected);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (this.isPlainObject(item)) {
            this.collectColumnsFromRecord(item as Record<string, unknown>, collected);
          }
        });
      }
    });
  }

  private syncComplexListDraftRow(preserveValues = true): void {
    if (!this.isDataType('Lista compleja')) {
      this.complexListDraftRow = {};
      return;
    }

    const previous = preserveValues ? this.complexListDraftRow : {};
    this.complexListDraftRow = this.complexListColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = previous[column] ?? '';
      return acc;
    }, {});
  }

  private syncDependencyDraftRow(preserveValues = true): void {
    if (!this.isDataType('Dependencia')) {
      this.dependencyDraftRow = {};
      return;
    }

    const previous = preserveValues ? this.dependencyDraftRow : {};
    const columns = this.dependencyTableColumns;
    this.dependencyDraftRow = columns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = previous[column] ?? '';
      return acc;
    }, {});
  }

  private isDataType(...types: string[]): boolean {
    const current = this.normalizeDataType(this.formModel.dataType);
    return types.some((type) => this.normalizeDataType(type) === current);
  }

  private normalizeDataType(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private extractFileFromEvent(event: Event): File | null {
    const input = event.target as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) {
      return null;
    }

    return input.files[0] ?? null;
  }

  private async readExcelRows(file: File): Promise<string[][]> {
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('El archivo no contiene hojas.');
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
        return [this.stringifyExampleValue(row)];
      }

      return row.map((cell) => this.stringifyExampleValue(cell));
    });
  }

  private buildListValuesFromRows(rows: string[][]): string[] {
    if (rows.length === 0) {
      return [];
    }

    const headers = (rows[0] ?? []).map((cell) => cell.trim());
    const expected = this.listTableHeader.trim().toLowerCase();
    let columnIndex = headers.findIndex((header) => header.toLowerCase() === expected);
    if (columnIndex < 0) {
      columnIndex = 0;
    }

    const values = rows
      .slice(1)
      .map((row) => row[columnIndex] ?? '')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    const unique: string[] = [];
    values.forEach((value) => {
      if (!unique.includes(value)) {
        unique.push(value);
      }
    });

    return unique;
  }

  private buildComplexListRowsFromExcel(rows: string[][]): Array<Record<string, string>> {
    const columns = this.advancedTableColumns;
    if (columns.length === 0) {
      return [];
    }

    if (rows.length === 0) {
      return [];
    }

    const headers = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
    const indexes = columns.map((column) => headers.findIndex((header) => header === column.trim().toLowerCase()));

    if (indexes.some((index) => index === -1)) {
      throw new Error('Las columnas del archivo no coinciden con la configuración actual.');
    }

    return rows
      .slice(1)
      .map((row) => {
        const record: Record<string, string> = {};
        columns.forEach((column, columnIndex) => {
          const sourceIndex = indexes[columnIndex];
          const value = sourceIndex >= 0 ? row[sourceIndex] ?? '' : '';
          record[column] = (value ?? '').trim();
        });
        return record;
      })
      .filter((record) => columns.some((column) => (record[column] ?? '').length > 0));
  }

  private buildDependencyRowsFromExcel(rows: string[][]): Array<Record<string, string>> {
    const columns = this.dependencyTableColumns;
    if (columns.length === 0) {
      throw new Error('No hay encabezados configurados para las dependencias.');
    }

    if (rows.length === 0) {
      return [];
    }

    const headers = (rows[0] ?? []).map((cell) => cell.trim().toLowerCase());
    const indexes = columns.map((column) => headers.findIndex((header) => header === column.trim().toLowerCase()));

    if (indexes.some((index) => index === -1)) {
      throw new Error('El archivo no contiene todos los encabezados requeridos.');
    }

    return rows
      .slice(1)
      .map((row) => {
        const record: Record<string, string> = {};
        columns.forEach((column, columnIndex) => {
          const sourceIndex = indexes[columnIndex];
          const value = sourceIndex >= 0 ? row[sourceIndex] ?? '' : '';
          const text = (value ?? '').trim();
          if (text.length > 0) {
            record[column] = text;
          }
        });
        return record;
      })
      .filter((record) => Object.keys(record).length > 0);
  }

  private downloadExcelTemplate(fileName: string, headers: string[]): void {
    const sanitized = headers
      .map((header) => (typeof header === 'string' ? header.trim() : ''))
      .filter((header, index, array) => header.length > 0 && array.indexOf(header) === index);

    if (sanitized.length === 0) {
      return;
    }

    const workbook = utils.book_new();
    const sheet = utils.aoa_to_sheet([sanitized]);
    utils.book_append_sheet(workbook, sheet, 'Plantilla');
    writeFileXLSX(workbook, fileName);
  }

  private resetFileInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  private buildDependencyRow(
    record: Record<string, unknown>,
    columns: string[]
  ): Record<string, string> {
    return columns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = this.findDependencyValue(record, column);
      return acc;
    }, {});
  }

  private findDependencyValue(record: Record<string, unknown>, header: string): string {
    const target = header.trim().toLowerCase();
    if (!target) {
      return '';
    }

    const visited = new Set<unknown>();
    const queue: unknown[] = [record];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') {
        continue;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      if (Array.isArray(current)) {
        current.forEach((item) => {
          if (item && typeof item === 'object') {
            queue.push(item);
          }
        });
        continue;
      }

      for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
        const label = typeof key === 'string' ? key.trim().toLowerCase() : '';
        if (label === target) {
          return this.stringifyExampleValue(value).trim();
        }

        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }

    return '';
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private createDefaultRuleConfig(dataType: string): Record<string, unknown> {
    return generateDefaultRuleConfig(dataType);
  }

  private ensureExampleEntries(): void {
    const entries = Array.isArray(this.formModel.exampleEntries)
      ? this.formModel.exampleEntries
      : [];

    this.formModel.exampleEntries = this.normalizeExampleEntries(entries);
  }

  private normalizeExampleEntries(
    entries: Array<{ key: unknown; value: unknown }>
  ): Array<{ key: string; value: string }> {
    const defaults = this.createDefaultExamples();
    const sanitized = entries
      .map((entry) => ({
        key: typeof entry?.key === 'string' ? entry.key.trim() : '',
        value:
          typeof entry?.value === 'string' && entry.value.trim().length > 0
            ? this.formatExampleValue(entry.value.trim())
            : ''
      }))
      .filter((entry) => entry.key.length > 0 || entry.value.length > 0);

    const normalizeKey = (text: string): string =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const validEntry = sanitized.find((entry) => normalizeKey(entry.key).includes('valido'));
    const invalidEntry = sanitized.find((entry) => normalizeKey(entry.key).includes('invalido'));
    const fallback = sanitized.filter((entry) => entry !== validEntry && entry !== invalidEntry);

    return [
      {
        key: defaults[0].key,
        value: validEntry?.value ?? sanitized[0]?.value ?? ''
      },
      {
        key: defaults[1].key,
        value: invalidEntry?.value ?? fallback[0]?.value ?? sanitized[1]?.value ?? ''
      }
    ];
  }

  private formatExampleValue(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (!/^[\[{]/.test(trimmed)) {
      return value;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const entries = parsed
          .map((item) => this.formatExampleValueFromObject(item))
          .filter((item) => item.length > 0);
        return entries.join('\n\n');
      }

      if (parsed && typeof parsed === 'object') {
        return this.formatExampleValueFromObject(parsed);
      }
    } catch (error) {
      console.warn('[ValidationRuleFormDialog] No se pudo formatear el ejemplo como JSON legible:', error);
      return value;
    }

    return value;
  }

  private formatExampleValueFromObject(record: unknown): string {
    if (!record || typeof record !== 'object') {
      return '';
    }

    const entries = Object.entries(record as Record<string, unknown>)
      .map(([key, cell]) => {
        const label = key.trim();
        if (!label) {
          return '';
        }

        const text = this.stringifyExampleValue(cell).trim();
        return text.length > 0 ? `• ${label}: ${text}` : `• ${label}`;
      })
      .filter((line) => line.length > 0);

    return entries.join('\n');
  }

  private stringifyExampleValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.stringifyExampleValue(item))
        .filter((item) => item.length > 0)
        .join(', ');
    }

    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => {
          const label = key.trim();
          const text = this.stringifyExampleValue(item).trim();
          return label.length > 0 ? `${label}${text ? `: ${text}` : ''}` : text;
        })
        .filter((entry) => entry.length > 0)
        .join(', ');
    }

    return String(value);
  }

  private createDefaultExamples(): Array<{ key: string; value: string }> {
    return [
      { key: 'Ejemplo válido', value: '' },
      { key: 'Ejemplo inválido', value: '' }
    ];
  }
}
