import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ValidationRulesService } from '../validation-rules/validation-rules.service';
import { normalizeAiPayload } from '../validation-rules/validation-rule-ai.utils';

export interface TemplateColumnRuleDetail {
  id?: string;
  summary?: string;
  requiresLookup?: boolean;
  loading?: boolean;
  error?: string | null;
}

export interface TemplateColumnDetail {
  name: string;
  type: string;
  required: boolean;
  example?: string;
  rules: TemplateColumnRuleDetail[];
}

export interface TemplateDetailDialogData {
  name: string;
  description: string;
  version: string;
  status: string;
  lastUpdated: string | Date;
  createdAt?: string | Date;
  columnsCount?: number;
  owner?: string;
  tags?: string[];
  statusClass?: string;
  columnsDetail: TemplateColumnDetail[];
}

@Component({
  selector: 'app-template-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatTooltipModule],
  templateUrl: './template-detail-dialog.component.html',
  styleUrl: './template-detail-dialog.component.scss',
})
export class TemplateDetailDialogComponent implements OnInit {
  protected readonly statusClassMap: Record<string, string> = {
    Publicado: 'badge--active',
    Activo: 'badge--active',
    'En Revisión': 'badge--review',
    Borrador: 'badge--draft',
    Inactivo: 'badge--inactive'
  };

  protected readonly columnsDetail: TemplateColumnDetail[];

  private readonly ruleRegistry = new Map<string, TemplateColumnRuleDetail[]>();

  constructor(
    @Inject(MAT_DIALOG_DATA) protected readonly data: TemplateDetailDialogData,
    private readonly validationRulesService: ValidationRulesService
  ) {
    this.columnsDetail = this.prepareColumns(data.columnsDetail ?? []);
  }

  async ngOnInit(): Promise<void> {
    for (const ruleId of this.ruleRegistry.keys()) {
      void this.loadRuleSummary(ruleId);
    }
  }

  protected get statusBadgeClass(): string {
    if (this.data.statusClass) {
      return this.data.statusClass;
    }

    return this.statusClassMap[this.data.status] ?? 'badge--inactive';
  }

  protected get totalColumns(): number {
    if (typeof this.data.columnsCount === 'number') {
      return this.data.columnsCount;
    }

    return this.columnsDetail.length;
  }

  private prepareColumns(columns: TemplateColumnDetail[]): TemplateColumnDetail[] {
    return columns.map((column) => {
      const normalizedRules = Array.isArray(column.rules)
        ? column.rules.map((rule) => this.normalizeRuleDetail(rule))
        : [];

      for (const rule of normalizedRules) {
        if (rule.requiresLookup && rule.id) {
          const entries = this.ruleRegistry.get(rule.id) ?? [];
          entries.push(rule);
          this.ruleRegistry.set(rule.id, entries);
        }
      }

      return {
        ...column,
        rules: normalizedRules,
      };
    });
  }

  private normalizeRuleDetail(rule: TemplateColumnRuleDetail): TemplateColumnRuleDetail {
    const id = this.toRuleId(rule.id);
    const requiresLookup = rule.requiresLookup ?? (!!id && !rule.summary);
    const summary = this.toSummary(rule.summary);
    const error = rule.error ?? null;
    const loading = requiresLookup && !summary && !error;

    return {
      ...rule,
      id,
      requiresLookup,
      summary,
      error,
      loading,
    };
  }

  private toRuleId(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toString();
    }

