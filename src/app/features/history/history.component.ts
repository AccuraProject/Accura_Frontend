import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadsService } from '../../core/services/loads.service';
import { LoadDetailResponseItem } from '../../core/models/load-detail.model';
import { NotificationService } from '../../core/services/notification.service';
import {
  NotificationUpdatesEvent,
  NotificationUpdatesLoadEvent,
} from '../../core/models/notification.model';
import { selectIsUser } from '../../core/store/session/session.selectors';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table';
import { formatDate } from '../../shared/utils/date-util';
import { formatNumber } from '../../shared/utils/number-util';
import {
  HistoryDetailDialogComponent,
  HistoryDetailDialogData,
} from './components/history-detail-dialog.component';

type HistoryStatus = 'Procesando' | 'Validado exitosamente' | 'Validado con errores' | 'Fallido';

const STATUS_SET = new Set<HistoryStatus>([
  'Procesando',
  'Validado exitosamente',
  'Validado con errores',
  'Fallido',
]);

interface HistoryRecord {
  id: string;
  loadId: string | null;
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
  selector: 'app-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageActionsComponent,
    DataTableComponent,
    HistoryDetailDialogComponent,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly loadsService = inject(LoadsService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private displayActiveUsersMetric = true;
  private pendingLoadId: string | null = null;
  private shouldOpenPendingLoad = false;

  protected metrics: MetricSummary[] = this.createMetricPlaceholders();

  protected historyRecords: HistoryRecord[] = [];
  protected selectedRecord: HistoryRecord | null = null;
  readonly isTableLoading = signal(false);
  protected historyRecordsError: string | null = null;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  columns = [
    { field: 'fileName', header: 'Archivo' },
    { field: 'templateName', header: 'Plantilla' },
    { field: 'uploadedAt', header: 'Fecha de Carga' },
    { field: 'uploadedBy', header: 'Cargado por' },
    { field: 'validatedRows', header: 'Filas Validadas' },
    { field: 'totalRows', header: 'Filas Procesadas' },
    { field: 'status', header: 'Estado' },
  ];

  protected detailDialogVisible = false;
  protected detailDialogData: HistoryDetailDialogData = EMPTY_HISTORY_DETAIL;

  ngOnInit(): void {
    this.store
      .select(selectIsUser)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isUser) => {
        this.displayActiveUsersMetric = !isUser;
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const loadId = params.get('loadId');
      this.pendingLoadId = loadId;
      this.shouldOpenPendingLoad = !!loadId;

      if (this.shouldOpenPendingLoad) {
        this.tryOpenPendingLoad();
      }
    });

