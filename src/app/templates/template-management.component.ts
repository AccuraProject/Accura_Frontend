import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { HttpEventType } from '@angular/common/http';
import { Observable, Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  TemplateCreateDialogComponent,
  TemplateCreateDialogResult,
  TemplateDialogData,
} from './template-create-dialog.component';
import {
  TemplateColumnDetail,
  TemplateColumnRuleDetail,
  TemplateDetailDialogComponent,
  TemplateDetailDialogData,
} from './template-detail-dialog.component';
import {
  TemplateDeleteDialogComponent,
  TemplateDeleteDialogData,
} from './template-delete-dialog.component';
import { CurrentUserResponse } from '../core/models/user.model';
import { selectIsAdmin, selectSessionUser } from '../core/store/session/session.selectors';
import {
  TemplateColumnResponse,
  TemplateColumnRulePayload,
  TemplateResponse,
  TemplatesService,
} from './templates.service';
import { normalizeAiPayload, RulePayload } from '../validation-rules/validation-rule-ai.utils';

type ManagementTemplateStatus = 'Publicado' | 'Borrador' | 'Inactivo';
type ClientTemplateStatus = 'Activo' | 'En Revisión';
type TemplateStatus = ManagementTemplateStatus | ClientTemplateStatus;

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: TemplateStatus;
  createdAt: string;
  lastUpdated: string;
  columns: number;
  columnsDetail: TemplateColumnDetail[];
  tableName?: string;
  statusCode?: string;
}

interface ClientTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ClientTemplateStatus;
  statusClass: string;
  lastUpdated: string;
  createdAt: string;
  columnsCount: number;
  owner: string;
  tags: string[];
  columnsDetail: TemplateColumnDetail[];
}

