import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { selectSessionState, SessionState } from '../core/store/session/session.reducer';
import {
  VALIDATION_RULE_AI_SCHEMA,
  RulePayload,
  describeRuleConfig as describeRuleConfigUtil,
  extractAiPayloads,
  generateDefaultRuleConfig,
  getExampleEntries as getExampleEntriesUtil,
  normalizeAiPayload
} from './validation-rule-ai.utils';

export interface ValidationRuleFormDialogResult {
  name: string;
  dataType: string;
  mandatory: boolean;
  errorMessage: string;
  status: 'Activa' | 'Inactiva';
  documentType: string;
  description: string;
  secondaryHeaders: string[];
  exampleEntries: Array<{ key: string; value: string }>;
  ruleConfig: Record<string, unknown>;
}

export interface ValidationRuleFormDialogData {
  mode: 'create' | 'edit';
  rule?: ValidationRuleFormDialogResult;
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

  protected secondaryHeaderDraft = '';
  protected listItemDraft = '';
  protected jointFieldDraft = '';
  protected duplicateFieldDraft = '';
  protected advancedConfigError: string | null = null;
  protected advancedUploadError: string | null = null;
  protected advancedTableHeaders: string[] = [];
  protected advancedTableRows: Array<Record<string, string>> = [];

  protected aiPrompt = '';
  protected aiIsLoading = false;
  protected aiError: string | null = null;
  protected aiSuggestions: AiSuggestion[] = [];
  protected selectedAiSuggestionId: string | null = null;

  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly aiRuleSchema = VALIDATION_RULE_AI_SCHEMA;

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
    this.ensureCollections();
    this.syncAdvancedTableFromRule();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (!this.canSave) {
      return;
    }

