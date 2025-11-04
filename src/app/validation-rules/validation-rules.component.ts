import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import {
  ValidationRuleFormDialogComponent,
  ValidationRuleFormDialogData,
  ValidationRuleFormDialogResult
} from './validation-rule-form-dialog.component';
import {
  ValidationRuleDeleteDialogComponent,
  ValidationRuleDeleteDialogData
} from './validation-rule-delete-dialog.component';
import { environment } from '../../environments/environment';
import { selectSessionState, SessionState } from '../core/store/session/session.reducer';
import {
  VALIDATION_RULE_AI_SCHEMA,
  RulePayload,
  RuleExample,
  describeRuleConfig as describeRuleConfigUtil,
  extractAiPayloads,
  generateDefaultRuleConfig as generateDefaultRuleConfigUtil,
  getExampleEntries as getExampleEntriesUtil,
  normalizeAiPayload
} from './validation-rule-ai.utils';

interface AiRuleOption {
  id: string;
  payload: RulePayload;
}

interface ValidationRule {
  id: string;
  name: string;
  dataType: string;
  mandatory: boolean;
  errorMessage: string;
  status: 'Activa' | 'Inactiva';
  documentType: string;
  description: string;
  header: string[];
  example: RuleExample;
  ruleConfig: Record<string, unknown>;
  source: 'manual' | 'ia';
  payload: RulePayload;
}

@Component({
  selector: 'app-validation-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './validation-rules.component.html',
  styleUrl: './validation-rules.component.scss'
})
export class ValidationRulesComponent implements OnInit {
  protected searchTerm = '';

  protected rules: ValidationRule[] = [];
  protected rulesLoading = false;
  protected ruleLoadError: string | null = null;

  protected aiRuleOptions: AiRuleOption[] = [];
  protected selectedAiRuleId: string | null = null;
  protected aiIsLoading = false;
  protected aiError: string | null = null;
  protected hasAiFetched = false;
  protected assistantPanelOpen = false;

  protected ruleSyncError: string | null = null;

  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  private readonly aiRuleSchema = VALIDATION_RULE_AI_SCHEMA;

  constructor(
    private readonly dialog: MatDialog,
    private readonly http: HttpClient,
    private readonly store: Store
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadRules();
  }

  private async loadRules(): Promise<void> {
    if (this.rulesLoading) {
      return;
    }

    this.rulesLoading = true;
    this.ruleLoadError = null;

    try {
      const session = await this.getSessionSnapshot();
      const headers = this.buildAuthHeaders(session);
      const data = await firstValueFrom(
        this.http.get<unknown>(`${this.baseUrl}/rules`, { headers })
      );

      this.rules = this.parseRuleListResponse(data);
    } catch (error) {
      console.error('[ValidationRules] Error al obtener las reglas:', error);
      this.ruleLoadError = this.getErrorMessage(error);
      this.rules = [];
    } finally {
      this.rulesLoading = false;
    }
  }

  protected get filteredRules(): ValidationRule[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.rules;
    }