@Component({
  selector: 'app-template-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatMenuModule],
  templateUrl: './template-management.component.html',
  styleUrl: './template-management.component.scss',
})
export class TemplateManagementComponent implements OnInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(Store);
  private readonly templatesService = inject(TemplatesService);
  private readonly sessionUser$ = this.store.select(selectSessionUser);

  protected searchTerm = '';
  protected statusFilter: ManagementTemplateStatus | 'Todos' = 'Todos';
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

  protected readonly isAdmin$: Observable<boolean> = this.store.select(selectIsAdmin);

  protected readonly statusOptions: (TemplateStatus | 'Todos')[] = [
    'Todos',
    'Publicado',
    'Borrador',
    'Inactivo',
  ];

  protected templates: TemplateRow[] = [];
  protected templatesLoading = false;
  protected templatesError: string | null = null;
  protected assignedTemplates: ClientTemplate[] = [];
  protected assignedTemplatesLoading = false;
  protected assignedTemplatesError: string | null = null;

  ngOnInit(): void {
    void this.initializeTemplates();
  }

  ngOnDestroy(): void {
    for (const subscription of Object.values(this.uploadSubscriptions)) {
      subscription?.unsubscribe();
    }
  }

  private async initializeTemplates(): Promise<void> {
    const isAdmin = await firstValueFrom(this.isAdmin$);

    if (isAdmin) {
      await this.loadTemplates();
      return;
    }

    await this.loadAssignedTemplates();
  }

  protected get filteredTemplates(): TemplateRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    const statusFilter = this.statusFilter;

    return this.templates.filter((template) => {
      const matchesTerm =
        !term ||
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.version.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'Todos' || template.status === statusFilter;

      return matchesTerm && matchesStatus;
    });
  }

  protected get filteredAssignedTemplates(): ClientTemplate[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.assignedTemplates.filter((template) => {
      if (!term) {
        return true;
      }

      return (
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.version.toLowerCase().includes(term)
      );
    });
  }

  protected get totalTemplates(): number {
    return this.templates.length;
  }

  protected get publishedTemplates(): number {
    return this.templates.filter((template) => template.status === 'Publicado').length;
  }

  protected get draftTemplates(): number {
    return this.templates.filter((template) => template.status === 'Borrador').length;
  }

  protected get inactiveTemplates(): number {
    return this.templates.filter((template) => template.status === 'Inactivo').length;
  }

  protected trackByTemplateId(_: number, template: TemplateRow): string {
    return template.id;
  }

  protected trackByAssignedTemplateId(_: number, template: ClientTemplate): string {
    return template.id;
  }

  protected async downloadTemplateExcel(template: ClientTemplate): Promise<void> {
    const templateId = template.id;

    if (!templateId) {
      return;
    }

    this.assignedTemplatesError = null;
    this.downloadingTemplates[templateId] = true;

    try {
      const blob = await this.templatesService.downloadTemplateExcel(templateId);

      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.buildTemplateFilename(template);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[TemplateManagement] Error al descargar formato de plantilla:', error);
      this.assignedTemplatesError = this.getErrorMessage(error);
    } finally {
      this.downloadingTemplates[templateId] = false;
    }
  }

  protected statusClass(status: TemplateStatus): string {
    switch (status) {
      case 'Publicado':
      case 'Activo':
        return 'badge--active';
      case 'Borrador':
      case 'En Revisión':
        return 'badge--draft';
      default:
        return 'badge--inactive';
    }
  }

  protected canEditTemplate(template: TemplateRow): boolean {
    const normalizedStatus = template.statusCode?.trim().toLowerCase();

    if (normalizedStatus) {
      return normalizedStatus === 'unpublished';
    }

    return template.status === 'Borrador';
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      TemplateCreateDialogComponent,
      TemplateDialogData,
      TemplateCreateDialogResult
    >(TemplateCreateDialogComponent, {
      disableClose: true,
      width: '92vw',
      maxWidth: '1240px',
      maxHeight: '95vh',
      data: { mode: 'create' },
    });

    dialogRef.afterClosed().subscribe((result: TemplateCreateDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addTemplateFromCreate(result);
    });
  }

  protected async openEditDialog(template: TemplateRow): Promise<void> {
    if (!this.canEditTemplate(template)) {
      return;
    }

    const templateId = template.id;
    this.templatesError = null;

    try {
      const templateResponse = await this.templatesService.fetchTemplate(templateId);

      if (!templateResponse) {
        throw new Error('No fue posible obtener la plantilla seleccionada.');
      }

      let columns: TemplateColumnResponse[] = [];

      try {
        columns = await this.templatesService.fetchTemplateColumns(templateId);
      } catch (columnError) {
        console.error(
          '[TemplateManagement] No se pudieron obtener las columnas para la edición:',
          columnError
        );
        columns = [];
      }

      const dialogRef = this.dialog.open<
        TemplateCreateDialogComponent,
        TemplateDialogData,
        TemplateCreateDialogResult
      >(TemplateCreateDialogComponent, {
        disableClose: true,
        width: '92vw',
        maxWidth: '1240px',
        maxHeight: '95vh',
        data: {
          mode: 'edit',
          template: templateResponse,
          columns,
        },
      });

      dialogRef.afterClosed().subscribe((result: TemplateCreateDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.updateTemplateFromEdit(result);
      });
    } catch (error) {
      console.error('[TemplateManagement] Error al preparar edición de plantilla:', error);
      this.templatesError = this.getErrorMessage(error);
    }
  }

  protected openDetailDialog(template: TemplateRow): void {
    this.dialog.open<TemplateDetailDialogComponent, TemplateDetailDialogData, void>(
      TemplateDetailDialogComponent,
      {
        width: '70vw',
        maxWidth: '1240px',
        // maxHeight: '95vh',
        data: {
          name: template.name,
          description: template.description,
          version: template.version,
          status: template.status,
          createdAt: template.createdAt,
          lastUpdated: template.lastUpdated,
          columnsCount: template.columns,
          columnsDetail: template.columnsDetail,
        },
      }
    );
  }

  protected async openClientDetailDialog(template: ClientTemplate): Promise<void> {
    const templateId = template.id;
    this.assignedTemplatesError = null;

    try {
      const detail = await this.templatesService.fetchTemplateDetail(templateId);
      if (detail) {
        const columns = Array.isArray(detail.columns) ? detail.columns : [];
        const mappedTemplate = this.mapTemplateResponseToClient(detail, columns);

        this.dialog.open<TemplateDetailDialogComponent, TemplateDetailDialogData, void>(
          TemplateDetailDialogComponent,
          {
            width: '70vw',
            maxWidth: '1240px',
            data: {
              name: mappedTemplate.name,
              description: mappedTemplate.description,
              version: mappedTemplate.version,
              status: mappedTemplate.status,
              statusClass: mappedTemplate.statusClass,
              lastUpdated: mappedTemplate.lastUpdated,
              createdAt: mappedTemplate.createdAt,
              columnsCount: mappedTemplate.columnsCount,
              owner: mappedTemplate.owner,
              tags: mappedTemplate.tags,
              columnsDetail: mappedTemplate.columnsDetail,
            },
          }
        );
        return;
      }
    } catch (error) {
      console.error('[TemplateManagement] Error al obtener detalle de plantilla:', error);
      this.assignedTemplatesError = this.getErrorMessage(error);
    }

    this.dialog.open<TemplateDetailDialogComponent, TemplateDetailDialogData, void>(
      TemplateDetailDialogComponent,
      {
        data: {
          name: template.name,
          description: template.description,
          version: template.version,
          status: template.status,
          statusClass: template.statusClass,
          lastUpdated: template.lastUpdated,
          createdAt: template.createdAt,
          columnsCount: template.columnsCount,
          owner: template.owner,
          tags: template.tags,
          columnsDetail: template.columnsDetail,
        },
      }
    );
  }

  protected async toggleTemplateStatus(template: TemplateRow): Promise<void> {
    const templateId = template.id;
    const isPublished = template.status === 'Publicado';
    const nextStatus = isPublished ? 'unpublished' : 'published';

    if (!templateId) {
      return;
    }

    this.statusUpdating[templateId] = true;
    this.templatesError = null;

    try {
      const response = await this.templatesService.updateTemplateStatus(templateId, nextStatus);
      const displayStatus = this.toDisplayStatus(response.status ?? nextStatus);
      const updatedAt = this.toIsoDate(response.updated_at ?? new Date().toISOString());
      const statusCode = response.status ?? nextStatus;

      this.templates = this.templates.map((entry) => {
        if (entry.id !== templateId) {
          return entry;
        }

        return {
          ...entry,
          status: displayStatus,
          statusCode,
          lastUpdated: updatedAt,
        };
      });
    } catch (error) {
      console.error('[TemplateManagement] No se pudo actualizar el estado de la plantilla:', error);
      this.templatesError = this.getErrorMessage(error);
    } finally {
      delete this.statusUpdating[templateId];
    }
  }

  protected toggleUpload(templateId: string): void {
    this.uploadErrors[templateId] = null;
    if (!this.uploadInProgress[templateId]) {
      this.uploadProgress[templateId] = null;
    }
    if (this.uploadTemplateId === templateId) {
      this.uploadTemplateId = null;
      return;
    }

    this.uploadTemplateId = templateId;
    this.uploadSuccess[templateId] = null;
  }

  protected onFileSelected(event: Event, templateId: string): void {
    if (this.uploadInProgress[templateId]) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.uploadState[templateId] = null;
      this.uploadFiles[templateId] = null;
      this.uploadErrors[templateId] = null;
      return;
    }

    if (!this.isExcelFile(file)) {
      this.uploadState[templateId] = null;
      this.uploadFiles[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      input.value = '';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadFiles[templateId] = file;
    this.uploadErrors[templateId] = null;
    this.uploadSuccess[templateId] = null;
    this.uploadProgress[templateId] = null;
  }

  protected onDropFile(event: DragEvent, templateId: string): void {
    event.preventDefault();
    this.dragActiveId = null;

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    if (this.uploadInProgress[templateId]) {
      return;
    }

    if (!this.isExcelFile(file)) {
      this.uploadState[templateId] = null;
      this.uploadFiles[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadFiles[templateId] = file;
    this.uploadErrors[templateId] = null;
    this.uploadSuccess[templateId] = null;
    this.uploadProgress[templateId] = null;
  }

  protected async confirmUpload(templateId: string): Promise<void> {
    const file = this.uploadFiles[templateId];
    if (!file || this.uploadInProgress[templateId]) {
      return;
    }

    this.uploadErrors[templateId] = null;
    this.uploadSuccess[templateId] = null;
    this.uploadInProgress[templateId] = true;
    this.uploadProgress[templateId] = 0;

    try {
      const upload$ = await this.templatesService.uploadTemplateLoad(templateId, file);
      const subscription = upload$.subscribe({
        next: (event) => {
          if (!event) {
            return;
          }

          if (event.type === HttpEventType.UploadProgress) {
            if (event.total && event.total > 0) {
              const progress = Math.round((event.loaded / event.total) * 100);
              this.uploadProgress[templateId] = Math.min(progress, 100);
            } else {
              const current = this.uploadProgress[templateId] ?? 0;
              this.uploadProgress[templateId] = Math.min(current + 5, 95);
            }
            return;
          }

          if (event.type === HttpEventType.Response) {
            const message = event.body?.message ?? 'Archivo enviado correctamente.';
            const fileName = event.body?.load?.file_name ?? file.name;

            this.uploadSuccess[templateId] = message;
            this.uploadState[templateId] = fileName;
            this.uploadInProgress[templateId] = false;
            this.uploadProgress[templateId] = 100;
            this.uploadFiles[templateId] = null;
            this.resetFileInput(templateId);
          }
        },
        error: (error) => {
          console.error('[TemplateManagement] Error al cargar el archivo de plantilla:', error);
          this.uploadErrors[templateId] = this.getErrorMessage(error);
          this.uploadInProgress[templateId] = false;
          this.uploadProgress[templateId] = null;
          this.uploadFiles[templateId] = null;
          this.uploadState[templateId] = null;
          this.resetFileInput(templateId);
          delete this.uploadSubscriptions[templateId];
        },
        complete: () => {
          if (this.uploadInProgress[templateId]) {
            this.uploadInProgress[templateId] = false;
          }
          delete this.uploadSubscriptions[templateId];
        },
      });

      this.uploadSubscriptions[templateId] = subscription;
    } catch (error) {
      console.error('[TemplateManagement] No se pudo iniciar la carga del archivo:', error);
      this.uploadErrors[templateId] = this.getErrorMessage(error);
      this.uploadInProgress[templateId] = false;
      this.uploadProgress[templateId] = null;
    }
  }

  protected cancelUploadSelection(templateId: string): void {
    const subscription = this.uploadSubscriptions[templateId];
    subscription?.unsubscribe();
    delete this.uploadSubscriptions[templateId];

    this.uploadInProgress[templateId] = false;
    this.uploadProgress[templateId] = null;
    this.uploadFiles[templateId] = null;
    this.uploadState[templateId] = null;
    this.uploadErrors[templateId] = null;
    this.uploadSuccess[templateId] = null;
    this.resetFileInput(templateId);
  }

  protected onDragOver(event: DragEvent, templateId: string): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragActiveId = templateId;
  }

  protected onDragLeave(event: DragEvent, templateId: string): void {
    event.preventDefault();

    if (this.dragActiveId === templateId) {
      this.dragActiveId = null;
    }
  }

  protected openDeleteDialog(template: TemplateRow): void {
    const dialogRef = this.dialog.open<
      TemplateDeleteDialogComponent,
      TemplateDeleteDialogData,
      boolean
    >(TemplateDeleteDialogComponent, {
      disableClose: true,
      data: {
        name: template.name,
      },
    });

    dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
      if (!shouldDelete) {
        return;
      }

      void this.deleteTemplate(template.id);
    });
  }

  private async loadAssignedTemplates(): Promise<void> {
    if (this.assignedTemplatesLoading) {
      return;
    }

    this.assignedTemplatesLoading = true;
    this.assignedTemplatesError = null;

    try {
      const user = await firstValueFrom(
        this.sessionUser$.pipe(filter((value): value is CurrentUserResponse => value !== null))
      );

      const templates = await this.templatesService.fetchTemplatesForUser(user.id);
      this.assignedTemplates = templates.map((template) =>
        this.mapTemplateResponseToClient(
          template,
          Array.isArray(template.columns) ? template.columns : []
        )
      );
    } catch (error) {
      console.error('[TemplateManagement] Error al obtener plantillas asignadas:', error);
      this.assignedTemplatesError = this.getErrorMessage(error);
      this.assignedTemplates = [];
    } finally {
      this.assignedTemplatesLoading = false;
    }
  }

  private async loadTemplates(): Promise<void> {
    if (this.templatesLoading) {
      return;
    }

    this.templatesLoading = true;
    this.templatesError = null;

    try {
      const templates = await this.templatesService.fetchTemplates();
      this.templates = templates.map((template) =>
        this.mapTemplateResponseToRow(
          template,
          Array.isArray(template.columns) ? template.columns : []
        )
      );
    } catch (error) {
      console.error('[TemplateManagement] Error al obtener plantillas registradas:', error);
      this.templatesError = this.getErrorMessage(error);
      this.templates = [];
    } finally {
      this.templatesLoading = false;
    }
  }

  private addTemplateFromCreate(result: TemplateCreateDialogResult): void {
    const entry = this.mapTemplateResultToRow(result);
    this.templatesError = null;
    this.templates = [entry, ...this.templates];

    if (result.template?.id !== undefined && result.template?.id !== null) {
      void this.refreshTemplateColumns(result.template.id);
    }
  }

  private updateTemplateFromEdit(result: TemplateCreateDialogResult): void {
    const updatedEntry = this.mapTemplateResultToRow(result);
    const updatedId = updatedEntry.id;

    this.templatesError = null;
    this.templates = this.templates.map((template) => {
      if (template.id !== updatedId) {
        return template;
      }

      return {
        ...template,
        ...updatedEntry,
      };
    });

    if (result.template?.id !== undefined && result.template?.id !== null) {
      void this.refreshTemplateColumns(result.template.id);
    }
  }

  private mapTemplateResultToRow(result: TemplateCreateDialogResult): TemplateRow {
    const template = result.template;
    const columns = result.columns ?? [];
    return this.mapTemplateResponseToRow(template, columns);
  }

  private buildTemplateFilename(template: ClientTemplate): string {
    const normalizeSegment = (value: string): string =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    const baseName = normalizeSegment(template.name) || 'plantilla';
    const versionSegment =
      template.version && template.version !== '—' ? normalizeSegment(template.version) : '';

    return versionSegment ? `${baseName}-${versionSegment}.xlsx` : `${baseName}.xlsx`;
  }

  private mapTemplateResponseToRow(
    template: TemplateResponse,
    columns: TemplateColumnResponse[] = []
  ): TemplateRow {
    const createdAt = this.toIsoDate(template.created_at);
    const updatedAt = this.toIsoDate(template.updated_at ?? template.created_at);
    const status = this.toDisplayStatus(template.status);
    const version = template.table_name?.trim().length ? template.table_name : '—';

    const columnsDetail = this.mapColumnsToDetail(columns);

    return {
      id: this.normalizeId(template.id),
      name: template.name ?? 'Nueva plantilla',
      description: template.description ?? '',
      version,
      status,
      createdAt,
      lastUpdated: updatedAt,
      columns: columns.length,
      columnsDetail,
      tableName: template.table_name ?? undefined,
      statusCode: template.status ?? undefined,
    };
  }

  private mapTemplateResponseToClient(
    template: TemplateResponse,
    columns: TemplateColumnResponse[] = []
  ): ClientTemplate {
    const id = this.normalizeId(template.id);
    const name = template.name ?? 'Plantilla sin nombre';
    const description = template.description ?? '';
    const version = template.table_name?.trim().length ? template.table_name : '—';
    const lastUpdated = this.toIsoDate(template.updated_at ?? template.created_at);
    const createdAt = this.toIsoDate(template.created_at);
    const columnsDetail = this.mapColumnsToDetail(columns);
    const columnsCount = columns.length;
    const { status, statusClass } = this.toClientStatus(template.status);
    const owner = template.user_id ? `Usuario #${template.user_id}` : 'Equipo de Administración';

    return {
      id,
      name,
      description,
      version,
      status,
      statusClass,
      lastUpdated,
      createdAt,
      columnsCount,
      owner,
      tags: [],
      columnsDetail,
    };
  }

  private mapColumnsToDetail(columns: TemplateColumnResponse[]): TemplateColumnDetail[] {
    return columns.map((column) => {
      const rawRules = Array.isArray(column.rules) ? column.rules : [];
      const mappedRules: TemplateColumnRuleDetail[] = [];
      let isRequired = false;

      for (const rawRule of rawRules) {
        const mapped = this.mapRuleToDetail(rawRule);
        if (mapped) {
          mappedRules.push(mapped.detail);
          if (mapped.mandatory) {
            isRequired = true;
          }
        }
      }

      if (!isRequired) {
        isRequired = rawRules.some((rule) => this.isRuleMandatory(rule));
      }

      if (!isRequired) {
        isRequired = mappedRules.length > 0;
      }

      return {
        name: column.name,
        type: column.data_type ?? 'Dato',
        required: isRequired,
        rules: mappedRules,
        example:
          column.description && column.description.length > 0 ? column.description : undefined,
      };
    });
  }

  private toClientStatus(status: string | undefined): {
    status: ClientTemplateStatus;
    statusClass: string;
  } {
    if (!status) {
      return { status: 'En Revisión', statusClass: 'badge--draft' };
    }

    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'published':
      case 'publicado':
        return { status: 'Activo', statusClass: 'badge--active' };
      case 'inactive':
      case 'inactivo':
        return { status: 'En Revisión', statusClass: 'badge--inactive' };
      default:
        return { status: 'En Revisión', statusClass: 'badge--draft' };
    }
  }

  private mapRuleToDetail(
    rule: TemplateColumnRulePayload
  ): { detail: TemplateColumnRuleDetail; mandatory: boolean } | null {
    const id = this.extractRuleId(rule.id);
    const payload = this.extractRulePayload(rule);
    const normalizedPayload = normalizeAiPayload(payload);
    const mandatory = this.toBoolean(
      normalizedPayload?.['Campo obligatorio'] ?? this.extractMandatoryFlag(rule, payload)
    );

    if (normalizedPayload) {
      const summaryDisplay = this.buildRuleDisplayFromPayload(normalizedPayload, id);
      const summary = this.buildRuleSummaryText(summaryDisplay);

      return {
        detail: {
          id: id ?? undefined,
          requiresLookup: false,
          loading: false,
          summary,
          summaryDisplay,
        },
        mandatory,
      };
    }

    if (!id) {
      return null;
    }

    return {
      detail: {
        id,
        requiresLookup: true,
        loading: true,
      },
      mandatory,
    };
  }

  private isRuleMandatory(rule: TemplateColumnRulePayload): boolean {
    const payload = this.extractRulePayload(rule);
    const normalizedPayload = normalizeAiPayload(payload);
    if (normalizedPayload) {
      return this.toBoolean(normalizedPayload['Campo obligatorio']);
    }

    return this.toBoolean(this.extractMandatoryFlag(rule, payload));
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

  private extractMandatoryFlag(rule: TemplateColumnRulePayload, payload: unknown): unknown {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      if ('Campo obligatorio' in record) {
        return record['Campo obligatorio'];
      }
    }

    if (rule && typeof rule === 'object') {
      const record = rule as Record<string, unknown>;
      if ('Campo obligatorio' in record) {
        return record['Campo obligatorio'];
      }
    }

    return undefined;
  }

  private buildRuleDisplayFromPayload(
    payload: RulePayload,
    ruleId: string | null
  ): { title: string; description?: string; conditions?: string[] } {
    const titleParts: string[] = [];
    const name = this.sanitizeString(payload['Nombre de la regla']);
    const dataType = this.sanitizeString(payload['Tipo de dato']);

    if (name) {
      titleParts.push(name);
    }

    if (dataType) {
      titleParts.push(`(${dataType})`);
    }

    const title =
      titleParts.join(' ').trim() || (ruleId ? `Regla ${ruleId}` : 'Resumen de la regla');
    const description = this.sanitizeString(payload['Descripción']) ?? undefined;
    const conditions = this.sanitizeStringArray(payload['Header rule']);

    return {
      title,
      description,
      conditions,
    };
  }

  private buildRuleSummaryText(display: {
    title: string;
    description?: string;
    conditions?: string[];
  }): string {
    const segments: string[] = [];

    const title = this.sanitizeString(display.title) ?? '';
    if (title) {
      segments.push(title);
    }

    const description = this.sanitizeString(display.description);
    if (description && description !== title) {
      segments.push(description);
    }

    if (display.conditions?.length) {
      segments.push(`Condiciones: ${display.conditions.join(', ')}`);
    }

    return segments.join('. ');
  }

  private sanitizeString(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return null;
  }

  private sanitizeStringArray(value: unknown): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeString(item))
        .filter((item): item is string => !!item);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }

    return [];
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

  private toDisplayStatus(status: string | undefined): TemplateStatus {
    if (!status) {
      return 'Borrador';
    }

    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case 'published':
      case 'publicado':
        return 'Publicado';
      case 'inactive':
      case 'inactivo':
        return 'Inactivo';
      case 'draft':
      case 'unpublished':
      default:
        return 'Borrador';
    }
  }

  private toIsoDate(value: string | undefined): string {
    if (!value) {
      return new Date().toISOString().slice(0, 10);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private normalizeId(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return this.generateId();
  }

  private extractRuleId(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toString();
    }

    return null;
  }

  private async refreshTemplateColumns(templateId: number | string): Promise<void> {
    try {
      const columns = await this.templatesService.fetchTemplateColumns(templateId);
      const normalizedId = this.normalizeId(templateId);
      const columnsDetail = this.mapColumnsToDetail(columns);

      this.templates = this.templates.map((template) => {
        if (template.id !== normalizedId) {
          return template;
        }

        return {
          ...template,
          columns: columns.length,
          columnsDetail,
        };
      });
    } catch (error) {
      console.error(
        '[TemplateManagement] No se pudieron sincronizar las columnas de la plantilla creada.',
        error
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (!error) {
      return 'Ocurrió un error inesperado. Intenta nuevamente más tarde.';
    }

    if (typeof error === 'string') {
      return error;
    }

    const message = (error as { message?: string }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }

    const responseError = (error as { error?: unknown }).error;
    if (responseError && typeof responseError === 'object') {
      const detail = (responseError as { detail?: unknown }).detail;

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0];
        if (
          first &&
          typeof first === 'object' &&
          'msg' in first &&
          typeof (first as { msg?: unknown }).msg === 'string'
        ) {
          const msg = (first as { msg: string }).msg.trim();
          if (msg.length > 0) {
            return msg;
          }
        }
      }
    }

    return 'No fue posible completar la operación. Intenta nuevamente.';
  }

  private async deleteTemplate(templateId: string): Promise<void> {
    if (!templateId || this.deletingTemplates[templateId]) {
      return;
    }

    this.templatesError = null;
    this.deletingTemplates[templateId] = true;

    try {
      await this.templatesService.deleteTemplate(templateId);
      this.templates = this.templates.filter((template) => template.id !== templateId);
    } catch (error) {
      console.error('[TemplateManagement] No se pudo eliminar la plantilla seleccionada:', error);
      this.templatesError = this.getErrorMessage(error);
    } finally {
      delete this.deletingTemplates[templateId];
    }
  }

  private generateId(): string {
    return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private isExcelFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension === 'xlsx' || extension === 'xls';
  }

  private resetFileInput(templateId: string): void {
    const input = document.getElementById(`upload-${templateId}`) as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }
}
