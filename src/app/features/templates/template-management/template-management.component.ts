import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { selectIsAdmin, selectSessionUser } from '../../../core/store/session/session.selectors';
import { TemplateResponse, TemplatesService } from '../templates.service';
import { PageActionsComponent } from '../../../shared/components/ui/page-actions/page-actions';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../../shared/components/data/data-table/data-table';
import { ToastService } from '../../../shared/services/toast.service';
import { ConfirmService } from '../../../shared/services/confirm.service';
import { formatDate } from '../../../shared/utils/date-util';
import {
  SaveTemplateColumnsEvent,
  TemplateDialogData,
  TemplateFormDialogComponent,
} from '../components/template-form-dialog/template-form-dialog.component';

type ManagementTemplateStatus = 'Publicado' | 'Borrador' | 'Inactivo';
type ClientTemplateStatus = 'Activo' | 'En Revisión';
type TemplateStatus = ManagementTemplateStatus | ClientTemplateStatus;

interface TemplateRow {
  id: number;
  name: string;
  description: string;
  version: string;
  status: TemplateStatus;
  createdAt: string;
  lastUpdated: string;
  tableName?: string;
  statusCode?: string;
}

@Component({
  selector: 'app-template-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatMenuModule,
    PageActionsComponent,
    DataTableComponent,
    TemplateFormDialogComponent,
  ],
  templateUrl: './template-management.component.html',
  styleUrl: './template-management.component.scss',
})
export class TemplateManagementComponent implements OnInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  protected searchTerm = '';

  private readonly dialog = inject(MatDialog);
  private readonly store = inject(Store);
  private readonly templatesService = inject(TemplatesService);
  private readonly sessionUser$ = this.store.select(selectSessionUser);

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

  protected selectedTemplate: TemplateRow | null = null;
  protected isEditing = false;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  columns: DataTableColumn[] = [
    { field: 'name', header: 'Nombre' },
    { field: 'version', header: 'Versión' },
    { field: 'description', header: 'Descripción' },
    { field: 'createdAt', header: 'Fecha de creación', align: 'center' },
    { field: 'lastUpdated', header: 'Última actualización', align: 'center' },
    {
      field: 'status',
      header: 'Estado',
      align: 'center',
      isBadge: true,
      badgeSeverityMap: {
        'Publicado': 'success',
        'Borrador': 'info',
      },
    },
  ];

  protected templateDialogVisible = false;
  protected templateDialogLoading = false;

  templateDialogData: TemplateDialogData = {
    mode: 'create',
  };

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

  get isPublishTemplateDisabled(): boolean {
    return !this.selectedTemplate || !(this.selectedTemplate.statusCode == 'unpublished');
  }

  onRowSelect(template: TemplateRow) {
    this.selectedTemplate = template;
  }

  onRowUnselect() {
    this.selectedTemplate = null;
  }

  onCreateTemplate(): void {
    this.isEditing = false;
    this.openCreateDialog();
  }

  onEditTemplate(): void {
    this.isEditing = true;
    if (!this.selectedTemplate) return;

    const template = this.selectedTemplate;

    this.openEditDialog(template);
  }

  onDeleteTemplate(): void {
    if (!this.selectedTemplate) return;

    const template = this.selectedTemplate;

    this.confirm.confirmDelete(() => {
      this.handleDeleteTemplate(template.id);
    });
  }

  onPublishTemplate(): void {
    if (!this.selectedTemplate || !(this.selectedTemplate.statusCode == 'unpublished')) return;

    const template = this.selectedTemplate;

    this.confirm.confirmAction(
      () => this.handlePublishTemplate(template.id),
      `Se publicará la plantilla <b>${template.name}</b>. Una vez publicada, no podrás editarla. ¿Deseas continuar?`,
      'Publicar plantilla',
      'Publicar',
    );
  }

  onDuplicateTemplate(): void {
    if (!this.selectedTemplate) return;

    const template = this.selectedTemplate;

    this.confirm.confirmAction(
      () => this.handleDuplicateTemplate(template.id),
      `Se duplicará la plantilla <b>${template.name}</b>. ¿Deseas continuar?`,
      'Duplicar plantilla',
      'Duplicar',
    );
  }

  handleSaveTemplate(event: SaveTemplateColumnsEvent): void {
    this.templateDialogLoading = true;
    this.cdr.markForCheck();

    if (!this.isEditing) {
      if (event.templateId) {
        this.templatesService
          .saveTemplateColumns(event.templateId, event.columns)
          .pipe(
            finalize(() => {
              this.templateDialogLoading = false;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: () => {
              this.loadTemplates();
              this.toast.success('Plantilla creada exitosamente.');
              this.closeTemplateDialog();
            },
            error: (error: unknown) => {
              const message = this.templatesService.getErrorMessage(error);
              this.toast.error(message);
            },
          });
      } else {
        this.templateDialogLoading = false;
        this.cdr.markForCheck();
      }
    } else {
      if (event.templateId) {
        this.templatesService
          .updateTemplateColumns(event.templateId, event.columns)
          .pipe(
            finalize(() => {
              this.selectedTemplate = null;
              this.templateDialogLoading = false;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: () => {
              this.loadTemplates();
              this.toast.success('Plantilla actualizada exitosamente.');
              this.closeTemplateDialog();
            },
            error: (error: unknown) => {
              const message = this.templatesService.getErrorMessage(error);
              this.toast.error(message);
            },
          });
      } else {
        this.templateDialogLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  handleDeleteTemplate(templateId: number): void {
    this.templatesLoading = true;

    this.templatesService
      .deleteTemplate(templateId)
      .pipe(
        finalize(() => {
          this.selectedTemplate = null;
          this.templatesLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.removeTemplateEntry(templateId);
          this.toast.success('Plantilla eliminada exitosamente.');
        },
        error: (error: unknown) => {
          const message = this.templatesService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  handlePublishTemplate(templateId: number): void {
    this.templatesLoading = true;

    const updateState = 'published';

    this.templatesService
      .updateTemplateStatus(templateId, updateState)
      .pipe(
        finalize(() => {
          this.selectedTemplate = null;
          this.templatesLoading = false;
        }),
      )
      .subscribe({
        next: (template: TemplateResponse) => {
          this.templates = this.templates.map((entry) => {
            if (entry.id !== templateId) {
              return entry;
            }

            return {
              ...entry,
              status: this.toDisplayStatus(updateState),
              statusCode: template.status,
              lastUpdated: formatDate(template.updated_at),
            };
          });

          this.toast.success('Plantilla publicada exitosamente.');
        },
        error: (error: unknown) => {
          const message = this.templatesService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  handleDuplicateTemplate(templateId: number): void {
    this.templatesLoading = true;

    this.templatesService
      .duplicateTemplate(templateId)
      .pipe(
        finalize(() => {
          this.selectedTemplate = null;
          this.templatesLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.templatesLoading = false;

          this.loadTemplates();
          this.toast.success('Plantilla duplicada exitosamente.');
        },
        error: (error: unknown) => {
          const message = this.templatesService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  private removeTemplateEntry(templateId: number): void {
    this.templates = this.templates.filter((template) => template.id !== templateId);
  }

  protected closeTemplateDialog(): void {
    this.templateDialogVisible = false;
    this.templateDialogLoading = false;
    this.templateDialogData = {
      mode: 'create',
    };
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
    this.templateDialogData = {
      mode: 'create',
    };

    this.templateDialogVisible = true;
  }

  protected openEditDialog(template: TemplateRow) {
    this.templateDialogData = {
      mode: 'edit',
      template: this.mapTemplateRowToResponse(template),
    };

    this.templateDialogVisible = true;
  }

  private mapTemplateRowToResponse(template: TemplateRow): TemplateResponse {
    return {
      id: template.id,
      name: template.name,
      description: template.description,
      table_name: template.tableName ?? '',
      version: template.version,
      is_active: true,
    } as TemplateResponse;
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

  private loadTemplates() {
    if (this.templatesLoading) {
      return;
    }

    this.templatesLoading = true;
    this.templatesError = null;

    this.templatesService.getTemplates().subscribe({
      next: (templates: TemplateResponse[]) => {
        this.templates = templates.map((template) => this.mapToTemplateRow(template));
        this.templatesLoading = false;
      },
      error: (error: unknown) => {
        this.templates = [];
        this.templatesError = this.templatesService.getErrorMessage(error);
        this.templatesLoading = false;
        console.error(this.templatesError);
      },
    });
  }

  private mapToTemplateRow(template: TemplateResponse): TemplateRow {
    const createdAt = formatDate(template.created_at);
    const updatedAt = formatDate(template.updated_at ?? template.created_at);
    const status = this.toDisplayStatus(template.status);
    const version = template.table_name?.trim().length ? template.table_name : '—';

    return {
      id: template.id,
      name: template.name ?? 'Nueva plantilla',
      description: template.description ?? '',
      version,
      status,
      createdAt,
      lastUpdated: updatedAt,
      tableName: template.table_name ?? undefined,
      statusCode: template.status ?? undefined,
    };
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
