import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogShellComponent } from '../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { read } from 'xlsx';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { ButtonComponent } from '../../../shared/components/ui/button/button';
import { LoadsService } from '../../../core/services/loads.service';
import { HttpResponse } from '@angular/common/http';
import { finalize, take } from 'rxjs';
import { ToastService } from '../../../shared/services/toast.service';

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

const EMPTY_HISTORY_DETAIL: HistoryDetailDialogData = {
  loadId: null,
  fileName: '',
  templateName: '',
  status: 'Procesando',
  uploadedAt: '',
  processedBy: '',
  totalRows: 0,
  validatedRows: 0,
  errorRows: 0,
  successRate: 0,
  processingTime: '',
  validationStartedAt: '',
};

@Component({
  selector: 'app-history-detail-dialog',
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
  templateUrl: './history-detail-dialog.component.html',
  styleUrls: ['./history-detail-dialog.component.scss'],
})
export class HistoryDetailDialogComponent {
  protected title = 'Detalles de carga';
  protected description = 'Información detallada sobre la carga seleccionada.';

  protected detailDialogData: HistoryDetailDialogData = EMPTY_HISTORY_DETAIL;

  protected isLoadingReport = signal(false);
  protected isLoadingSource = signal(false);

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: HistoryDetailDialogData) {
    this.detailDialogData = value;
  }

  constructor(
    private loadsService: LoadsService,
    private toast: ToastService,
  ) {}

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

  getStatusSeverity(
    status: HistoryStatus,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'Validado exitosamente':
        return 'success';
      case 'Validado con errores':
        return 'warn';
      case 'Fallido':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private setDownloadLoading(type: 'report' | 'source', value: boolean): void {
    if (type === 'report') {
      this.isLoadingReport.set(value);
      return;
    }

    this.isLoadingSource.set(value);
  }

  protected onDownloadReport(): void {
    this.downloadLoadFile('report');
  }

  protected onDownloadSource(): void {
    this.downloadLoadFile('source');
  }

  private downloadLoadFile(type: 'report' | 'source'): void {
    if (!this.detailDialogData.loadId) {
      return;
    }

    const fallbackFileName = this.buildFallbackFileName(type);
    const isReport = type === 'report';

    this.setDownloadLoading(type, true);

    const download$ = isReport
      ? this.loadsService.downloadLoadReport(this.detailDialogData.loadId)
      : this.loadsService.downloadLoadSource(this.detailDialogData.loadId);

    download$
      .pipe(
        take(1),
        finalize(() => this.setDownloadLoading(type, false)),
      )
      .subscribe({
        next: (response) => {
          this.saveFile(response, fallbackFileName);

          this.toast.success(
            isReport ? 'Se descargó el reporte correctamente.' : 'Se descargó el archivo correctamente.',
          );
        },
        error: (error) => {
          const message = this.loadsService.getErrorMessage(error);

          this.toast.error(
            isReport ? 'Error al descargar el reporte' : 'Error al descargar el archivo',
            message,
          );
        },
      });
  }

  private saveFile(response: HttpResponse<Blob>, fallbackFileName: string): void {
    const blob = response.body;

    if (!blob) {
      return;
    }

    const contentDisposition = response.headers.get('content-disposition');
    const fileName = contentDisposition
      ? (this.extractFileName(contentDisposition) ?? fallbackFileName)
      : fallbackFileName;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private extractFileName(contentDisposition: string): string | null {
    const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(
      contentDisposition,
    );

    if (!fileNameMatch) {
      return null;
    }

    const encodedFileName = fileNameMatch[1] ?? fileNameMatch[2];

    if (!encodedFileName) {
      return null;
    }

    try {
      return decodeURIComponent(encodedFileName.replace(/\+/g, ' '));
    } catch {
      return encodedFileName;
    }
  }

  private buildFallbackFileName(type: 'report' | 'source'): string {
    if (type === 'report') {
      return `reporte-${this.detailDialogData.fileName}`;
    }

    return this.detailDialogData.fileName;
  }
}
