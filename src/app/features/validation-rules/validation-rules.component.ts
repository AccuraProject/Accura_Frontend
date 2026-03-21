import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  ValidationRuleFormDialogComponent,
  ValidationRuleFormDialogData,
  ValidationRuleFormDialogResult,
  ValidationRuleFormDialogSubmitResult,
} from './validation-rule-form-dialog.component';
import {
  ValidationRuleDeleteDialogComponent,
  ValidationRuleDeleteDialogData,
} from './validation-rule-delete-dialog.component';
import {
  VALIDATION_RULE_AI_SCHEMA,
  RulePayload,
  RuleExample,
  describeRuleConfig as describeRuleConfigUtil,
  extractAiPayloads,
  getExampleEntries as getExampleEntriesUtil,
  normalizeAiPayload,
  DEFAULT_RULE_ERROR_MESSAGE,
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
  headerRule: string[];
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
  styleUrl: './validation-rules.component.scss',
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

  protected readonly pageSize = 10;
  protected currentPage = 1;

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
      this.updatePaginationAfterDataChange(this.rules.length);
    } catch (error) {
      console.error('[ValidationRules] Error al obtener las reglas:', error);
      this.ruleLoadError = this.getErrorMessage(error);
      this.rules = [];
      this.updatePaginationAfterDataChange(this.rules.length);
    } finally {
      this.rulesLoading = false;
    }
  }

  private updatePaginationAfterDataChange(totalItems: number): void {
    const totalPages = this.calculateTotalPages(totalItems);
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private calculateTotalPages(totalItems: number): number {
    return totalItems > 0 ? Math.ceil(totalItems / this.pageSize) : 1;
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

  protected get paginatedRules(): ValidationRule[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredRules.slice(startIndex, startIndex + this.pageSize);
  }

  protected get totalPages(): number {
    const total = Math.ceil(this.filteredRules.length / this.pageSize);
    return total > 0 ? total : 1;
  }

  protected get pageStart(): number {
    if (this.filteredRules.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  protected get pageEnd(): number {
    if (this.filteredRules.length === 0) {
      return 0;
    }

    return Math.min(this.filteredRules.length, this.currentPage * this.pageSize);
  }

  protected goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  protected goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  protected onSearchChange(): void {
    this.currentPage = 1;
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

    const status = this.toStatus(record['is_active'], record['status']);
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
    const errorMessage =
      this.sanitizeString(record['Mensaje de error']) ?? DEFAULT_RULE_ERROR_MESSAGE;
    const description = this.sanitizeString(record['Descripción']) ?? '';

    if (!name || !dataType) {
      return null;
    }

    const header = this.sanitizeStringArray(record['Header']);

    if (header.length === 0) {
      header.push('Plantilla Global');
    }

    const headerRule = this.sanitizeStringArray(record['Header rule']);

    const example =
      record['Ejemplo'] &&
      typeof record['Ejemplo'] === 'object' &&
      !Array.isArray(record['Ejemplo'])
        ? (record['Ejemplo'] as RuleExample)
        : {};

    const ruleConfig =
      record['Regla'] && typeof record['Regla'] === 'object' && !Array.isArray(record['Regla'])
        ? (record['Regla'] as Record<string, unknown>)
        : {};

    const mandatorySource = record['Campo obligatorio'];
    const mandatory =
      typeof mandatorySource === 'boolean' ? mandatorySource : this.toBoolean(mandatorySource);

    return {
      'Nombre de la regla': name,
      'Tipo de dato': dataType,
      'Campo obligatorio': mandatory,
      Header: header,
      'Header rule': headerRule,
      'Mensaje de error': errorMessage,
      Descripción: description,
      Ejemplo: example,
      Regla: ruleConfig,
    };
  }

  private toStatus(isActiveValue: unknown, fallbackValue?: unknown): ValidationRule['status'] {
    if (typeof isActiveValue === 'boolean') {
      return isActiveValue ? 'Activa' : 'Inactiva';
    }

    const isActiveText = this.sanitizeString(isActiveValue)?.toLowerCase();
    if (isActiveText) {
      const truthyValues = ['true', '1', 'si', 'sí', 'yes', 'activo', 'activa'];
      const falsyValues = ['false', '0', 'no', 'inactivo', 'inactiva'];

      if (truthyValues.includes(isActiveText)) {
        return 'Activa';
      }

      if (falsyValues.includes(isActiveText)) {
        return 'Inactiva';
      }
    }

    const fallbackText = this.sanitizeString(fallbackValue)?.toLowerCase();
    return fallbackText === 'inactiva' || fallbackText === 'borrador' ? 'Inactiva' : 'Activa';
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
        mode: 'create',
      },
    });

    dialogRef
      .afterClosed()
      .subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
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
        payload: rule.payload,
      },
    });

    dialogRef
      .afterClosed()
      .subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
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
      },
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
    this.updatePaginationAfterDataChange(this.rules.length);
    this.persistRule(payloadClone, false).catch(() => undefined);
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
    this.updatePaginationAfterDataChange(this.rules.length);
    this.persistRule(payload, result.status === 'Activa')
      .then(() => this.loadRules())
      .catch(() => undefined);
  }

  private updateRule(ruleId: string, result: ValidationRuleFormDialogSubmitResult): void {
    const payloadClone = JSON.parse(JSON.stringify(result.payload)) as RulePayload;

    this.rules = this.rules.map((rule) => {
      if (rule.id !== ruleId) {
        return rule;
      }

      return this.buildRuleFromPayload(payloadClone, result.status, rule.source, rule.id);
    });
    this.updatePaginationAfterDataChange(this.rules.length);

    this.persistRule(payloadClone, result.status === 'Activa', ruleId).catch(() => undefined);
  }

  private removeRule(ruleId: string): void {
    const previousRules = [...this.rules];
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
    this.updatePaginationAfterDataChange(this.rules.length);

    this.ruleSyncError = null;

    void this.validationRulesService.deleteRule(ruleId).catch((error) => {
      this.rules = previousRules;
      this.updatePaginationAfterDataChange(this.rules.length);
      this.handleRuleSyncError(error);
    });
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
    const header = this.sanitizeStringArray(clone.Header);
    if (header.length === 0) {
      header.push('Plantilla Global');
    }
    const headerRule = this.sanitizeStringArray(clone['Header rule']);
    const example =
      clone['Ejemplo'] && typeof clone['Ejemplo'] === 'object' && !Array.isArray(clone['Ejemplo'])
        ? (clone['Ejemplo'] as RuleExample)
        : {};
    const ruleConfig =
      clone['Regla'] && typeof clone['Regla'] === 'object' && !Array.isArray(clone['Regla'])
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
      headerRule,
      example,
      ruleConfig,
      source,
      payload: clone,
    };
  }

  private async persistRule(
    payload: RulePayload,
    isActive: boolean,
    ruleId?: string
  ): Promise<void> {
    try {
      if (ruleId) {
        await this.validationRulesService.updateRule(ruleId, payload, isActive);
      } else {
        await this.validationRulesService.saveRule(payload, isActive);
      }
    } catch (error) {
      this.handleRuleSyncError(error);
      throw error;
    }
  }

  private handleRuleSyncError(error: unknown): void {
    console.error('[ValidationRules] Error al sincronizar la regla:', error);
    this.ruleSyncError = this.getErrorMessage(error);
  }

  private sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return (value as unknown[])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
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
      headerRule: [...rule.headerRule],
      exampleEntries: this.buildDialogExamples(rule.payload),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig)) as Record<string, unknown>,
    };
  }

  private buildDialogExamples(payload: RulePayload): Array<{ key: string; value: string }> {
    const defaults: Array<{ key: string; value: string }> = [
      { key: 'Ejemplo válido', value: '' },
      { key: 'Ejemplo inválido', value: '' },
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
        value: validEntry?.value ?? entries[0]?.value ?? '',
      },
      {
        key: defaults[1].key,
        value: invalidEntry?.value ?? fallback[0]?.value ?? entries[1]?.value ?? '',
      },
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
