import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { read } from 'xlsx';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { ButtonComponent } from '../../../../shared/components/ui/button/button';
import { LoadsService } from '../../../../core/services/loads.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { TemplateDetailTableComponent } from '../../../../shared/components/data/template-detail-table/template-detail-table';
import { TemplateColumnDetail } from '../../template-client-management/template-client-management.component';
import { TemplatesService } from '../../templates.service';
import { HttpEventType } from '@angular/common/http';

interface DetailDialogData {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  lastUpdated: string;
  columns: number;
  columnsDetail: TemplateColumnDetail[];
}

const EMPTY_DETAIL_DIALOG_DATA: DetailDialogData = {
  id: 0,
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  lastUpdated: '',
  columns: 0,
  columnsDetail: [],
};

@Component({
  selector: 'app-template-detail-dialog',
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
    TemplateDetailTableComponent,
  ],
  templateUrl: './template-detail-dialog.component.html',
  styleUrls: ['./template-detail-dialog.component.scss'],
})
export class TemplateDetailDialogComponent {
  protected title = 'Detalles de la plantilla';
  protected description = 'Información detallada sobre la plantilla seleccionada.';

  protected detailDialogData: DetailDialogData = EMPTY_DETAIL_DIALOG_DATA;

  protected uploadProgress: Record<string, number> = {};

  protected isDownloading = signal(false);
  protected isUploading = signal(false);

  @ViewChild('fileInput') fileInput: any;

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: DetailDialogData) {
    this.title = value.name;
    this.description = value.description;
    this.detailDialogData = value;
  }

  constructor(
    private templatesService: TemplatesService,
    private loadsService: LoadsService,
    private toast: ToastService,
  ) {}

  protected async onDownloadTemplate(): Promise<void> {
    const templateId = this.detailDialogData.id;

    if (!templateId) {
      return;
    }

    this.isDownloading.set(true);

    try {
      const blob = await this.templatesService.downloadTemplateExcel(templateId);

      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = this.buildTemplateFilename(this.detailDialogData.name);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = this.templatesService.getErrorMessage(error);
      this.toast.error(message);
    } finally {
      this.isDownloading.set(false);
    }
  }

  private buildTemplateFilename(templateName: string): string {
    const normalizeSegment = (value: string): string =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    const baseName = normalizeSegment(templateName) || 'plantilla';

    return `${baseName}.xlsx`;
  }

  onUploadFile(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];

    console.log(file);

    if (file) {
      this.uploadFile(file);
    }
  }

  protected uploadFile(file: File): void {
    const templateId = this.detailDialogData.id;

    if (!templateId) {
      return;
    }

    console.log('START LOADING');

    this.isUploading.set(true);

    this.toast.info(
      `Cargando plantilla: ${this.detailDialogData.name}. El proceso se está realizando en segundo plano.`,
    );

    this.templatesService.uploadTemplateLoad(templateId, file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const progress = Math.round((event.loaded / event.total) * 100);
          this.uploadProgress[templateId] = progress;
        }
        if (event.type === HttpEventType.Response) {
          this.uploadProgress[templateId] = 100;
          this.isUploading.set(false);
          this.toast.success(
            `La plantilla ${this.detailDialogData.name} se ha cargado correctamente.`,
          );
        }
      },
      error: (err) => {
        console.error('Error al cargar el archivo', err);
        this.isUploading.set(false);
        this.toast.error(
          `Hubo un problema al cargar la plantilla ${this.detailDialogData.name}. Intente nuevamente.`,
        );
      },
    });
  }

  private resetFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  protected cancel(): void {
    if (this.loading) {
      return;
    }

    this.cancelDialog.emit();
    this.resetFileInput();
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
