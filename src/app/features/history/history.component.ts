import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router } from '@angular/router';
import {
  HistoryDetailDialogComponent,
  HistoryDetailDialogData,
} from './history-detail-dialog.component';
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

type HistoryStatus = 'Procesando' | 'Validado exitosamente' | 'Validado con errores' | 'Fallido';

type HistoryFilter = 'Todos los estados' | HistoryStatus;

type TemplateFilter = 'Todas las plantillas' | string;

const NAME_CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

interface HistoryRecord {
  id: string;
  loadId: string | null;
  fileName: string;
  templateName: string;
  uploadedBy: string;
  uploadedByInitials: string;
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
  imports: [CommonModule, FormsModule, MatDialogModule, PageActionsComponent, DataTableComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly loadsService = inject(LoadsService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private displayActiveUsersMetric = true;
  private pendingLoadId: string | null = null;
  private shouldOpenPendingLoad = false;

  protected searchTerm = '';
  protected statusFilter: HistoryFilter = 'Todos los estados';
  protected templateFilter: TemplateFilter = 'Todas las plantillas';

  protected readonly statusOptions: HistoryFilter[] = [
    'Todos los estados',
    'Procesando',
    'Validado exitosamente',
    'Validado con errores',
    'Fallido',
  ];

  protected selectedRecord: HistoryRecord | null = null;
  readonly isTableLoading = signal(false);

  columns = [
    { field: 'fileName', header: 'Archivo' },
    { field: 'templateName', header: 'Plantilla' },
    { field: 'uploadedAt', header: 'Fecha de Carga' },
    { field: 'uploadedBy', header: 'Cargado por' },
    { field: 'validatedRows', header: 'Filas Procesadas' },
    { field: 'status', header: 'Estado' },
  ];

  protected templateOptions: TemplateFilter[] = ['Todas las plantillas'];

  protected metrics: MetricSummary[] = this.createMetricPlaceholders();

  protected historyRecords: HistoryRecord[] = [];
  protected isLoading = false;
  protected hasError = false;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  ngOnInit(): void {
    this.store
      .select(selectIsUser)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isUser) => {
        this.displayActiveUsersMetric = !isUser;
        this.updateMetrics(this.historyRecords);
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
    this.fetchHistoryRecords();
  }

  get isViewDetailDisabled(): boolean {
    return !this.selectedRecord || this.selectedRecord.status == 'Procesando';
  }

  onViewDetail(): void {
    if (!this.selectedRecord || this.selectedRecord.status == 'Procesando') return;

    const record = this.selectedRecord;
  }

  onRowSelect(record: HistoryRecord) {
    this.selectedRecord = record;
  }

  onRowUnselect() {
    this.selectedRecord = null;
  }

  protected get filteredRecords(): HistoryRecord[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.historyRecords.filter((record) => {
      const matchesSearch =
        !term ||
        record.fileName.toLowerCase().includes(term) ||
        record.templateName.toLowerCase().includes(term) ||
        record.uploadedBy.toLowerCase().includes(term);

      const matchesStatus =
        this.statusFilter === 'Todos los estados' || record.status === this.statusFilter;

      const matchesTemplate =
        this.templateFilter === 'Todas las plantillas' ||
        record.templateName === this.templateFilter;

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }

  protected get paginatedRecords(): HistoryRecord[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredRecords.slice(startIndex, startIndex + this.pageSize);
  }

  protected get totalPages(): number {
    const total = Math.ceil(this.filteredRecords.length / this.pageSize);
    return total > 0 ? total : 1;
  }

  protected get pageStart(): number {
    if (this.filteredRecords.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  protected get pageEnd(): number {
    if (this.filteredRecords.length === 0) {
      return 0;
    }

    return Math.min(this.filteredRecords.length, this.currentPage * this.pageSize);
  }

  protected goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  protected goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  protected onFiltersChanged(): void {
    this.currentPage = 1;
  }

  protected trackByRecordId(_: number, record: HistoryRecord): string {
    return record.id;
  }

  protected canViewRecordDetail(record: HistoryRecord): boolean {
    return record.status !== 'Procesando';
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
    if (!this.canViewRecordDetail(record)) {
      return;
    }

    const dialogData: HistoryDetailDialogData = {
      loadId: record.loadId,
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
      validationStartedAt: record.validationStartedAt,
    };

    this.dialog.open<HistoryDetailDialogComponent, HistoryDetailDialogData, void>(
      HistoryDetailDialogComponent,
      {
        data: dialogData,
        panelClass: 'history-detail-dialog',
      },
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
          this.updatePaginationAfterDataChange(records.length);
          this.updateTemplateOptions(records);
          this.updateMetrics(records);
          this.isLoading = false;

          this.tryOpenPendingLoad();
        },
        error: () => {
          this.hasError = true;
          this.isLoading = false;
        },
      });
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
    this.updatePaginationAfterDataChange(sortedRecords.length);
    this.updateTemplateOptions(sortedRecords);
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
    this.openRecordDetail(record);
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

  private updatePaginationAfterDataChange(totalItems: number): void {
    const totalPages = this.calculateTotalPages(totalItems);
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private calculateTotalPages(totalItems: number): number {
    return totalItems > 0 ? Math.ceil(totalItems / this.pageSize) : 1;
  }

  private mapToHistoryRecord(detail: LoadDetailResponseItem): HistoryRecord {
    const { load, template, user } = detail;
    const totalRows = load.total_rows ?? 0;
    const errorRows = load.error_rows ?? 0;
    const validatedRows = Math.max(totalRows - errorRows, 0);
    const successRate = totalRows > 0 ? validatedRows / totalRows : 0;

    const { displayName, initials } = this.resolveUserInfo(user);

    const loadId = load.id !== undefined && load.id !== null ? String(load.id) : null;

    return {
      id: loadId ?? load.file_name,
      loadId,
      fileName: load.file_name,
      templateName: template?.name ?? 'Plantilla desconocida',
      uploadedBy: displayName,
      uploadedByInitials: initials,
      uploadedAt: load.created_at,
      status: this.mapStatus(load.status),
      totalRows,
      validatedRows,
      errorRows,
      successRate,
      processingTime: this.formatProcessingTime(load.started_at, load.finished_at),
      validationStartedAt: load.started_at ?? load.created_at,
    };
  }

  private resolveUserInfo(user: LoadDetailResponseItem['user']): {
    displayName: string;
    initials: string;
  } {
    if (!user) {
      return { displayName: 'Desconocido', initials: '?' };
    }

    const trimmedName = user.name?.trim();

    if (trimmedName) {
      const nameParts = trimmedName
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

      const firstName = nameParts[0] ?? '';
      const surname =
        nameParts.slice(1).find((part) => !NAME_CONNECTORS.has(part.toLowerCase())) ?? '';

      const firstInitial = firstName.charAt(0).toUpperCase();
      const secondInitial = surname.charAt(0).toUpperCase();
      const initials = `${firstInitial}${secondInitial}`.trim() || firstInitial || '?';

      return {
        displayName: trimmedName,
        initials,
      };
    }

    if (user.email) {
      const emailLocalPart = user.email.split('@')[0] ?? '';
      const firstInitial = emailLocalPart.charAt(0).toUpperCase();

      return {
        displayName: user.email,
        initials: firstInitial || '?',
      };
    }

    return { displayName: 'Desconocido', initials: '?' };
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

    if (
      !templateNames.includes(this.templateFilter) &&
      this.templateFilter !== 'Todas las plantillas'
    ) {
      this.templateFilter = 'Todas las plantillas';
    }
  }

  private updateMetrics(records: HistoryRecord[]): void {
    const totalLoads = records.length;
    const activeUsers = new Set(records.map((record) => record.uploadedBy)).size;
    const totalRows = records.reduce((sum, record) => sum + record.totalRows, 0);

    const metrics: MetricSummary[] = [
      {
        label: 'Total de Cargas',
        value: totalLoads.toLocaleString('es-ES'),
        description: 'Archivos procesados este mes',
        trend: totalLoads > 0 ? 'Actividad reciente' : 'Sin registros',
        isPositive: totalLoads > 0,
        icon: 'pi-file-arrow-up',
      },
    ];

    if (this.displayActiveUsersMetric) {
      metrics.push({
        label: 'Usuarios Activos',
        value: activeUsers.toLocaleString('es-ES'),
        description: 'Usuarios cargando archivos',
        trend: activeUsers > 0 ? 'Usuarios activos' : 'Sin registros',
        isPositive: activeUsers > 0,
        icon: 'pi-users',
      });
    }

    metrics.push({
      label: 'Filas Procesadas',
      value: totalRows.toLocaleString('es-ES'),
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
