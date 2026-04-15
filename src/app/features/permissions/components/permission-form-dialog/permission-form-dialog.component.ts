import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { HttpResponse } from '@angular/common/http';
import { finalize, take } from 'rxjs';
import { ToastService } from '../../../../shared/services/toast.service';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { ButtonComponent } from '../../../../shared/components/ui/button/button';

type HistoryStatus = 'Procesando' | 'Validado exitosamente' | 'Validado con errores' | 'Fallido';

export interface HistoryDetailDialogData {
  loadId: string | null;
  fileName: string;
  templateName: string;
  status: HistoryStatus;
  uploadedAt: string;
  processedBy: string;
  totalRows: number;
  validatedRows: number;
  errorRows: number;
  successRate: number;
  processingTime: string;
  validationStartedAt: string;
}

const EMPTY_PERMISSION_USER_DATA: PermissionFormDialogData = {
  id: 0,
  name: '',
  email: '',
};

interface PermissionFormDialogData {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-permission-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogShellComponent,
    CardModule,
    TagModule,
    ButtonComponent,
    ButtonModule,
    DividerModule,
    MessageModule,
  ],
  templateUrl: './permission-form-dialog.component.html',
  styleUrls: ['./permission-form-dialog.component.scss'],
})
export class PermissionFormDialogComponent {
  protected title = 'Gestión de permisos';
  protected description =
    'Administra las plantillas disponibles para {}. Los cambios se aplican de forma inmediata.';

  protected detailDialogData: PermissionFormDialogData = EMPTY_PERMISSION_USER_DATA;

  protected isLoading = signal(false);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: PermissionFormDialogData) {
    this.detailDialogData = value;
  }

  constructor(private toast: ToastService) {}

  async ngOnInit(): Promise<void> {
    await this.loadTemplates();
  }

  private async loadTemplates(): Promise<void> {
    // const userId = this.data.user?.id;
    // if (userId === undefined || userId === null) {
    //   this.errorMessage = 'No fue posible determinar el usuario seleccionado.';
    //   return;
    // }

    // this.isLoading = true;
    // this.errorMessage = null;

    // try {
    //   const [allTemplates, userTemplates] = await Promise.all([
    //     this.templatesService.fetchTemplates(),
    //     this.templatesService.fetchTemplatesForUser(userId),
    //   ]);

    //   const uniqueAssigned = new Map<number, TemplateResponse>();
    //   for (const template of userTemplates) {
    //     uniqueAssigned.set(template.id, template);
    //   }

    //   this.assignedTemplates = Array.from(uniqueAssigned.values());

    //   const assignedIds = new Set(this.assignedTemplates.map((template) => template.id));
    //   this.availableTemplates = allTemplates.filter((template) => {
    //     if (assignedIds.has(template.id)) {
    //       return false;
    //     }

    //     const status = template.status?.toLowerCase() ?? '';
    //     return status === 'published';
    //   });
    // } catch (error) {
    //   this.handleError(error);
    // } finally {
    //   this.isLoading = false;
    // }
  }

  protected cancel(): void {
    if (this.loading) {
      return;
    }

    this.cancelDialog.emit();
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
