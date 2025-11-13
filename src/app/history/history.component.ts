import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HistoryDetailDialogComponent, HistoryDetailDialogData } from './history-detail-dialog.component';
import { LoadsService } from '../core/services/loads.service';
import { LoadDetailResponseItem } from '../core/models/load-detail.model';

type HistoryStatus =
  | 'Procesando'
  | 'Validado exitosamente'
  | 'Validado con errores'
  | 'Fallido';

type HistoryFilter = 'Todos los estados' | HistoryStatus;

type TemplateFilter = 'Todas las plantillas' | string;

interface HistoryRecord {
  id: string;
  fileName: string;
  templateName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: HistoryStatus;
  totalRows: number;
  validatedRows: number;
  errorRows: number;
  successRate: number;
  processingTime: string;
  validationStartedAt: string;
}

interface MetricSummary {
  label: string;
  value: string;
  description: string;
  trend: string;
  isPositive: boolean;
  icon: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly loadsService = inject(LoadsService);
  private readonly destroyRef = inject(DestroyRef);

  protected searchTerm = '';
  protected statusFilter: HistoryFilter = 'Todos los estados';
  protected templateFilter: TemplateFilter = 'Todas las plantillas';

  protected readonly statusOptions: HistoryFilter[] = [
    'Todos los estados',
    'Procesando',
    'Validado exitosamente',
    'Validado con errores',
    'Fallido'
  ];

  protected templateOptions: TemplateFilter[] = ['Todas las plantillas'];

  protected metrics: MetricSummary[] = [
    {
      label: 'Total de Cargas',
      value: '0',
      description: 'Archivos procesados este mes',
      trend: 'Sin registros',
      isPositive: false,
      icon: 'upload_file'
    },
    {
      label: 'Usuarios Activos',
      value: '0',
      description: 'Usuarios cargando archivos',
      trend: 'Sin registros',
      isPositive: false,
      icon: 'group'
    },
    {
      label: 'Filas Procesadas',
      value: '0',
      description: 'Volumen de filas validadas',
      trend: 'Sin registros',
      isPositive: false,
      icon: 'table_rows'
    }
  ];

  protected historyRecords: HistoryRecord[] = [];
  protected isLoading = false;
  protected hasError = false;

  ngOnInit(): void {
    this.fetchHistoryRecords();
  }

