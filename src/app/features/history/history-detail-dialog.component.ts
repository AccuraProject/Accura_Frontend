import { Component, Inject, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { take } from 'rxjs';

import { LoadsService } from '../../core/services/loads.service';

type HistoryStatus =
  | 'Procesando'
  | 'Validado exitosamente'
  | 'Validado con errores'
  | 'Fallido';

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

@Component({
  selector: 'app-history-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, DatePipe, DecimalPipe, PercentPipe],
  templateUrl: './history-detail-dialog.component.html',
  styleUrl: './history-detail-dialog.component.scss'
})
export class HistoryDetailDialogComponent {
  private readonly loadsService = inject(LoadsService);

  constructor(
    private readonly dialogRef: MatDialogRef<HistoryDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: HistoryDetailDialogData
  ) {}

  protected get statusIcon(): string {
    switch (this.data.status) {
      case 'Validado exitosamente':
        return 'task_alt';
      case 'Validado con errores':
        return 'error';
      case 'Procesando':
        return 'autorenew';
      case 'Fallido':
        return 'block';
      default:
        return 'info';
    }
  }

  protected get statusBadgeClass(): string {
    switch (this.data.status) {
      case 'Validado exitosamente':
        return 'badge badge--success';
      case 'Validado con errores':
        return 'badge badge--warning';
      case 'Procesando':
        return 'badge badge--info';
      case 'Fallido':
        return 'badge badge--danger';
      default:
        return 'badge';
    }
  }

  protected get statusIconClass(): string {
    switch (this.data.status) {
      case 'Validado exitosamente':
        return 'history-detail__icon history-detail__icon--success';
      case 'Validado con errores':
        return 'history-detail__icon history-detail__icon--warning';
      case 'Procesando':
        return 'history-detail__icon history-detail__icon--info';
      case 'Fallido':
        return 'history-detail__icon history-detail__icon--danger';
      default:
        return 'history-detail__icon';
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected downloadReport(): void {
    this.downloadLoadFile('report');
  }

  protected downloadSource(): void {
    this.downloadLoadFile('source');
  }

  private downloadLoadFile(type: 'report' | 'source'): void {
    if (!this.data.loadId) {
      return;
    }

    const fallbackFileName = this.buildFallbackFileName(type);

    const download$ =
      type === 'report'
        ? this.loadsService.downloadLoadReport(this.data.loadId)
        : this.loadsService.downloadLoadSource(this.data.loadId);

    download$.pipe(take(1)).subscribe({
      next: (response) => this.saveFile(response, fallbackFileName),
      error: (error) => {
        console.error(`Error al descargar ${type}:`, error);
      }
    });
  }

  private saveFile(response: HttpResponse<Blob>, fallbackFileName: string): void {
    const blob = response.body;

    if (!blob) {
      return;
    }

    const contentDisposition = response.headers.get('content-disposition');
    const fileName = contentDisposition
      ? this.extractFileName(contentDisposition) ?? fallbackFileName
      : fallbackFileName;

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private extractFileName(contentDisposition: string): string | null {
    const fileNameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);

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
      return `reporte-${this.data.fileName}`;
    }

    return this.data.fileName;
  }
}
