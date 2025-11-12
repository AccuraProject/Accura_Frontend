import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
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
import { TemplateService, TemplateResponse, TemplateColumnResponse } from './template.service';
import { ValidationRulesService } from '../validation-rules/validation-rules.service';
import { selectIsAdmin } from '../core/store/session/session.selectors';

type ManagementTemplateStatus = 'Publicado' | 'Borrador' | 'Inactivo';
type ClientTemplateStatus = 'Activo' | 'En Revisión';
type TemplateStatus = ManagementTemplateStatus | ClientTemplateStatus;

interface RuleOption {
  id: number;
  name: string;
  dataType: string;
  headerRule: string[];
}

interface TemplateRow {
  id: number;
  name: string;
  description: string;
  tableName: string;
  version: string;
  status: ManagementTemplateStatus;
  backendStatus: string;
  createdAt: string | null;
  lastUpdated: string | null;
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
  private readonly validationRulesService = inject(ValidationRulesService);

  private rulesDictionary = new Map<number, RuleOption>();

  protected searchTerm = '';
  protected statusFilter: ManagementTemplateStatus | 'Todos' = 'Todos';
  protected uploadTemplateId: string | null = null;
  protected uploadState: Record<string, string | null> = {};
  protected uploadErrors: Record<string, string | null> = {};
  protected dragActiveId: string | null = null;

  protected readonly isAdmin$: Observable<boolean> = this.store.select(selectIsAdmin);

  protected readonly statusOptions: (ManagementTemplateStatus | 'Todos')[] = [
    'Todos',
    'Publicado',
    'Borrador',
    'Inactivo'
  ];

  protected templates: TemplateRow[] = [];
  protected templatesLoading = false;
  protected templatesError: string | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    if (this.templatesLoading) {
      return;
    }

    this.templatesLoading = true;
    this.templatesError = null;

    try {
      await this.loadRulesDictionary();
      const templates = await this.templateService.listTemplates();

      const entries = await Promise.all(
        templates.map(async (template) => {
          try {
            const columns = await this.templateService.listColumns(template.id);
            return this.mapTemplate(template, columns);
          } catch (error) {
            console.error('[TemplateManagement] Error al obtener columnas', error);
            return this.mapTemplate(template, []);
          }
        })
      );

      this.templates = entries;
    } catch (error) {
      console.error('[TemplateManagement] Error al cargar plantillas', error);
      this.templatesError = this.getErrorMessage(error, 'No fue posible obtener las plantillas registradas.');
      this.templates = [];
    } finally {
      this.templatesLoading = false;
    }
  }

  private async loadRulesDictionary(): Promise<void> {
    try {
      const data = await this.validationRulesService.fetchRules();
      const rules = this.parseRuleListResponse(data);
      this.rulesDictionary = new Map(rules.map((rule) => [rule.id, rule]));
    } catch (error) {
      console.error('[TemplateManagement] Error al obtener reglas', error);
      this.rulesDictionary = new Map();
    }
  }

  private mapTemplate(template: TemplateResponse, columns: TemplateColumnResponse[]): TemplateRow {
    const status = this.normalizeStatus(template.status);
    return {
      id: template.id,
      name: template.name,
      description: template.description ?? '',
      tableName: template.table_name,
      version: '—',
      status,
      backendStatus: template.status,
      createdAt: template.created_at ?? null,
      lastUpdated: template.updated_at ?? template.created_at ?? null,
      columns: columns.length,
      columnsDetail: columns.map((column) => this.mapColumn(column)),
    };
  }

  private mapColumn(column: TemplateColumnResponse): TemplateColumnDetail {
    const rules = Array.isArray(column.rules) ? column.rules : [];
    const ruleDescriptions = rules
      .map((rule) => {
        const id = Number(rule.id);
        if (!Number.isFinite(id)) {
          return null;
        }

        const headerRule = Array.isArray(rule['header rule'])
          ? rule['header rule']
              .map((item) => (typeof item === 'string' ? item.trim() : ''))
              .filter((item) => item.length > 0)
          : [];

        const ruleInfo = this.rulesDictionary.get(id);
        const label = ruleInfo ? ruleInfo.name : `Regla ${id}`;

        if (headerRule.length > 0) {
          return `${label} (${headerRule.join(', ')})`;
        }

        return label;
      })
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return {
      name: column.name,
      type: column.data_type ?? '—',
      required: false,
      rule: ruleDescriptions.length > 0 ? ruleDescriptions.join('; ') : '—',
      example: column.description ?? '',
    };
  }

  private normalizeStatus(status: string | null | undefined): ManagementTemplateStatus {
    const value = (status ?? '').toLowerCase();
    switch (value) {
      case 'published':
      case 'publicado':
        return 'Publicado';
      case 'inactive':
      case 'inactivo':
        return 'Inactivo';
      default:
        return 'Borrador';
    }
  }

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

  private parseRuleListResponse(data: unknown): RuleOption[] {
    if (Array.isArray(data)) {
      return data
        .map((item) => this.parseRuleItem(item))
        .filter((rule): rule is RuleOption => rule !== null);
    }

    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      const collectionKeys = ['items', 'rules', 'data'];

      for (const key of collectionKeys) {
        const collection = record[key];
        if (Array.isArray(collection)) {
          return collection
            .map((item) => this.parseRuleItem(item))
            .filter((rule): rule is RuleOption => rule !== null);
        }
      }

      const single = this.parseRuleItem(record);
      return single ? [single] : [];
    }

    return [];
  }

  private parseRuleItem(entry: unknown): RuleOption | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;
    const payloadCandidate = record['payload'] ?? record['rule'] ?? entry;

    if (!payloadCandidate || typeof payloadCandidate !== 'object') {
      return null;
    }

    const payload = payloadCandidate as Record<string, unknown>;
    const idValue = record['id'] ?? record['uuid'] ?? record['pk'];
    const id = Number(idValue);

    if (!Number.isFinite(id)) {
      return null;
    }

    const name = this.toString(payload['Nombre de la regla']);
    const dataType = this.toString(payload['Tipo de dato']);
    const headerRule = this.toStringArray(payload['Header rule']);

    if (!name || !dataType) {
      return null;
    }

    return {
      id,
      name,
      dataType,
      headerRule,
    };
  }

  private toString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.toString(item))
        .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
    }

    const text = this.toString(value);
    return text ? [text] : [];
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const record = error as Record<string, unknown>;
    const detail = record['detail'];

    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }

    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String(item['msg']);
          }
          return null;
        })
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .join('\n');

      if (message) {
        return message;
      }
    }

    const message = record['message'];
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    return fallback;
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

  protected trackByTemplateId(_: number, template: TemplateRow): number {
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
      undefined,
      TemplateCreateDialogResult
    >(TemplateCreateDialogComponent, {
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: TemplateCreateDialogResult | undefined) => {
      if (!result) {
        return;
      }

      const entry = this.mapTemplate(result.template, result.columns);
      this.templates = [entry, ...this.templates];
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
    this.dialog.open(TemplateDetailDialogComponent, {
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
    });
  }

  protected openClientDetailDialog(template: ClientTemplate): void {
    this.dialog.open(TemplateDetailDialogComponent, {
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
    });
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

  private updateTemplate(templateId: number, result: TemplateFormDialogResult): void {
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

  private removeTemplate(templateId: number): void {
    this.templates = this.templates.filter((template) => template.id !== templateId);
  }

  private isExcelFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension === 'xlsx' || extension === 'xls';
  }
}