    return this.rules.filter((rule) => {
      return (
        rule.name.toLowerCase().includes(term) ||
        rule.dataType.toLowerCase().includes(term) ||
        rule.status.toLowerCase().includes(term) ||
        rule.documentType.toLowerCase().includes(term)
      );
    });
  }

  protected get totalRules(): number {
    return this.rules.length;
  }

  protected get activeRules(): number {
    return this.rules.filter((rule) => rule.status === 'Activa').length;
  }

  protected get dataTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.dataType)).size;
  }

  protected get documentTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.documentType)).size;
  }

  protected get selectedAiRule(): AiRuleOption | undefined {
    if (this.selectedAiRuleId) {
      return this.aiRuleOptions.find((option) => option.id === this.selectedAiRuleId);
    }

    return this.aiRuleOptions[0];
  }

  private parseRuleListResponse(data: unknown): ValidationRule[] {
    if (Array.isArray(data)) {
      return data
        .map((item) => this.parseRuleItem(item))
        .filter((rule): rule is ValidationRule => rule !== null);
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const collectionKeys = ['items', 'rules', 'data'];

      for (const key of collectionKeys) {
        const collection = record[key];
        if (Array.isArray(collection)) {
          return collection
            .map((item) => this.parseRuleItem(item))
            .filter((rule): rule is ValidationRule => rule !== null);
        }
      }

      const single = this.parseRuleItem(record);
      return single ? [single] : [];
    }

    return [];
  }

  private parseRuleItem(entry: unknown): ValidationRule | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const payloadCandidate = record['payload'] ?? record['rule'] ?? entry;
    const payload = this.tryCoercePayload(payloadCandidate);

    if (!payload) {
      return null;
    }

    const status = this.toStatus(record['status']);
    const source = this.toSource(record['source']);
    const id = this.sanitizeString(record['id']) ?? this.generateId();

    return this.buildRuleFromPayload(payload, status, source, id);
  }

  private tryCoercePayload(value: unknown): RulePayload | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const name = this.sanitizeString(record['Nombre de la regla']);
    const dataType = this.sanitizeString(record['Tipo de dato']);
    const errorMessage = this.sanitizeString(record['Mensaje de error']);
    const description = this.sanitizeString(record['Descripción']) ?? '';

    if (!name || !dataType || !errorMessage) {
      return null;
    }

    const headerSource = record['Header'];
    const header = Array.isArray(headerSource)
      ? (headerSource as unknown[])
          .map((item) => this.sanitizeString(item))
          .filter((item): item is string => Boolean(item))
      : [];

    if (header.length === 0) {
      header.push('Plantilla Global');
    }

    const example =
      record['Ejemplo'] && typeof record['Ejemplo'] === 'object' && !Array.isArray(record['Ejemplo'])
        ? (record['Ejemplo'] as RuleExample)
        : {};

    const ruleConfig =
      record['Regla'] && typeof record['Regla'] === 'object' && !Array.isArray(record['Regla'])
        ? (record['Regla'] as Record<string, unknown>)
        : {};

    const mandatorySource = record['Campo obligatorio'];
    const mandatory = typeof mandatorySource === 'boolean' ? mandatorySource : this.toBoolean(mandatorySource);

    return {
      'Nombre de la regla': name,
      'Tipo de dato': dataType,
      'Campo obligatorio': mandatory,
      Header: header,
      'Mensaje de error': errorMessage,
      'Descripción': description,
      'Ejemplo': example,
      'Regla': ruleConfig
    };
  }

  private toStatus(value: unknown): ValidationRule['status'] {
    const text = this.sanitizeString(value)?.toLowerCase();
    return text === 'inactiva' || text === 'borrador' ? 'Inactiva' : 'Activa';
  }

  private toSource(value: unknown): 'manual' | 'ia' {
    const text = this.sanitizeString(value)?.toLowerCase();
    return text === 'ia' ? 'ia' : 'manual';
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogData,
      ValidationRuleFormDialogResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
      width: '92vw',
      maxWidth: '1240px',
      maxHeight: '95vh',
      panelClass: 'validation-rule-dialog',
      data: {
        mode: 'create'
      }
    });

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addRule(result);
    });
  }

  protected openEditDialog(rule: ValidationRule): void {
    const dialogRef = this.dialog.open<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogData,
      ValidationRuleFormDialogResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
      width: '92vw',
      maxWidth: '1240px',
      maxHeight: '95vh',
      panelClass: 'validation-rule-dialog',
      data: {
        mode: 'edit',
        rule: this.toDialogResult(rule)
      }
    });

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.updateRule(rule.id, result);
    });
  }

  protected openDeleteDialog(rule: ValidationRule): void {
    const dialogRef = this.dialog.open<
      ValidationRuleDeleteDialogComponent,
      ValidationRuleDeleteDialogData,
      boolean
    >(ValidationRuleDeleteDialogComponent, {
      disableClose: true,
      data: {
        name: rule.name,
        documentType: rule.documentType
      }
    });

    dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
      if (!shouldDelete) {
        return;
      }

      this.removeRule(rule.id);
    });
  }

  protected trackByRuleId(_: number, rule: ValidationRule): string {
    return rule.id;
  }

  protected trackByAiOptionId(_: number, option: AiRuleOption): string {
    return option.id;
  }

  protected mandatoryLabel(rule: ValidationRule): string {
    return rule.mandatory ? 'Sí' : 'No';
  }

  protected statusClass(status: ValidationRule['status']): string {
    return status === 'Activa' ? 'badge--active' : 'badge--inactive';
  }

  protected openAssistantPanel(): void {
    if (!this.assistantPanelOpen) {
      this.assistantPanelOpen = true;
    }

    if (!this.aiIsLoading && !this.hasAiFetched) {
      void this.loadAiSuggestions();
    }
  }

  protected async loadAiSuggestions(): Promise<void> {
    if (this.aiIsLoading) {
      return;
    }

    this.aiIsLoading = true;
    this.aiError = null;

    try {
      const session = await this.getSessionSnapshot();
      const body = { schema: this.aiRuleSchema, is_admin: this.isAdmin(session) };
      const data = await this.postAuthorized<unknown>('/assistant/analyze', body, session);
      console.log('[ValidationRules] Respuesta bruta de la IA:', data);

      const payloads = extractAiPayloads(data)
        .map((item) => normalizeAiPayload(item))
        .filter((item): item is RulePayload => item !== null);

      console.log('[ValidationRules] Respuesta normalizada de la IA:', payloads);

      this.aiRuleOptions = payloads.map((payload) => ({
        id: this.generateId(),
        payload: JSON.parse(JSON.stringify(payload)) as RulePayload
      }));

      this.selectedAiRuleId = this.aiRuleOptions.length > 0 ? this.aiRuleOptions[0].id : null;
    } catch (error) {
      console.error('[ValidationRules] Error al consultar la IA:', error);
      this.aiError = this.getErrorMessage(error);
      this.aiRuleOptions = [];
      this.selectedAiRuleId = null;
    } finally {
      this.hasAiFetched = true;
      this.aiIsLoading = false;
    }
  }

  protected applyAiRule(option: AiRuleOption): void {
    console.log('[ValidationRules] Payload listo para enviar (IA):', option.payload);
    const payloadClone = JSON.parse(JSON.stringify(option.payload)) as RulePayload;
    const rule = this.buildRuleFromPayload(payloadClone, 'Inactiva', 'ia');
    this.rules = [rule, ...this.rules];
    this.persistRule(payloadClone, 'Inactiva', 'ia');
  }

  protected describeRuleConfig(payload: RulePayload): string[] {
    return describeRuleConfigUtil(payload);
  }

  protected getExampleEntries(payload: RulePayload): Array<{ key: string; value: string }> {
    return getExampleEntriesUtil(payload);
  }

  private addRule(result: ValidationRuleFormDialogResult): void {
    const payload = this.buildPayloadFromFormResult(result);
    console.log('[ValidationRules] Payload listo para enviar (manual):', payload);
    const entry = this.buildRuleFromPayload(payload, result.status, 'manual');
    this.rules = [entry, ...this.rules];
    this.persistRule(payload, result.status, 'manual');
  }

  private updateRule(ruleId: string, result: ValidationRuleFormDialogResult): void {
    this.rules = this.rules.map((rule) => {
      if (rule.id !== ruleId) {
        return rule;
      }

      const payload = this.buildPayloadFromFormResult(result);

      return this.buildRuleFromPayload(payload, result.status, rule.source, rule.id);
    });
  }

  private removeRule(ruleId: string): void {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
  }

  private generateId(): string {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildRuleFromPayload(
    payload: RulePayload,
    status: ValidationRule['status'],
    source: 'manual' | 'ia',
    currentId?: string
  ): ValidationRule {
    const clone = JSON.parse(JSON.stringify(payload)) as RulePayload;
    const header = Array.isArray(clone.Header) ? clone.Header.filter((item) => typeof item === 'string') : [];
    const example = clone['Ejemplo'] && typeof clone['Ejemplo'] === 'object' && !Array.isArray(clone['Ejemplo'])
      ? (clone['Ejemplo'] as RuleExample)
      : {};
    const ruleConfig = clone['Regla'] && typeof clone['Regla'] === 'object' && !Array.isArray(clone['Regla'])
      ? (clone['Regla'] as Record<string, unknown>)
      : {};

    return {
      id: currentId ?? this.generateId(),
      name: clone['Nombre de la regla'],
      dataType: clone['Tipo de dato'],
      mandatory: clone['Campo obligatorio'],
      errorMessage: clone['Mensaje de error'],
      status,
      documentType: header.length > 0 ? header[0] : 'Plantilla Global',
      description: clone['Descripción'],
      header,
      example,
      ruleConfig,
      source,
      payload: clone
    };
  }

  private buildPayloadFromFormResult(result: ValidationRuleFormDialogResult): RulePayload {
    const name = result.name.trim();
    const dataType = result.dataType;
    const primaryHeader = result.documentType.trim() || 'Plantilla Global';
    const additionalHeaders = result.secondaryHeaders
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index && item !== primaryHeader);
    const headers = [primaryHeader, ...additionalHeaders];

    const example = result.exampleEntries.reduce<RuleExample>((acc, entry) => {
      const key = entry.key.trim();
      if (!key) {
        return acc;
      }

      acc[key] = entry.value.trim();
      return acc;
    }, {});

    return {
      'Nombre de la regla': name,
      'Tipo de dato': dataType,
      'Campo obligatorio': result.mandatory,
      Header: headers,
      'Mensaje de error': result.errorMessage.trim(),
      'Descripción': result.description.trim(),
      'Ejemplo': example,
      'Regla': this.normalizeManualRuleConfig(result.ruleConfig, dataType)
    };
  }

  private normalizeManualRuleConfig(
    config: Record<string, unknown>,
    dataType: string
  ): Record<string, unknown> {
    const clone = config && typeof config === 'object'
      ? JSON.parse(JSON.stringify(config))
      : generateDefaultRuleConfigUtil(dataType);

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
        record['Lista compleja'] = this.normalizeAdvancedTable(record['Lista compleja']);
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
        record['reglas especifica'] = this.normalizeAdvancedTable(record['reglas especifica']);
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

  private normalizeAdvancedTable(value: unknown): {
    headers: string[];
    values: Array<Record<string, string>>;
    rows: Array<Record<string, string>>;
  } {
    if (!value) {
      return { headers: [], values: [], rows: [] };
    }

    if (Array.isArray(value)) {
      const rows = this.normalizeAdvancedRows(value);
      const headers = this.extractAdvancedHeaders(rows);
      return { headers, values: rows, rows };
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const headers = Array.isArray(record['headers'])
        ? (record['headers'] as unknown[])
            .map((item) => (typeof item === 'string' ? item.trim() : this.stringifyExampleValue(item)))
            .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
        : [];

      const sourceRows = record['values'] ?? record['rows'] ?? record['data'];
      const rows = this.normalizeAdvancedRows(sourceRows);

      if (headers.length === 0) {
        const inferred = this.extractAdvancedHeaders(rows);
        return { headers: inferred, values: rows, rows };
      }

      const alignedRows = rows.map((row) => this.alignAdvancedRow(row, headers));
      return { headers, values: alignedRows, rows: alignedRows };
    }

    return { headers: [], values: [], rows: [] };
  }

  private normalizeAdvancedRows(value: unknown): Array<Record<string, string>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.normalizeAdvancedRow(item))
      .filter((row): row is Record<string, string> => row !== null)
      .map((row) => {
        const cleaned: Record<string, string> = {};
        Object.entries(row).forEach(([key, cell]) => {
          const header = typeof key === 'string' ? key.trim() : '';
          if (!header) {
            return;
          }

          cleaned[header] = this.stringifyExampleValue(cell).trim();
        });
        return cleaned;
      })
      .filter((row) => Object.keys(row).length > 0);
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

        record[header] = this.stringifyExampleValue(cell).trim();
      });
      return record;
    }

    return null;
  }

  private extractAdvancedHeaders(rows: Array<Record<string, string>>): string[] {
    const headers = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const header = key.trim();
        if (header.length > 0) {
          headers.add(header);
        }
      });
    });

    return Array.from(headers);
  }

  private alignAdvancedRow(row: Record<string, string>, headers: string[]): Record<string, string> {
    return headers.reduce<Record<string, string>>((acc, header) => {
      acc[header] = (row[header] ?? '').toString().trim();
      return acc;
    }, {});
  }


  private persistRule(
    payload: RulePayload,
    status: ValidationRule['status'],
    source: 'manual' | 'ia'
  ): void {
    this.ruleSyncError = null;
    void this.sendRuleToServer(payload, status, source).catch((error) => this.handleRuleSyncError(error));
  }

  private async sendRuleToServer(
    payload: RulePayload,
    status: ValidationRule['status'],
    source: 'manual' | 'ia'
  ): Promise<void> {
    const session = await this.getSessionSnapshot();
    const body = {
      rule: {
        payload,
        status,
        source
      },
      is_admin: this.isAdmin(session)
    };

    await this.postAuthorized<void>('/rules', body, session);
  }

  private async postAuthorized<T>(path: string, body: unknown, session?: SessionState): Promise<T> {
    const snapshot = session ?? (await this.getSessionSnapshot());
    const headers = this.buildAuthHeaders(snapshot);
    return await firstValueFrom(this.http.post<T>(`${this.baseUrl}${path}`, body, { headers }));
  }

  private async getSessionSnapshot(): Promise<SessionState> {
    return await firstValueFrom(this.store.select(selectSessionState));
  }

  private buildAuthHeaders(session: SessionState): HttpHeaders {
    if (!session.accessToken) {
      throw new Error('No hay un token de autenticación disponible.');
    }

    const tokenType = session.tokenType ?? 'Bearer';

    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${tokenType} ${session.accessToken}`
    });
  }

  private isAdmin(session: SessionState): boolean {
    return (session.role ?? '').toLowerCase() === 'admin';
  }

  private handleRuleSyncError(error: unknown): void {
    console.error('[ValidationRules] Error al sincronizar la regla:', error);
    this.ruleSyncError = this.getErrorMessage(error);
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


  private toDialogResult(rule: ValidationRule): ValidationRuleFormDialogResult {
    return {
      name: rule.name,
      dataType: rule.dataType,
      mandatory: rule.mandatory,
      errorMessage: rule.errorMessage,
      status: rule.status,
      documentType: rule.documentType,
      description: rule.description,
      secondaryHeaders: rule.header.slice(1),
      exampleEntries: this.buildDialogExamples(rule.payload),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig)) as Record<string, unknown>
    };
  }

  private buildDialogExamples(payload: RulePayload): Array<{ key: string; value: string }> {
    const defaults: Array<{ key: string; value: string }> = [
      { key: 'Ejemplo válido', value: '' },
      { key: 'Ejemplo inválido', value: '' }
    ];

    const entries = this.getExampleEntries(payload)
      .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
      .filter((entry) => entry.value.length > 0);

    const normalizeKey = (text: string): string =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const validEntry = entries.find((entry) => normalizeKey(entry.key).includes('valido'));
    const invalidEntry = entries.find((entry) => normalizeKey(entry.key).includes('invalido'));

    const fallback = entries.filter((entry) => entry !== validEntry && entry !== invalidEntry);

    return [
      {
        key: defaults[0].key,
        value: validEntry?.value ?? entries[0]?.value ?? ''
      },
      {
        key: defaults[1].key,
        value: invalidEntry?.value ?? fallback[0]?.value ?? entries[1]?.value ?? ''
      }
    ];
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      if (error.error?.detail) {
        return String(error.error.detail);
      }

      if (typeof error.error === 'object' && error.error !== null) {
        try {
          return JSON.stringify(error.error, null, 2);
        } catch (_) {
          // Ignorar y continuar con el flujo inferior.
        }
      }

      if (error.status === 0) {
        return 'No se pudo establecer conexión con el servidor.';
      }

      if (error.status === 401) {
        return 'No estás autorizado para realizar esta acción.';
      }

      if (error.message) {
        return error.message;
      }

      return 'No se pudo completar la solicitud. Inténtalo nuevamente.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch (_) {
      return 'No se pudo completar la solicitud. Inténtalo nuevamente.';
    }

    return 'No se pudo completar la solicitud. Inténtalo nuevamente.';
  }
}
