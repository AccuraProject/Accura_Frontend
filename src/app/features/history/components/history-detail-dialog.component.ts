import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogShellComponent } from '../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { read } from 'xlsx';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';

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

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: HistoryDetailDialogData) {
    this.detailDialogData = value;
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
      case 'Procesando':
        return 'info';
      default:
        return 'secondary';
    }
  }
}
