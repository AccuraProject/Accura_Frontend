import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { TemplateCreateDialogComponent } from './template-create-dialog.component';
import {
  TemplateFormDialogComponent,
  TemplateFormDialogData,
  TemplateFormDialogResult
} from './template-form-dialog.component';
import {
  TemplateColumnDetail,
  TemplateDetailDialogComponent,
  TemplateDetailDialogData
} from './template-detail-dialog.component';
import { TemplateDeleteDialogComponent, TemplateDeleteDialogData } from './template-delete-dialog.component';
import { TemplateService, TemplateWithColumns } from './template.service';
import { selectIsAdmin } from '../core/store/session/session.selectors';

type ManagementTemplateStatus = 'Publicado' | 'Borrador' | 'Inactivo';
type ClientTemplateStatus = 'Activo' | 'En Revisión';
type TemplateStatus = ManagementTemplateStatus | ClientTemplateStatus;

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  tableName: string;
  status: TemplateStatus;
  createdAt: string;
  lastUpdated: string;
  columns: number;
  columnsDetail: TemplateColumnDetail[];
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
  styleUrl: './template-management.component.scss'
})
export class TemplateManagementComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(Store);
  private readonly templateService = inject(TemplateService);

  protected searchTerm = '';
  protected statusFilter: ManagementTemplateStatus | 'Todos' = 'Todos';
  protected uploadTemplateId: string | null = null;
  protected uploadState: Record<string, string | null> = {};
  protected uploadErrors: Record<string, string | null> = {};
  protected dragActiveId: string | null = null;

  protected readonly isAdmin$: Observable<boolean> = this.store.select(selectIsAdmin);

  protected readonly statusOptions: (TemplateStatus | 'Todos')[] = [
    'Todos',
    'Publicado',
    'Borrador',
    'Inactivo'
  ];

  protected templates: TemplateRow[] = [];
  protected templatesLoading = false;
  protected templatesError: string | null = null;

  protected readonly assignedTemplates: ClientTemplate[] = [
    {
      id: 'policy-template',
      name: 'Plantilla de Pólizas',
      description: 'Plantilla para registrar pólizas emitidas mensualmente.',
      version: 'v1.0',
      status: 'Activo',
      statusClass: 'badge--active',
      lastUpdated: '2025-04-01',
      createdAt: '2024-11-12',
      columnsCount: 14,
      owner: 'María Hernández',
      tags: ['Mensual', 'Carga Masiva'],
      columnsDetail: [
        {
          name: 'Número de Póliza',
          type: 'Texto',
          required: true,
          rule: 'Formato alfanumérico de 12 caracteres',
          example: 'POL-2025-001'
        },
        {
          name: 'Fecha de Emisión',
          type: 'Fecha',
          required: true,
          rule: 'Debe coincidir con el periodo reportado',
          example: '2025-04-01'
        },
        {
          name: 'Tipo de Seguro',
          type: 'Catálogo',
          required: true,
          rule: 'Valor contenido en catálogo corporativo',
          example: 'Autos'
        }
      ]
    },
    {
      id: 'claims-template',
      name: 'Plantilla de Siniestros',
      description: 'Plantilla para registrar siniestros reportados por los asegurados.',
      version: 'v2.1',
      status: 'En Revisión',
      statusClass: 'badge--review',
      lastUpdated: '2025-03-18',
      createdAt: '2024-10-03',
      columnsCount: 11,
      owner: 'Javier Torres',
      tags: ['Carga diaria', 'Reportes'],
      columnsDetail: [
        {
          name: 'Número de Siniestro',
          type: 'Texto',
          required: true,
          rule: 'Formato consecutivo asignado por el sistema',
          example: 'SIN-001-2025'
        },
        {
          name: 'Fecha del Evento',
          type: 'Fecha',
          required: true,
          rule: 'No puede ser posterior a la fecha de registro',
          example: '2025-01-12'
        },
        {
          name: 'Monto Estimado',
          type: 'Numérico',
          required: false,
          rule: 'Hasta dos decimales, opcional',
          example: '45000.50'
        }
      ]
    },
    {
      id: 'logistics-template',
      name: 'Plantilla de Inventario',
      description: 'Plantilla para cargar ajustes de inventario de almacenes.',
      version: 'v1.5',
      status: 'Activo',
      statusClass: 'badge--active',
      lastUpdated: '2025-02-28',
      createdAt: '2024-09-14',
      columnsCount: 9,
      owner: 'Claudia Medina',
      tags: ['Inventario', 'ERP'],
      columnsDetail: [
        {
          name: 'Código de Producto',
          type: 'Texto',
          required: true,
          rule: 'Código alfanumérico único',
          example: 'PRD-9821'
        },
        {
          name: 'Cantidad Ajustada',
          type: 'Numérico',
          required: true,
          rule: 'Puede ser negativo o positivo',
          example: '-15'
        },
        {
          name: 'Motivo',
          type: 'Texto',
          required: true,
          rule: 'Debe seleccionarse de la lista de motivos',
          example: 'Rotura en almacén'
        }
      ]
    }
  ];

  async ngOnInit(): Promise<void> {
    await this.loadTemplates();
  }

  protected get filteredTemplates(): TemplateRow[] {
    const items = this.templates;
    const term = this.searchTerm.trim().toLowerCase();

    return items.filter((template) => {
      const matchesSearch =
        term.length === 0 ||
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.tableName.toLowerCase().includes(term);
      const matchesStatus = this.statusFilter === 'Todos' || template.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  protected get filteredAssignedTemplates(): ClientTemplate[] {
    return this.assignedTemplates.filter((template) => {
      const term = this.searchTerm.trim().toLowerCase();
      if (term.length === 0) {
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

  protected statusClass(status: TemplateStatus): string {
    switch (status) {
      case 'Publicado':
      case 'Activo':
        return 'badge--active';
      case 'En Revisión':
        return 'badge--review';
      case 'Borrador':
        return 'badge--draft';
      case 'Inactivo':
        return 'badge--inactive';
      default:
        return 'badge--inactive';
    }
  }

  protected refreshTemplates(): void {
    void this.loadTemplates();
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<TemplateCreateDialogComponent, void, boolean>(
      TemplateCreateDialogComponent,
      {
        disableClose: true
      }
    );

    dialogRef.afterClosed().subscribe((shouldRefresh) => {
      if (shouldRefresh) {
        void this.loadTemplates();
      }
    });
  }

  protected openEditDialog(template: TemplateRow): void {
    const dialogRef = this.dialog.open<TemplateFormDialogComponent, TemplateFormDialogData, TemplateFormDialogResult>(
      TemplateFormDialogComponent,
      {
        data: {
          mode: 'edit',
          template: {
            name: template.name,
            description: template.description
          }
        }
      }
    );

    dialogRef.afterClosed().subscribe((result: TemplateFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.updateTemplate(template.id, result);
    });
  }

  protected openDetailDialog(template: TemplateRow): void {
    this.dialog.open<TemplateDetailDialogComponent, TemplateDetailDialogData, void>(
      TemplateDetailDialogComponent,
      {
        data: {
          name: template.name,
          description: template.description,
          version: template.tableName,
          status: template.status,
          createdAt: template.createdAt,
          lastUpdated: template.lastUpdated,
          columnsCount: template.columns,
          columnsDetail: template.columnsDetail
        }
      }
    );
  }

  protected openClientDetailDialog(template: ClientTemplate): void {
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
          columnsDetail: template.columnsDetail
        }
      }
    );
  }

  protected toggleUpload(templateId: string): void {
    this.uploadErrors[templateId] = null;
    if (this.uploadTemplateId === templateId) {
      this.uploadTemplateId = null;
      return;
    }

    this.uploadTemplateId = templateId;
  }

  protected onFileSelected(event: Event, templateId: string): void {
    const input = event.target as HTMLInputElement | null;
    if (!input || !input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    if (!file) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['xlsx', 'xls'].includes(extension)) {
      this.uploadState[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadErrors[templateId] = null;
  }

  protected onDropFile(event: DragEvent, templateId: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.dragActiveId = null;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['xlsx', 'xls'].includes(extension)) {
      this.uploadState[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadErrors[templateId] = null;
  }

  protected onDragOver(event: DragEvent, templateId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragActiveId = templateId;
  }

  protected onDragLeave(event: DragEvent, templateId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.dragActiveId === templateId) {
      this.dragActiveId = null;
    }
  }

  protected openDeleteDialog(template: TemplateRow): void {
    const dialogRef = this.dialog.open<TemplateDeleteDialogComponent, TemplateDeleteDialogData, boolean>(
      TemplateDeleteDialogComponent,
      {
        data: {
          name: template.name
        }
      }
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.removeTemplate(template.id);
    });
  }

  private addTemplate(result: TemplateFormDialogResult): void {
    const entry: TemplateRow = {
      id: this.generateTemplateId(),
      name: result.name,
      description: result.description,
      tableName: '—',
      status: 'Borrador',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      columns: 0,
      columnsDetail: []
    };

    this.templates = [entry, ...this.templates];
  }

  private updateTemplate(templateId: string, result: TemplateFormDialogResult): void {
    this.templates = this.templates.map((template) => {
      if (template.id !== templateId) {
        return template;
      }

      return {
        ...template,
        name: result.name,
        description: result.description,
        lastUpdated: new Date().toISOString()
      };
    });
  }

  private removeTemplate(templateId: string): void {
    this.templates = this.templates.filter((template) => template.id !== templateId);
  }

  private generateTemplateId(): string {
    return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private async loadTemplates(): Promise<void> {
    this.templatesLoading = true;
    this.templatesError = null;

    try {
      const response = await this.templateService.fetchTemplates();
      this.templates = response.map((template) => this.mapTemplateResponse(template));
    } catch (error) {
      console.error('[TemplateManagement] Error al cargar plantillas:', error);
      this.templatesError = this.getErrorMessage(error);
      this.templates = [];
    } finally {
      this.templatesLoading = false;
    }
  }

  private mapTemplateResponse(entry: TemplateWithColumns): TemplateRow {
    const id = this.toId(entry.id);
    const status = this.toStatus(entry.status, entry.is_active);
    const name = this.sanitizeString(entry.name) ?? 'Plantilla sin nombre';
    const description = this.sanitizeString(entry.description) ?? '';
    const tableName = this.sanitizeString(entry.table_name) ?? '—';
    const createdAt = this.sanitizeDate(entry.created_at);
    const updatedAt = this.sanitizeDate(entry.updated_at);

    const columnsDetail: TemplateColumnDetail[] = (entry.columns ?? []).map((column) => ({
      name: this.sanitizeString(column.name) ?? 'Columna sin nombre',
      type: this.sanitizeString(column.data_type) ?? 'No especificado',
      required: Boolean(column.is_active ?? false),
      rule: this.buildRuleDescription(column.rule_id),
      example: this.sanitizeString(column.description) ?? undefined
    }));

    return {
      id,
      name,
      description,
      tableName,
      status,
      createdAt,
      lastUpdated: updatedAt,
      columns: columnsDetail.length,
      columnsDetail
    };
  }

  private toId(id: unknown): string {
    if (typeof id === 'string') {
      return id;
    }

    if (typeof id === 'number' && Number.isFinite(id)) {
      return String(id);
    }

    return this.generateTemplateId();
  }

  private toStatus(status: unknown, isActive: unknown): ManagementTemplateStatus {
    const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

    switch (normalized) {
      case 'published':
      case 'publicado':
        return 'Publicado';
      case 'inactive':
      case 'inactivo':
        return 'Inactivo';
      case 'draft':
      case 'borrador':
      case 'unpublished':
        return 'Borrador';
      default: {
        const active = typeof isActive === 'boolean' ? isActive : true;
        return active ? 'Publicado' : 'Inactivo';
      }
    }
  }

  private sanitizeString(value: unknown): string | null {
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 ? text : null;
    }

    return null;
  }

  private sanitizeDate(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date().toISOString();
  }

  private buildRuleDescription(ruleId: unknown): string {
    if (typeof ruleId === 'number' && Number.isFinite(ruleId)) {
      return `Regla #${ruleId}`;
    }

    if (typeof ruleId === 'string' && ruleId.trim().length > 0) {
      return `Regla ${ruleId.trim()}`;
    }

    return 'Sin regla asignada';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const detail = record['detail'] ?? record['message'];

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      if (Array.isArray(detail)) {
        const messages = detail
          .map((entry) => {
            if (entry && typeof entry === 'object' && 'msg' in entry) {
              const message = (entry as Record<string, unknown>)['msg'];
              return typeof message === 'string' ? message.trim() : null;
            }
            return null;
          })
          .filter((msg): msg is string => Boolean(msg));

        if (messages.length > 0) {
          return messages.join('. ');
        }
      }
    }

    return 'No fue posible obtener las plantillas. Intenta nuevamente más tarde.';
  }
}
