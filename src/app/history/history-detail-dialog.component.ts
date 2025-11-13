import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

type HistoryStatus =
  | 'Procesando'
  | 'Validado exitosamente'
  | 'Validado con errores'
  | 'Fallido';

export interface HistoryDetailDialogData {
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
}