    return undefined;
  }

  private toSummary(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    return undefined;
  }

  private async loadRuleSummary(ruleId: string): Promise<void> {
    const targets = this.ruleRegistry.get(ruleId);
    if (!targets?.length) {
      return;
    }

    try {
      const response = await this.validationRulesService.fetchRule(ruleId);
      const summaryData = this.parseRuleSummary(response);
      const summaryText = this.buildRuleSummary(summaryData, ruleId);

      for (const target of targets) {
        target.loading = false;
        target.error = null;
        target.summary = summaryText;
        target.requiresLookup = false;
      }
    } catch (error) {
      const message = this.getErrorMessage(error);
      for (const target of targets) {
        target.loading = false;
        target.error = message;
        target.requiresLookup = false;
      }
    }
  }

  private parseRuleSummary(entry: unknown): RuleSummary | null {
    if (!entry) {
      return null;
    }

    if (Array.isArray(entry)) {
      for (const item of entry) {
        const parsed = this.parseRuleSummary(item);
        if (parsed) {
          return parsed;
        }
      }

      return null;
    }

    if (typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const payloadCandidate = record['payload'] ?? record['rule'] ?? record['data'] ?? record;
    const payload = normalizeAiPayload(payloadCandidate);

    if (payload) {
      return {
        name: payload['Nombre de la regla'],
        dataType: payload['Tipo de dato'],
        description: payload['Descripción'],
        headerRule: this.extractStringArray(payload['Header rule']),
      };
    }

    const name = this.extractString(record['name'] ?? record['Nombre de la regla']);
    const dataType = this.extractString(record['data_type'] ?? record['Tipo de dato']);
    const description = this.extractString(record['description'] ?? record['Descripción']);
    const headerRule = this.extractStringArray(record['header_rule'] ?? record['Header rule']);

    if (!name && !dataType && !description && headerRule.length === 0) {
      return null;
    }

    return {
      name: name ?? undefined,
      dataType: dataType ?? undefined,
      description: description ?? undefined,
      headerRule,
    };
  }

  private buildRuleSummary(summary: RuleSummary | null, ruleId: string): string {
    if (!summary) {
      return `Regla ${ruleId}`;
    }

    const segments: string[] = [];
    const titleParts: string[] = [];

    if (summary.name) {
      titleParts.push(summary.name);
    }

    if (summary.dataType) {
      titleParts.push(`(${summary.dataType})`);
    }

    const title = titleParts.join(' ').trim();

    if (title.length > 0) {
      segments.push(title);
    } else {
      segments.push(`Regla ${ruleId}`);
    }

    if (summary.description) {
      segments.push(summary.description);
    }

    if (summary.headerRule?.length) {
      segments.push(`Condiciones: ${summary.headerRule.join(', ')}`);
    }

    return segments.join(' · ');
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

  private getErrorMessage(error: unknown): string {
    if (!error) {
      return 'No se pudo obtener la regla asociada.';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    const responseError = (error as { error?: unknown }).error;
    if (responseError && typeof responseError === 'object') {
      const detail = (responseError as { detail?: unknown }).detail;
      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }
    }

    return 'No se pudo obtener la regla asociada.';
  }

  protected getRuleLabel(rule: TemplateColumnRuleDetail, index: number): string {
    if (rule.id) {
      return `Regla ${rule.id}`;
    }

    return `Regla ${index + 1}`;
  }

  protected getRuleTooltip(rule: TemplateColumnRuleDetail): string {
    if (rule.loading) {
      return 'Cargando resumen de la regla…';
    }

    if (rule.error) {
      return rule.error;
    }

    return rule.summary ?? 'Sin resumen disponible.';
  }

  protected getRuleTooltipClass(rule: TemplateColumnRuleDetail): string[] {
    const classes = ['template-detail__tooltip'];

    if (rule.error) {
      classes.push('template-detail__tooltip--error');
    } else if (rule.loading) {
      classes.push('template-detail__tooltip--muted');
    }

    return classes;
  }

  protected getRuleInfoStateClass(rule: TemplateColumnRuleDetail): string {
    if (rule.error) {
      return 'template-detail__rule-info--error';
    }

    if (rule.loading) {
      return 'template-detail__rule-info--loading';
    }

    return 'template-detail__rule-info--ready';
  }

  protected getRuleTooltipAriaLabel(rule: TemplateColumnRuleDetail, index: number): string {
    const label = this.getRuleLabel(rule, index);
    const tooltip = this.getRuleTooltip(rule);
    return `${label}. ${tooltip}`;
  }
}

interface RuleSummary {
  name?: string;
  dataType?: string;
  description?: string;
  headerRule?: string[];
}