    const documentType = this.formModel.documentType.trim() || 'Plantilla Global';
    const secondaryHeaders = this.formModel.secondaryHeaders
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index && item !== documentType);

    const exampleEntries = this.formModel.exampleEntries.map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim()
    }));

    this.formModel.exampleEntries = exampleEntries.map((entry) => ({ ...entry }));

    const result: ValidationRuleFormDialogResult = {
      ...this.formModel,
      name: this.formModel.name.trim(),
      errorMessage: this.formModel.errorMessage.trim(),
      description: this.formModel.description.trim(),
      documentType,
      secondaryHeaders,
      exampleEntries,
      ruleConfig: JSON.parse(JSON.stringify(this.formModel.ruleConfig)) as Record<string, unknown>
    };

    this.dialogRef.close(result);
  }

  protected get canSave(): boolean {
    if (!this.formModel.name.trim() || !this.formModel.errorMessage.trim()) {
      return false;
    }

    if (!this.formModel.documentType.trim()) {
      return false;
    }

    if (!this.formModel.exampleEntries.every((entry) => entry.value.trim().length > 0)) {
      return false;
    }

    if (this.advancedConfigError) {
      return false;
    }

    switch (this.formModel.dataType) {
      case 'Lista':
        return this.listValues.length > 0;
      case 'Lista compleja':
      case 'Dependencia':
        return this.advancedTableHeaders.length > 0 && this.hasAdvancedTableValues;
      case 'Validación conjunta':
        return this.jointFieldValues.length > 0;
      case 'Duplicados':
        return this.duplicateFieldValues.length > 0;
      default:
        return true;
    }
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
    this.advancedUploadError = null;
    this.syncAdvancedTableFromRule();
  }

  protected addSecondaryHeader(): void {
    const value = this.secondaryHeaderDraft.trim();
    if (!value) {
      return;
    }

    if (!this.formModel.secondaryHeaders.includes(value) && value !== this.formModel.documentType.trim()) {
      this.formModel.secondaryHeaders.push(value);
    }

    this.secondaryHeaderDraft = '';
  }

  protected removeSecondaryHeader(index: number): void {
    this.formModel.secondaryHeaders.splice(index, 1);
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
  }

  protected removeListValue(index: number): void {
    const values = this.listValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Lista'] = values;
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

  protected toggleIgnoreEmpty(value: boolean): void {
    this.formModel.ruleConfig['Ignorar vacios'] = value;
  }

  protected get listValues(): string[] {
    const values = this.formModel.ruleConfig['Lista'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
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

  protected get requiresAdvancedTableData(): boolean {
    return this.getAdvancedConfigKey(this.formModel.dataType) !== null;
  }

  protected get hasAdvancedTableValues(): boolean {
    return this.advancedTableRows.some((row) =>
      this.advancedTableHeaders.some((column) => (row[column] ?? '').trim().length > 0)
    );
  }

  protected get advancedTableHelper(): string {
    return this.formModel.dataType === 'Dependencia'
      ? 'Define las combinaciones válidas entre los campos dependientes. Cada fila representa una relación permitida.'
      : 'Organiza los elementos de la lista especificando sus atributos en columnas para facilitar su comprensión.';
  }

  protected get advancedTableEmptyMessage(): string {
    return this.formModel.dataType === 'Dependencia'
      ? 'Carga un archivo Excel con las combinaciones permitidas o agrega filas manualmente en la tabla.'
      : 'Carga un archivo Excel con los elementos disponibles o completa las filas manualmente.';
  }

  protected get canUploadAdvancedTable(): boolean {
    return this.formModel.dataType === 'Lista compleja' || this.formModel.dataType === 'Dependencia';
  }

  protected addAdvancedRow(): void {
    if (this.advancedTableHeaders.length === 0) {
      this.advancedConfigError =
        'No hay columnas configuradas. Carga un archivo Excel para establecer los encabezados.';
      return;
    }

    const row = this.advancedTableHeaders.reduce<Record<string, string>>((acc, column) => {
      acc[column] = '';
      return acc;
    }, {});

    this.advancedConfigError = null;
    this.advancedTableRows = [...this.advancedTableRows, row];
    this.updateAdvancedRuleConfigFromTable();
  }

  protected removeAdvancedRow(index: number): void {
    if (index < 0 || index >= this.advancedTableRows.length) {
      return;
    }

    this.advancedConfigError = null;
    this.advancedTableRows = this.advancedTableRows.filter((_, i) => i !== index);
    this.updateAdvancedRuleConfigFromTable();
  }

  protected onAdvancedFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    void this.importAdvancedTableFromFile(file);
    if (input) {
      input.value = '';
    }
  }

  protected onAdvancedCellChange(): void {
    this.advancedConfigError = null;
    this.updateAdvancedRuleConfigFromTable();
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
    return preview ? describeRuleConfigUtil(preview) : [];
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
    this.formModel.errorMessage = typeof payload['Mensaje de error'] === 'string'
      ? payload['Mensaje de error']
      : this.formModel.errorMessage;
    this.formModel.description = typeof payload['Descripción'] === 'string'
      ? payload['Descripción']
      : this.formModel.description;
    this.formModel.documentType = primaryHeader;
    this.formModel.secondaryHeaders = secondaryHeaders;

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
    this.syncAdvancedTableFromRule();
  }

  private generateSuggestionId(): string {
    return `ai-suggestion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
      errorMessage: 'Define el mensaje de error que verán tus usuarios.',
      status: 'Activa',
      documentType: 'Plantilla Global',
      description: 'Describe la regla para que otros usuarios entiendan su propósito.',
      secondaryHeaders: [],
      exampleEntries: this.createDefaultExamples(),
      ruleConfig: this.createDefaultRuleConfig('Texto')
    };
  }

  private cloneRule(rule: ValidationRuleFormDialogResult): ValidationRuleFormDialogResult {
    return {
      ...rule,
      secondaryHeaders: [...(rule.secondaryHeaders ?? [])],
      exampleEntries: this.normalizeExampleEntries(rule.exampleEntries ?? []),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig ?? {})) as Record<string, unknown>
    };
  }

  private ensureCollections(): void {
    if (!Array.isArray(this.formModel.secondaryHeaders)) {
      this.formModel.secondaryHeaders = [];
    }

    this.ensureExampleEntries();
  }

  private getAdvancedConfigKey(dataType: string): 'Lista compleja' | 'reglas especifica' | null {
    if (dataType === 'Lista compleja') {
      return 'Lista compleja';
    }

    if (dataType === 'Dependencia') {
      return 'reglas especifica';
    }

    return null;
  }

  private syncAdvancedTableFromRule(): void {
    const key = this.getAdvancedConfigKey(this.formModel.dataType);
    if (!key) {
      this.advancedTableHeaders = [];
      this.advancedTableRows = [];
      this.advancedConfigError = null;
      this.advancedUploadError = null;
      return;
    }

    const source = this.formModel.ruleConfig[key];
    const { headers, rows } = this.toAdvancedTableState(source);

    this.advancedTableHeaders = headers;
    this.advancedTableRows = rows.map((row) => this.fillAdvancedRow(row, headers));
    this.advancedConfigError = null;
    this.advancedUploadError = null;

    this.updateAdvancedRuleConfigFromTable();
  }

  private toAdvancedTableState(value: unknown): {
    headers: string[];
    rows: Array<Record<string, string>>;
  } {
    if (!value) {
      return { headers: [], rows: [] };
    }

    if (Array.isArray(value)) {
      const rows = this.toAdvancedTableRowsFromArray(value);
      const headers = this.extractAdvancedHeadersFromRows(rows);
      return { headers, rows };
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const headers = Array.isArray(record['headers'])
        ? (record['headers'] as unknown[])
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
        : [];

      const rowsSource = record['rows'] ?? record['values'] ?? record['data'];
      const rows = this.toAdvancedTableRowsFromArray(rowsSource);

      if (headers.length === 0) {
        const inferredHeaders = this.extractAdvancedHeadersFromRows(rows);
        return { headers: inferredHeaders, rows };
      }

      return { headers, rows: rows.map((row) => this.fillAdvancedRow(row, headers)) };
    }

    return { headers: [], rows: [] };
  }

  private toAdvancedTableRowsFromArray(value: unknown): Array<Record<string, string>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.normalizeAdvancedRow(item))
      .filter((row): row is Record<string, string> => row !== null);
  }

  private normalizeAdvancedRow(value: unknown): Record<string, string> | null {
    if (!value) {
      return null;
    }

    if (Array.isArray(value)) {
      const record: Record<string, string> = {};
      value.forEach((cell, index) => {
        record[`Columna ${index + 1}`] = this.stringifyExampleValue(cell).trim();
      });
      return record;
    }

    if (typeof value === 'object') {
      const record: Record<string, string> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, cell]) => {
        const header = typeof key === 'string' ? key.trim() : '';
        if (!header) {
          return;
        }

        const text = this.stringifyExampleValue(cell).trim();
        record[header] = text;
      });
      return record;
    }

    return null;
  }

  private extractAdvancedHeadersFromRows(rows: Array<Record<string, string>>): string[] {
    const columns = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const header = key.trim();
        if (header.length > 0) {
          columns.add(header);
        }
      });
    });

    return Array.from(columns);
  }

  private fillAdvancedRow(row: Record<string, string>, columns: string[]): Record<string, string> {
    return columns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = row[column] ?? '';
      return acc;
    }, {});
  }

  private updateAdvancedRuleConfigFromTable(): void {
    const key = this.getAdvancedConfigKey(this.formModel.dataType);
    if (!key) {
      return;
    }

    const entries = this.advancedTableRows
      .map((row) => {
        const record: Record<string, string> = {};
        this.advancedTableHeaders.forEach((column) => {
          const value = (row[column] ?? '').trim();
          if (value.length > 0) {
            record[column] = value;
          }
        });
        return record;
      })
      .filter((record) => Object.keys(record).length > 0);

    this.formModel.ruleConfig[key] = {
      headers: [...this.advancedTableHeaders],
      values: entries,
      rows: entries
    };
  }

  private async importAdvancedTableFromFile(file: File): Promise<void> {
    try {
      this.advancedConfigError = null;
      this.advancedUploadError = null;

      const buffer = await file.arrayBuffer();
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        this.advancedUploadError = 'El archivo no contiene hojas válidas.';
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        defval: ''
      });

      if (!Array.isArray(rows) || rows.length === 0) {
        this.advancedUploadError = 'El archivo no contiene datos.';
        return;
      }

      const [headerRowRaw, ...dataRows] = rows;
      const headerRow = (headerRowRaw ?? []).map((cell) => this.stringifyExampleValue(cell).trim());
      const headers = headerRow.filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);

      if (headers.length === 0) {
        this.advancedUploadError = 'No se pudieron determinar los encabezados del archivo.';
        return;
      }

      if (this.advancedTableHeaders.length > 0) {
        const normalizedExisting = this.advancedTableHeaders.map((item) => item.toLowerCase());
        const normalizedIncoming = headers.map((item) => item.toLowerCase());

        const matches =
          normalizedExisting.length === normalizedIncoming.length &&
          normalizedExisting.every((header, index) => header === normalizedIncoming[index]);

        if (!matches) {
          this.advancedUploadError =
            'Los encabezados del archivo no coinciden con la configuración de la regla.';
          return;
        }
      }

      const effectiveHeaders = this.advancedTableHeaders.length > 0 ? this.advancedTableHeaders : headers;
      const parsedRows = dataRows
        .map((cells) => {
          const record = effectiveHeaders.reduce<Record<string, string>>((acc, header, index) => {
            const cell = Array.isArray(cells) ? cells[index] : undefined;
            acc[header] = this.stringifyExampleValue(cell).trim();
            return acc;
          }, {});

          return record;
        })
        .filter((record) =>
          effectiveHeaders.some((header) => (record[header] ?? '').trim().length > 0)
        );

      this.advancedTableHeaders = [...effectiveHeaders];
      this.advancedTableRows = parsedRows.map((row) => this.fillAdvancedRow(row, effectiveHeaders));

      this.updateAdvancedRuleConfigFromTable();
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al importar archivo Excel:', error);
      this.advancedUploadError = 'No se pudo procesar el archivo seleccionado.';
    }
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
