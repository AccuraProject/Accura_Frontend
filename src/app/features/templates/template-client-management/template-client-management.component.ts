import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { TemplateDetailDialogComponent } from '../components/template-detail-dialog/template-detail-dialog.component';
import {
  TemplateColumnResponse,
  TemplateColumnRulePayload,
  TemplateResponse,
  TemplatesService,
} from '../templates.service';
import { normalizeAiPayload } from '../../validation-rules/validation-rule-ai.utils';
import { PageActionsComponent } from '../../../shared/components/ui/page-actions/page-actions';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../../shared/components/data/data-table/data-table';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { TemplateUserAccessResponse } from '../models/template-user-access';

type TemplateStatus = 'Activo' | 'En revisión';

export interface TemplateColumnRuleDetail {
  id: number;
  type: string;
  summary: Record<string, string> | null;
  attachment: string | null;
}

export interface TemplateColumnDetail {
  name: string;
  required: boolean;
  rules: TemplateColumnRuleDetail[];
}

interface TemplateRow {
  id: number;
  name: string;
  description: string;
  status: TemplateStatus;
  start_date: Date;
  end_date: Date;
  lastUpdated: Date;
  columns: number;
  columnsDetail: TemplateColumnDetail[];
}

type DetailDialogData = TemplateRow;

const EMPTY_DETAIL_DIALOG_DATA: DetailDialogData = {
  id: 0,
  name: '',
  description: '',
  status: 'Activo',
  start_date: new Date(),
  end_date: new Date(),
  lastUpdated: new Date(),
  columns: 0,
  columnsDetail: [],
};

@Component({
  selector: 'app-template-client-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageActionsComponent,
    DataTableComponent,
    TemplateDetailDialogComponent,
  ],
  templateUrl: './template-client-management.component.html',
  styleUrl: './template-client-management.component.scss',
})
export class TemplateClientManagementComponent implements OnInit, OnDestroy {
  protected searchTerm = '';

  private readonly templatesService = inject(TemplatesService);

  @Input() sessionUserId: number = 0;

  protected uploadTemplateId: string | null = null;
  protected uploadState: Record<string, string | null> = {};
  protected uploadFiles: Record<string, File | null> = {};
  protected uploadErrors: Record<string, string | null> = {};
  protected uploadSuccess: Record<string, string | null> = {};
  protected uploadProgress: Record<string, number | null> = {};
  protected uploadInProgress: Record<string, boolean> = {};
  protected dragActiveId: string | null = null;
  protected downloadingTemplates: Record<string, boolean> = {};
  protected statusUpdating: Record<string, boolean> = {};
  protected deletingTemplates: Record<string, boolean> = {};
  private uploadSubscriptions: Record<string, Subscription | null> = {};

  protected templates: TemplateRow[] = [];
  protected templatesLoading = signal(false);
  protected templatesError: string | null = null;

  protected selectedTemplate: TemplateRow | null = null;
  protected isEditingClient = false;

  clientColumns: DataTableColumn[] = [
    { field: 'name', header: 'Nombre', sortable: true, filter: true, filterType: 'text' },
    {
      field: 'description',
      header: 'Descripción',
      sortable: true,
      filter: true,
      filterType: 'text',
    },
    {
      field: 'start_date',
      header: 'Fecha de inicio',
      align: 'center',
      sortable: true,
      type: 'date',
      filter: true,
      filterType: 'date',
      dateFormat: 'dd/MM/yyyy'
    },
    {
      field: 'end_date',
      header: 'Fecha de fin',
      align: 'center',
      sortable: true,
      type: 'date',
      filter: true,
      filterType: 'date',
      dateFormat: 'dd/MM/yyyy'
    },
    {
      field: 'lastUpdated',
      header: 'Última actualización',
      align: 'center',
      sortable: true,
      type: 'date',
      filter: true,
      filterType: 'date',
    },
  ];

  protected detailDialogVisible = false;
  protected detailDialogLoading = false;

  detailDialogData: DetailDialogData = EMPTY_DETAIL_DIALOG_DATA;

  constructor(
    private readonly toast: ToastService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    for (const subscription of Object.values(this.uploadSubscriptions)) {
      subscription?.unsubscribe();
    }
  }

