import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnInit } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ValidationRulesService } from '../validation-rules/validation-rules.service';
import { normalizeAiPayload } from '../validation-rules/validation-rule-ai.utils';

export interface TemplateColumnRuleDetail {
  id?: string;
  summary?: string;
  summaryDisplay?: RuleSummaryDisplay;
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
  imports: [CommonModule, MatDialogModule],
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
  private activeRuleState: ActiveRuleState | null = null;
  private readonly columnRuleIndexMap = new Map<number, number>();

  constructor(
    @Inject(MAT_DIALOG_DATA) protected readonly data: TemplateDetailDialogData,
    private readonly validationRulesService: ValidationRulesService,
    private readonly host: ElementRef<HTMLElement>
  ) {
    this.columnsDetail = this.prepareColumns(data.columnsDetail ?? []);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.closeRuleSummary();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeRuleSummary();
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
    const summaryDisplay =
      rule.summaryDisplay ?? (summary ? this.buildDisplayFromText(summary, id) : undefined);
    const error = rule.error ?? null;
    const loading = requiresLookup && !summary && !error;

    return {
      ...rule,
      id,
      requiresLookup,
      summary,
      error,
      summaryDisplay,
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
      const summaryDisplay = this.buildRuleSummaryDisplay(summaryData, ruleId);
      const summaryText = this.buildRuleSummaryText(summaryDisplay);

      for (const target of targets) {
        target.loading = false;
        target.error = null;
        target.summary = summaryText;
        target.summaryDisplay = summaryDisplay;
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

  private buildRuleSummaryDisplay(summary: RuleSummary | null, ruleId: string): RuleSummaryDisplay {
    if (!summary) {
      return {
        title: `Regla ${ruleId}`,
        description: undefined,
        conditions: [],
      };
    }

    const titleParts: string[] = [];

    if (summary.name) {
      titleParts.push(summary.name);
    }

    if (summary.dataType) {
      titleParts.push(`(${summary.dataType})`);
    }

    const title = titleParts.join(' ').trim() || `Regla ${ruleId}`;

    return {
      title,
      description: summary.description ?? undefined,
      conditions: summary.headerRule ?? [],
    };
  }

  private buildDisplayFromText(text: string, ruleId?: string): RuleSummaryDisplay {
    return {
      title: ruleId ? `Regla ${ruleId}` : 'Resumen de la regla',
      description: text,
      conditions: [],
    };
  }

  private buildRuleSummaryText(display: RuleSummaryDisplay): string {
    const segments: string[] = [];

    const title = display.title?.trim();
    const description = display.description?.trim();

    if (title) {
      segments.push(title);
    }

    if (description && description !== title) {
      segments.push(description);
    }

    if (display.conditions?.length) {
      segments.push(`Condiciones: ${display.conditions.join(', ')}`);
    }

    return segments.join('. ');
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

  protected getRuleInfoStateClass(rule: TemplateColumnRuleDetail): string {
    if (rule.error) {
      return 'template-detail__rule-info--error';
    }

    if (rule.loading) {
      return 'template-detail__rule-info--loading';
    }

    return 'template-detail__rule-info--ready';
  }

  protected getRuleSummaryTitle(rule: TemplateColumnRuleDetail, index: number): string {
    if (rule.summaryDisplay?.title) {
      return rule.summaryDisplay.title;
    }

    return this.getRuleLabel(rule, index);
  }

  protected toggleRuleSummary(event: Event, columnIndex: number, ruleIndex = 0): void {
    event.stopPropagation();

    if (event instanceof KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
      }
    }

    if (this.isColumnRuleSummaryOpen(columnIndex)) {
      this.closeRuleSummary();
      return;
    }

    this.openRuleSummary(columnIndex, ruleIndex);
  }

  protected closeRuleSummary(): void {
    this.activeRuleState = null;
  }

  protected getRuleSummaryContent(rule: TemplateColumnRuleDetail): RuleSummaryDisplay | null {
    if (rule.summaryDisplay) {
      return rule.summaryDisplay;
    }

    if (rule.summary) {
      return this.buildDisplayFromText(rule.summary, rule.id);
    }

    return null;
  }

  protected getRulePopoverId(columnIndex: number): string {
    return `template-rule-popover-${columnIndex}`;
  }

  protected getRuleAriaDescription(rule: TemplateColumnRuleDetail): string {
    if (rule.loading) {
      return 'Resumen cargándose';
    }

    if (rule.error) {
      return rule.error;
    }

    return rule.summary ?? 'Sin resumen disponible.';
  }

  protected isColumnRuleSummaryOpen(columnIndex: number): boolean {
    return this.activeRuleState?.columnIndex === columnIndex;
  }

  protected getRuleDisplay(columnIndex: number): RuleDisplay | null {
    const column = this.columnsDetail[columnIndex];
    if (!column || !column.rules?.length) {
      return null;
    }

    const preferredIndex = this.isColumnRuleSummaryOpen(columnIndex)
      ? this.activeRuleState?.ruleIndex ?? 0
      : this.columnRuleIndexMap.get(columnIndex) ?? 0;

    const ruleIndex = this.clampRuleIndex(columnIndex, preferredIndex);
    this.columnRuleIndexMap.set(columnIndex, ruleIndex);
    const rule = column.rules[ruleIndex];

    return { rule, index: ruleIndex };
  }

  protected hasMultipleRules(columnIndex: number): boolean {
    return (this.columnsDetail[columnIndex]?.rules?.length ?? 0) > 1;
  }

  protected hasPreviousRule(columnIndex: number): boolean {
    if (!this.isColumnRuleSummaryOpen(columnIndex)) {
      return false;
    }

    return (this.activeRuleState?.ruleIndex ?? 0) > 0;
  }

  protected hasNextRule(columnIndex: number): boolean {
    const column = this.columnsDetail[columnIndex];
    if (!column || !this.isColumnRuleSummaryOpen(columnIndex)) {
      return false;
    }

    return (this.activeRuleState?.ruleIndex ?? 0) < column.rules.length - 1;
  }

  protected goToPreviousRule(event: Event, columnIndex: number): void {
    event.stopPropagation();
    if (!this.hasPreviousRule(columnIndex)) {
      return;
    }

    const currentIndex = this.activeRuleState?.ruleIndex ?? 0;
    this.openRuleSummary(columnIndex, currentIndex - 1);
  }

  protected goToNextRule(event: Event, columnIndex: number): void {
    event.stopPropagation();
    if (!this.hasNextRule(columnIndex)) {
      return;
    }

    const currentIndex = this.activeRuleState?.ruleIndex ?? 0;
    this.openRuleSummary(columnIndex, currentIndex + 1);
  }

  protected getActiveRuleIndex(columnIndex: number): number {
    if (this.isColumnRuleSummaryOpen(columnIndex)) {
      return this.activeRuleState?.ruleIndex ?? 0;
    }

    return this.columnRuleIndexMap.get(columnIndex) ?? 0;
  }

  private openRuleSummary(columnIndex: number, ruleIndex: number): void {
    const column = this.columnsDetail[columnIndex];
    if (!column?.rules?.length) {
      return;
    }

    const normalizedIndex = this.clampRuleIndex(columnIndex, ruleIndex);
    this.activeRuleState = {
      columnIndex,
      ruleIndex: normalizedIndex,
    };
    this.columnRuleIndexMap.set(columnIndex, normalizedIndex);
  }

  private clampRuleIndex(columnIndex: number, ruleIndex: number): number {
    const column = this.columnsDetail[columnIndex];
    const total = column?.rules?.length ?? 0;

    if (total === 0) {
      return 0;
    }

    if (ruleIndex < 0) {
      return 0;
    }

    if (ruleIndex >= total) {
      return total - 1;
    }

    return ruleIndex;
  }
}

interface RuleSummary {
  name?: string;
  dataType?: string;
  description?: string;
  headerRule?: string[];
}

interface RuleSummaryDisplay {
  title: string;
  description?: string;
  conditions?: string[];
}

interface RuleDisplay {
  rule: TemplateColumnRuleDetail;
  index: number;
}

interface ActiveRuleState {
  columnIndex: number;
  ruleIndex: number;
}