    this.listenToRealtimeUpdates();
    this.loadRecords();
  }

  get isViewDetailDisabled(): boolean {
    return !this.selectedRecord || this.selectedRecord.status == 'Procesando';
  }

  onViewDetail(): void {
    if (!this.selectedRecord || this.selectedRecord.status == 'Procesando') return;

    this.detailDialogData = {
      loadId: this.selectedRecord.loadId,
      fileName: this.selectedRecord.fileName,
      templateName: this.selectedRecord.templateName,
      status: this.selectedRecord.status,
      uploadedAt: this.selectedRecord.uploadedAt,
      processedBy: this.selectedRecord.uploadedBy,
      totalRows: this.selectedRecord.totalRows,
      validatedRows: this.selectedRecord.validatedRows,
      errorRows: this.selectedRecord.errorRows,
      successRate: this.selectedRecord.successRate,
      processingTime: this.selectedRecord.processingTime,
      validationStartedAt: this.selectedRecord.validationStartedAt,
    };

    this.detailDialogVisible = true;
  }

  onRowSelect(record: HistoryRecord) {
    this.selectedRecord = record;
  }

  onRowUnselect() {
    this.selectedRecord = null;
  }

  private loadRecords(): void {
    if (this.isTableLoading()) {
      return;
    }

    this.isTableLoading.set(true);

    this.loadsService.fetchLoadDetails().subscribe({
      next: (records: LoadDetailResponseItem[]) => {
        this.historyRecords = records.map((record) => this.mapToHistoryRecord(record));
        this.isTableLoading.set(false);
        this.updateMetrics(this.historyRecords);
      },
      error: (error: unknown) => {
        this.historyRecords = [];
        this.historyRecordsError = this.loadsService.getErrorMessage(error);
        this.isTableLoading.set(false);
      },
    });
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

  private listenToRealtimeUpdates(): void {
    this.notificationService
      .notificationUpdates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: NotificationUpdatesEvent) => {
        if (event.type === 'load-event') {
          this.applyLoadEventUpdate(event);
        }
      });
  }

  private applyLoadEventUpdate(event: NotificationUpdatesLoadEvent): void {
    const detail: LoadDetailResponseItem = {
      load: event.data.load,
      template: event.data.template ?? null,
      user: event.data.user ?? null,
    };

    const record = this.mapToHistoryRecord(detail);
    const updatedRecords = [...this.historyRecords];
    const existingIndex = updatedRecords.findIndex(
      (item) => (record.loadId && item.loadId === record.loadId) || item.id === record.id,
    );

    if (existingIndex >= 0) {
      updatedRecords[existingIndex] = record;
    } else {
      updatedRecords.unshift(record);
    }

    const sortedRecords = updatedRecords.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    this.historyRecords = sortedRecords;
    this.updateMetrics(sortedRecords);
    this.tryOpenPendingLoad();
  }

  private tryOpenPendingLoad(): void {
    if (!this.shouldOpenPendingLoad || !this.pendingLoadId) {
      return;
    }

    const record = this.historyRecords.find(
      (item) => item.loadId === this.pendingLoadId || item.id === this.pendingLoadId,
    );

    if (!record) {
      return;
    }

    this.shouldOpenPendingLoad = false;
    this.clearPendingLoadQueryParam();
  }

  private clearPendingLoadQueryParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { loadId: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    this.pendingLoadId = null;
  }

  private mapToHistoryRecord(detail: LoadDetailResponseItem): HistoryRecord {
    const { load, template, user } = detail;
    const totalRows = load.total_rows ?? 0;
    const errorRows = load.error_rows ?? 0;
    const validatedRows = Math.max(totalRows - errorRows, 0);
    const successRate = totalRows > 0 ? validatedRows / totalRows : 0;

    const loadId = load.id !== undefined && load.id !== null ? String(load.id) : null;

    return {
      id: loadId ?? load.file_name,
      loadId,
      fileName: load.file_name,
      templateName: template?.name ?? 'Plantilla desconocida',
      uploadedBy: user?.name ?? 'Usuario desconocido',
      uploadedAt: formatDate(load.created_at),
      status: this.mapStatus(load.status),
      totalRows,
      validatedRows,
      errorRows,
      successRate,
      processingTime: this.formatProcessingTime(load.started_at, load.finished_at),
      validationStartedAt: formatDate(load.started_at ?? load.created_at),
    };
  }

  private mapStatus(status: string | null | undefined): HistoryStatus {
    return STATUS_SET.has(status as HistoryStatus) ? (status as HistoryStatus) : 'Procesando';
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

  private updateMetrics(records: HistoryRecord[]): void {
    const totalLoads = records.length;
    const activeUsers = new Set(records.map((record) => record.uploadedBy)).size;
    const totalRows = records.reduce((sum, record) => sum + record.totalRows, 0);

    const metrics: MetricSummary[] = [
      {
        label: 'Total de Cargas',
        value: formatNumber(totalLoads),
        description: 'Archivos procesados este mes',
        trend: totalLoads > 0 ? 'Actividad reciente' : 'Sin registros',
        isPositive: totalLoads > 0,
        icon: 'pi-file-arrow-up',
      },
    ];

    if (this.displayActiveUsersMetric) {
      metrics.push({
        label: 'Usuarios Activos',
        value: formatNumber(activeUsers),
        description: 'Usuarios cargando archivos',
        trend: activeUsers > 0 ? 'Usuarios activos' : 'Sin registros',
        isPositive: activeUsers > 0,
        icon: 'pi-users',
      });
    }

    metrics.push({
      label: 'Filas Procesadas',
      value: formatNumber(totalRows),
      description: 'Volumen de filas validadas',
      trend: totalRows > 0 ? 'Validaciones completadas' : 'Sin registros',
      isPositive: totalRows > 0,
      icon: 'pi-table',
    });

    this.metrics = metrics;
  }

  private createMetricPlaceholders(): MetricSummary[] {
    const metrics: MetricSummary[] = [
      {
        label: 'Total de Cargas',
        value: '0',
        description: 'Archivos procesados este mes',
        trend: 'Sin registros',
        isPositive: false,
        icon: 'pi-file-arrow-up',
      },
    ];

    if (this.displayActiveUsersMetric) {
      metrics.push({
        label: 'Usuarios Activos',
        value: '0',
        description: 'Usuarios cargando archivos',
        trend: 'Sin registros',
        isPositive: false,
        icon: 'pi-users',
      });
    }

    metrics.push({
      label: 'Filas Procesadas',
      value: '0',
      description: 'Volumen de filas validadas',
      trend: 'Sin registros',
      isPositive: false,
      icon: 'pi-table',
    });

    return metrics;
  }
}
