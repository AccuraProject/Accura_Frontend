import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  ValidationRuleFormDialogComponent,
  ValidationRuleFormDialogData,
  ValidationRuleFormDialogResult,
  ValidationRuleFormDialogSubmitResult
} from './validation-rule-form-dialog.component';
import {
  ValidationRuleDeleteDialogComponent,
  ValidationRuleDeleteDialogData
} from './validation-rule-delete-dialog.component';
import {
  VALIDATION_RULE_AI_SCHEMA,
  RulePayload,
  RuleExample,
  describeRuleConfig as describeRuleConfigUtil,
  extractAiPayloads,
  getExampleEntries as getExampleEntriesUtil,
  normalizeAiPayload,
  DEFAULT_RULE_ERROR_MESSAGE
} from './validation-rule-ai.utils';
import { ValidationRulesService } from './validation-rules.service';

interface AiRuleOption {
  id: string;
  payload: RulePayload;
}

interface ValidationRule {
  id: string;
  name: string;
  dataType: string;
  mandatory: boolean;
  status: 'Activa' | 'Inactiva';
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

  private readonly aiRuleSchema = VALIDATION_RULE_AI_SCHEMA;

  constructor(
    private readonly dialog: MatDialog,
    private readonly validationRulesService: ValidationRulesService
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
      const data = await this.validationRulesService.fetchRules();

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
        rule.status.toLowerCase().includes(term)
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
    const errorMessage = this.sanitizeString(record['Mensaje de error']) ?? DEFAULT_RULE_ERROR_MESSAGE;
    const description = this.sanitizeString(record['Descripción']) ?? '';

    if (!name || !dataType) {
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
      ValidationRuleFormDialogSubmitResult
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

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
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
      ValidationRuleFormDialogSubmitResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
      width: '92vw',
      maxWidth: '1240px',
      maxHeight: '95vh',
      panelClass: 'validation-rule-dialog',
      data: {
        mode: 'edit',
        rule: this.toDialogResult(rule),
        payload: rule.payload
      }
    });

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
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
        name: rule.name
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

  protected applyAiRule(option: AiRuleOption): void {
    console.log('[ValidationRules] Payload listo para enviar (IA):', option.payload);
    const payloadClone = JSON.parse(JSON.stringify(option.payload)) as RulePayload;
    const rule = this.buildRuleFromPayload(payloadClone, 'Inactiva', 'ia');
    this.rules = [rule, ...this.rules];
    this.persistRule(payloadClone, false);
  }

  protected describeRuleConfig(payload: RulePayload): string[] {
    return describeRuleConfigUtil(payload);
  }

  protected getExampleEntries(payload: RulePayload): Array<{ key: string; value: string }> {
    return getExampleEntriesUtil(payload);
  }

  private addRule(result: ValidationRuleFormDialogSubmitResult): void {
    const payload = JSON.parse(JSON.stringify(result.payload)) as RulePayload;
    console.log('[ValidationRules] Payload listo para enviar (manual):', payload);
    const entry = this.buildRuleFromPayload(payload, result.status, 'manual');
    this.rules = [entry, ...this.rules];
    this.persistRule(payload, result.status === 'Activa');
  }

  private updateRule(ruleId: string, result: ValidationRuleFormDialogSubmitResult): void {
    const payloadClone = JSON.parse(JSON.stringify(result.payload)) as RulePayload;

    this.rules = this.rules.map((rule) => {
      if (rule.id !== ruleId) {
        return rule;
      }

      return this.buildRuleFromPayload(payloadClone, result.status, rule.source, rule.id);
    });

    this.persistRule(payloadClone, result.status === 'Activa', ruleId);
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
      status,
      description: clone['Descripción'],
      header,
      example,
      ruleConfig,
      source,
      payload: clone
    };
  }



  private persistRule(payload: RulePayload, isActive: boolean, ruleId?: string): void {
    this.ruleSyncError = null;
    const request = ruleId
      ? this.validationRulesService.updateRule(ruleId, payload, isActive)
      : this.validationRulesService.saveRule(payload, isActive);

    void request.catch((error) => this.handleRuleSyncError(error));
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

  private toDialogResult(rule: ValidationRule): ValidationRuleFormDialogResult {
    return {
      name: rule.name,
      dataType: rule.dataType,
      mandatory: rule.mandatory,
      status: rule.status,
      description: rule.description,
      primaryHeader: rule.header[0] ?? 'Plantilla Global',
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