  protected get filteredRecords(): HistoryRecord[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.historyRecords.filter((record) => {
      const matchesSearch = !term
        || record.fileName.toLowerCase().includes(term)
        || record.templateName.toLowerCase().includes(term)
        || record.uploadedBy.toLowerCase().includes(term);

      const matchesStatus =
        this.statusFilter === 'Todos los estados' || record.status === this.statusFilter;

      const matchesTemplate =
        this.templateFilter === 'Todas las plantillas' || record.templateName === this.templateFilter;

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }

  protected trackByRecordId(_: number, record: HistoryRecord): string {
    return record.id;
  }

  protected statusBadgeClass(status: HistoryStatus): string {
    switch (status) {
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

  protected openRecordDetail(record: HistoryRecord): void {
    const dialogData: HistoryDetailDialogData = {
      fileName: record.fileName,
      templateName: record.templateName,
      status: record.status,
      uploadedAt: record.uploadedAt,
      processedBy: record.uploadedBy,
      totalRows: record.totalRows,
      validatedRows: record.validatedRows,
      errorRows: record.errorRows,
      successRate: record.successRate,
      processingTime: record.processingTime,
      validationStartedAt: record.validationStartedAt
    };

    this.dialog.open<HistoryDetailDialogComponent, HistoryDetailDialogData, void>(
      HistoryDetailDialogComponent,
      {
        data: dialogData,
        panelClass: 'history-detail-dialog'
      }
    );
  }

  private fetchHistoryRecords(): void {
    this.isLoading = true;
    this.hasError = false;

    this.loadsService
      .fetchLoadDetails()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          const records = details
            .map((detail) => this.mapToHistoryRecord(detail))
            .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

          this.historyRecords = records;
          this.updateTemplateOptions(records);
          this.updateMetrics(records);
          this.isLoading = false;
        },
        error: () => {
          this.hasError = true;
          this.isLoading = false;
        }
      });
  }

  private mapToHistoryRecord(detail: LoadDetailResponseItem): HistoryRecord {
    const { load, template, user } = detail;
    const totalRows = load.total_rows ?? 0;
    const errorRows = load.error_rows ?? 0;
    const validatedRows = Math.max(totalRows - errorRows, 0);
    const successRate = totalRows > 0 ? validatedRows / totalRows : 0;

    return {
      id: load.id !== undefined && load.id !== null ? String(load.id) : load.file_name,
      fileName: load.file_name,
      templateName: template?.name ?? 'Plantilla desconocida',
      uploadedBy: this.resolveUploadedBy(user),
      uploadedAt: load.created_at,
      status: this.mapStatus(load.status),
      totalRows,
      validatedRows,
      errorRows,
      successRate,
      processingTime: this.formatProcessingTime(load.started_at, load.finished_at),
      validationStartedAt: load.started_at ?? load.created_at
    };
  }

  private resolveUploadedBy(user: LoadDetailResponseItem['user']): string {
    if (!user) {
      return 'Desconocido';
    }

    if (user.name && user.name.trim().length > 0) {
      return user.name;
    }

    return user.email;
  }

  private mapStatus(status: string | null | undefined): HistoryStatus {
    const normalized = status
      ? status
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    switch (normalized) {
      case 'validado exitosamente':
      case 'validado exitoso':
      case 'validado correctamente':
      case 'success':
      case 'successful':
      case 'completed':
      case 'completed successfully':
      case 'finished':
      case 'completado':
        return 'Validado exitosamente';
      case 'validado con errores':
      case 'con errores':
      case 'with errors':
      case 'completed with errors':
      case 'partial success':
      case 'partial':
      case 'completado con errores':
        return 'Validado con errores';
      case 'fallido':
      case 'failed':
      case 'error':
      case 'errores criticos':
      case 'cancelado':
      case 'cancelled':
      case 'canceled':
      case 'aborted':
      case 'stopped':
        return 'Fallido';
      case 'procesando':
      case 'en proceso':
      case 'processing':
      case 'in progress':
      case 'in_progress':
      case 'pending':
      case 'queued':
      case 'validando':
      case 'validating':
      default:
        return 'Procesando';
    }
  }

  private formatProcessingTime(startedAt: string | null, finishedAt: string | null): string {
    if (!startedAt || !finishedAt) {
      return '-';
    }

    const start = new Date(startedAt).getTime();
    const end = new Date(finishedAt).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return '-';
    }

    const totalSeconds = Math.floor((end - start) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  private updateTemplateOptions(records: HistoryRecord[]): void {
    const templateNames = Array.from(new Set(records.map((record) => record.templateName))).sort();
    this.templateOptions = ['Todas las plantillas', ...templateNames];

    if (!templateNames.includes(this.templateFilter) && this.templateFilter !== 'Todas las plantillas') {
      this.templateFilter = 'Todas las plantillas';
    }
  }

  private updateMetrics(records: HistoryRecord[]): void {
    const totalLoads = records.length;
    const activeUsers = new Set(records.map((record) => record.uploadedBy)).size;
    const totalRows = records.reduce((sum, record) => sum + record.totalRows, 0);

    this.metrics = [
      {
        label: 'Total de Cargas',
        value: totalLoads.toLocaleString('es-ES'),
        description: 'Archivos procesados este mes',
        trend: totalLoads > 0 ? 'Actividad reciente' : 'Sin registros',
        isPositive: totalLoads > 0,
        icon: 'upload_file'
      },
      {
        label: 'Usuarios Activos',
        value: activeUsers.toLocaleString('es-ES'),
        description: 'Usuarios cargando archivos',
        trend: activeUsers > 0 ? 'Usuarios activos' : 'Sin registros',
        isPositive: activeUsers > 0,
        icon: 'group'
      },
      {
        label: 'Filas Procesadas',
        value: totalRows.toLocaleString('es-ES'),
        description: 'Volumen de filas validadas',
        trend: totalRows > 0 ? 'Validaciones completadas' : 'Sin registros',
        isPositive: totalRows > 0,
        icon: 'table_rows'
      }
    ];
  }
}
