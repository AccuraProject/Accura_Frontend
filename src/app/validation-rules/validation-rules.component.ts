import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
  status: 'Activa' | 'Inactiva' | 'Borrador';
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
export class ValidationRulesComponent {
  protected searchTerm = '';

  protected rules: ValidationRule[] = [];

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
  ) {
    const initialPayloads: Array<{ payload: RulePayload; status: ValidationRule['status']; source: 'manual' | 'ia' }> = [
      {
        payload: {
          'Nombre de la regla': 'Validación de Precio',
          'Tipo de dato': 'Número',
          'Campo obligatorio': true,
          Header: ['Catálogo de Productos'],
          'Mensaje de error': 'El precio debe estar entre 0 y 10,000 con 2 decimales',
          'Descripción':
            'Verifica que el precio ingresado se encuentre dentro del rango permitido y con el número de decimales adecuado.',
          'Ejemplo': {},
          'Regla': {
            'Valor mínimo': 0,
            'Valor máximo': 10000,
            'Número de decimales': 2
          }
        },
        status: 'Activa',
        source: 'manual'
      },
      {
        payload: {
          'Nombre de la regla': 'Validación de DNI',
          'Tipo de dato': 'Texto',
          'Campo obligatorio': true,
          Header: ['Documentos de Identidad'],
          'Mensaje de error': 'El DNI debe tener exactamente 8 dígitos',
          'Descripción': 'Controla que el número de documento tenga la cantidad exacta de dígitos requerida.',
          'Ejemplo': {},
          'Regla': {
            'Longitud minima': 8,
            'Longitud maxima': 8
          }
        },
        status: 'Activa',
        source: 'manual'
      },
      {
        payload: {
          'Nombre de la regla': 'Tipo de Documento',
          'Tipo de dato': 'Lista',
          'Campo obligatorio': false,
          Header: ['Documentos de Identidad'],
          'Mensaje de error': 'Selecciona un tipo de documento válido',
          'Descripción': 'Limita la selección del tipo de documento a los valores permitidos por el área legal.',
          'Ejemplo': {},
          'Regla': {
            Lista: ['DNI', 'Pasaporte', 'Carnet de Extranjería']
          }
        },
        status: 'Inactiva',
        source: 'manual'
      },
      {
        payload: {
          'Nombre de la regla': 'Dirección Completa',
          'Tipo de dato': 'Texto',
          'Campo obligatorio': true,
          Header: ['Clientes'],
          'Mensaje de error': 'La dirección debe contener al menos 12 caracteres',
          'Descripción': 'Verifica que la dirección incluya el detalle mínimo requerido para despachos.',
          'Ejemplo': {},
          'Regla': {
            'Longitud minima': 12,
            'Longitud maxima': 255
          }
        },
        status: 'Borrador',
        source: 'manual'
      }
    ];

    this.rules = initialPayloads.map(({ payload, status, source }) =>
      this.buildRuleFromPayload(payload, status, source)
    );
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

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogData,
      ValidationRuleFormDialogResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
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
    switch (status) {
      case 'Activa':
        return 'badge--active';
      case 'Borrador':
        return 'badge--draft';
      default:
        return 'badge--inactive';
    }
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
    const rule = this.buildRuleFromPayload(payloadClone, 'Borrador', 'ia');
    this.rules = [rule, ...this.rules];
    this.persistRule(payloadClone, 'Borrador', 'ia');
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
      payload,
      status,
      source,
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
      exampleEntries: this.getExampleEntries(rule.payload).map(({ key, value }) => ({
        key,
        value
      })),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig)) as Record<string, unknown>
    };
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
