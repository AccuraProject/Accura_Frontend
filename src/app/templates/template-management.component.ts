import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import {
  TemplateFormDialogComponent,
  TemplateFormDialogData,
  TemplateFormDialogResult
} from './template-form-dialog.component';
import {
  TemplateCreateDialogComponent,
  TemplateCreateDialogResult
} from './template-create-dialog.component';
import {
  TemplateColumnDetail,
  TemplateDetailDialogComponent,
  TemplateDetailDialogData
} from './template-detail-dialog.component';
import { TemplateDeleteDialogComponent, TemplateDeleteDialogData } from './template-delete-dialog.component';
import { selectIsAdmin } from '../core/store/session/session.selectors';
import { TemplateColumnResponse, TemplatesService } from './templates.service';

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
  styleUrl: './template-management.component.scss'
})
export class TemplateManagementComponent {
  private readonly dialog = inject(MatDialog);
  private readonly store = inject(Store);
  private readonly templatesService = inject(TemplatesService);

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

   protected templates: TemplateRow[] = [
     {
       id: 'policy-template',
       name: 'Plantilla de Pólizas',
       description: 'Plantilla para cargar datos de pólizas emitidas mensualmente.',
       version: 'v1.0',
       status: 'Publicado',
       createdAt: '2024-11-12',
       lastUpdated: '2025-02-14',
       columns: 14,
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
           rule: 'Debe corresponder al mes reportado',
           example: '2025-02-01'
         },
         {
           name: 'Tipo de Seguro',
           type: 'Catálogo',
           required: true,
           rule: 'Valor contenido en catálogo corporativo',
           example: 'Autos'
         },
         {
           name: 'Prima Total',
           type: 'Numérico',
           required: true,
           rule: 'Mayor a 0 y con dos decimales',
           example: '120000.00'
         }
       ]
     },
     {
       id: 'claims-template',
       name: 'Plantilla de Siniestros',
       description: 'Plantilla para registrar siniestros reportados por los asegurados.',
       version: 'v2.1',
       status: 'Borrador',
       createdAt: '2024-10-03',
       lastUpdated: '2025-01-28',
       columns: 11,
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
       id: 'brokers-template',
       name: 'Plantilla de Brokers',
       description: 'Estructura para actualizar información de brokers y agentes externos.',
       version: 'v1.3',
       status: 'Inactivo',
       createdAt: '2024-07-22',
       lastUpdated: '2024-12-18',
       columns: 9,
       columnsDetail: [
         {
           name: 'Código de Broker',
           type: 'Texto',
           required: true,
           rule: 'Formato alfanumérico único',
           example: 'BRK-0123'
         },
         {
           name: 'Nombre Comercial',
           type: 'Texto',
           required: true,
           rule: 'Máximo 80 caracteres',
           example: 'Agencia Norte'
         },
         {
           name: 'Correo de Contacto',
           type: 'Correo',
           required: true,
           rule: 'Debe ser un correo válido',
           example: 'contacto@agencianorte.com'
         }
       ]
     }
   ];

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
           rule: 'Seleccionar entre los valores definidos',
           example: 'Vida'
         },
         {
           name: 'Prima Total',
           type: 'Numérico',
           required: true,
           rule: 'Mayor a 0, separador decimal con punto',
           example: '120000.00'
         }
       ]
     },
     {
       id: 'claims-template',
       name: 'Plantilla de Siniestros',
       description: 'Plantilla para registrar siniestros reportados por los asegurados.',
       version: 'v1.3',
       status: 'En Revisión',
       statusClass: 'badge--review',
       lastUpdated: '2025-03-15',
       createdAt: '2024-10-03',
       columnsCount: 12,
       owner: 'Equipo de Riesgos',
       tags: ['Seguimiento', 'Reportes'],
       columnsDetail: [
         {
           name: 'Número de Siniestro',
           type: 'Texto',
           required: true,
           rule: 'Formato consecutivo SIN-XXX-YYYY',
           example: 'SIN-021-2025'
         },
         {
           name: 'Fecha del Evento',
           type: 'Fecha',
           required: true,
           rule: 'Debe ser anterior o igual a la fecha de carga',
           example: '2025-03-10'
         },
         {
           name: 'Estado del Siniestro',
           type: 'Catálogo',
           required: true,
           rule: 'Valores permitidos: Abierto, En proceso, Cerrado',
           example: 'En proceso'
         },
         {
           name: 'Monto Estimado',
           type: 'Numérico',
           required: false,
           rule: 'Opcional, máximo 2 decimales',
           example: '45000.50'
         }
       ]
     }
   ];

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

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      TemplateCreateDialogComponent,
      void,
      TemplateCreateDialogResult
    >(TemplateCreateDialogComponent, {
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result: TemplateCreateDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addTemplateFromCreate(result);
    });
  }

   protected openEditDialog(template: TemplateRow): void {
     const dialogRef = this.dialog.open<
       TemplateFormDialogComponent,
       TemplateFormDialogData,
       TemplateFormDialogResult
     >(TemplateFormDialogComponent, {
       disableClose: true,
       data: {
         mode: 'edit',
         template: {
           name: template.name,
           description: template.description
         }
       }
     });

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
           version: template.version,
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
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.uploadState[templateId] = null;
      this.uploadErrors[templateId] = null;
      return;
    }

    if (!this.isExcelFile(file)) {
      this.uploadState[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      input.value = '';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadErrors[templateId] = null;
  }

  protected onDropFile(event: DragEvent, templateId: string): void {
    event.preventDefault();
    this.dragActiveId = null;

    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }

    if (!this.isExcelFile(file)) {
      this.uploadState[templateId] = null;
      this.uploadErrors[templateId] = 'Solo se aceptan archivos con formato .xlsx o .xls';
      return;
    }

    this.uploadState[templateId] = file.name;
    this.uploadErrors[templateId] = null;
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
     const dialogRef = this.dialog.open<TemplateDeleteDialogComponent, TemplateDeleteDialogData, boolean>(
       TemplateDeleteDialogComponent,
       {
         disableClose: true,
         data: {
           name: template.name
         }
       }
     );

     dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
       if (!shouldDelete) {
         return;
       }

       this.removeTemplate(template.id);
     });
   }

  private addTemplateFromCreate(result: TemplateCreateDialogResult): void {
    const entry = this.mapTemplateResultToRow(result);
    this.templates = [entry, ...this.templates];

    if (result.template?.id !== undefined && result.template?.id !== null) {
      void this.refreshTemplateColumns(result.template.id);
    }
  }

  private mapTemplateResultToRow(result: TemplateCreateDialogResult): TemplateRow {
    const template = result.template;
    const columns = result.columns ?? [];

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
      statusCode: template.status ?? undefined
    };
  }

  private mapColumnsToDetail(columns: TemplateColumnResponse[]): TemplateColumnDetail[] {
    return columns.map((column) => {
      const ruleSummary = Array.isArray(column.rules) && column.rules.length > 0
        ? `Reglas asignadas: ${column.rules.map((rule) => rule.id).join(', ')}`
        : 'Sin reglas configuradas';

      return {
        name: column.name,
        type: column.data_type ?? 'Dato',
        required: (column.rules?.length ?? 0) > 0,
        rule: ruleSummary,
        example: column.description && column.description.length > 0 ? column.description : undefined
      };
    });
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
          columnsDetail
        };
      });
    } catch (error) {
      console.error('[TemplateManagement] No se pudieron sincronizar las columnas de la plantilla creada.', error);
    }
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
         lastUpdated: new Date().toISOString().slice(0, 10)
       };
     });
   }

   private removeTemplate(templateId: string): void {
     this.templates = this.templates.filter((template) => template.id !== templateId);
  }

  private generateId(): string {
    return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private isExcelFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension === 'xlsx' || extension === 'xls';
  }
}
