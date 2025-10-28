import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

type HistoryStatus = 'Éxito' | 'Con Errores' | 'En Proceso';

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
      case 'Éxito':
        return 'task_alt';
      case 'Con Errores':
        return 'error';
      case 'En Proceso':
        return 'autorenew';
      default:
        return 'info';
    }
  }

  protected get statusBadgeClass(): string {
    switch (this.data.status) {
      case 'Éxito':
        return 'badge badge--success';
      case 'Con Errores':
        return 'badge badge--warning';
      case 'En Proceso':
        return 'badge badge--info';
      default:
        return 'badge';
    }
  }

  protected get statusIconClass(): string {
    switch (this.data.status) {
      case 'Éxito':
        return 'history-detail__icon history-detail__icon--success';
      case 'Con Errores':
        return 'history-detail__icon history-detail__icon--warning';
      case 'En Proceso':
        return 'history-detail__icon history-detail__icon--info';
      default:
        return 'history-detail__icon';
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