  onRowSelect(template: TemplateRow) {
    this.selectedTemplate = template;
  }

  onRowUnselect() {
    this.selectedTemplate = null;
  }

  onViewDetail() {
    if (!this.selectedTemplate) return;

    this.detailDialogData = this.selectedTemplate;

    this.detailDialogVisible = true;
  }

  protected closeTemplateDialog(): void {
    this.detailDialogVisible = false;
    this.detailDialogLoading = false;
    this.detailDialogData = EMPTY_DETAIL_DIALOG_DATA;
  }

  private loadTemplates() {
    if (this.templatesLoading() || !this.sessionUserId) {
      return;
    }

    this.templatesLoading.set(true);
    this.templatesError = null;

    this.templatesService
      .getTemplatesForUser(this.sessionUserId)
      .pipe(
        switchMap((templateAccessResponses) => {
          const templateDetailsRequests = templateAccessResponses.map((access) =>
            this.templatesService.getTemplateDetail(access.template_id),
          );

          return forkJoin(templateDetailsRequests).pipe(
            map((templateDetails) => {
              return templateAccessResponses.map((access, index) => ({
                access,
                template: templateDetails[index],
              }));
            }),
          );
        }),
      )
      .subscribe({
        next: (templatesWithAccess) => {
          this.templates = templatesWithAccess.map(({ template, access }) =>
            this.mapToTemplateRow(template, access),
          );
        },
        error: (error: unknown) => {
          this.templates = [];
          this.templatesError = this.templatesService.getErrorMessage(error);
          console.error(this.templatesError);
        },
        complete: () => {
          this.templatesLoading.set(false);
        },
      });
  }

  private mapToTemplateRow(
    template: TemplateResponse,
    access: TemplateUserAccessResponse,
  ): TemplateRow {
    const updatedAt = new Date(template.updated_at || template.created_at || new Date());
    const status = this.toDisplayStatus(template.status);

    const columns: TemplateColumnResponse[] = template.columns ?? [];
    const columnsDetail = this.mapColumnsToDetail(columns);

    return {
      id: template.id,
      name: template.name ?? 'Nueva plantilla',
      description: template.description ?? '',
      status,
      start_date: new Date(access.start_date),
      end_date: new Date(access.end_date),
      lastUpdated: updatedAt,
      columns: columns.length,
      columnsDetail,
    };
  }

  private mapColumnsToDetail(columns: TemplateColumnResponse[]): TemplateColumnDetail[] {
    return columns.map((column) => {
      const rules: TemplateColumnRuleDetail[] = [];
      const rawRules: TemplateColumnRulePayload[] = Array.isArray(column.rules) ? column.rules : [];

      let isRequired = false;

      for (const rawRule of rawRules) {
        const payload = this.extractRulePayload(rawRule);
        const normalizedPayload = normalizeAiPayload(payload);

        if (normalizedPayload) {
          if (this.toBoolean(normalizedPayload['Campo obligatorio'])) isRequired = true;

          const rule: TemplateColumnRuleDetail = {
            id: rawRule.id,
            type: normalizedPayload['Tipo de dato'],
            summary: rawRule.summary ?? null,
            attachment: rawRule.attachment ?? null,
          };

          rules.push(rule);
        }
      }

      return {
        name: column.name,
        description: column.description ?? '',
        required: isRequired,
        rules,
      };
    });
  }

  private toDisplayStatus(status: string | undefined): TemplateStatus {
    if (!status) {
      return 'En revisión';
    }

    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'published':
      case 'publicado':
        return 'Activo';
      case 'inactive':
      case 'inactivo':
        return 'En revisión';
      default:
        return 'En revisión';
    }
  }

  private extractRulePayload(rule: TemplateColumnRulePayload): unknown {
    if (!rule || typeof rule !== 'object') {
      return null;
    }

    const record = rule as Record<string, unknown>;

    if ('rule' in record) {
      return record['rule'];
    }

    if ('payload' in record) {
      return record['payload'];
    }

    if ('data' in record) {
      return record['data'];
    }

    return record;
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }

      return ['true', '1', 'si', 'sí', 'yes'].includes(normalized);
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return false;
  }
}
