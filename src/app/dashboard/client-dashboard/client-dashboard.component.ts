import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { KpiService } from '../../core/services/kpi.service';
import { ClientDashboardKpis } from '../../core/models/client-dashboard-kpis.model';
import { LoadsService } from '../../core/services/loads.service';
import { LoadDetailResponseItem } from '../../core/models/load-detail.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type UploadStatus = 'success' | 'warning' | 'error';

interface GuideStep {
  order: number;
  title: string;
  description: string;
}

interface ClientStatCard {
  label: string;
  value: string;
  caption: string;
}

interface RecentUpload {
  title: string;
  template: string;
  date: string;
  status: UploadStatus;
  statusLabel: string;
}

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.scss',
})
export class ClientDashboardComponent {
  private readonly router = inject(Router);
  private readonly kpiService = inject(KpiService);
  private readonly loadsService = inject(LoadsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly numberFormatter = new Intl.NumberFormat('es-ES');
  private readonly percentageFormatter = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  protected readonly guideSteps: GuideStep[] = [
    {
      order: 1,
      title: 'Selecciona una Plantilla',
      description: 'Elige la configuración que se ajuste a tu proceso de validación.',
    },
    {
      order: 2,
      title: 'Carga tu Archivo',
      description: 'Arrastra tu archivo o selecciónalo desde tu computadora para iniciar.',
    },
    {
      order: 3,
      title: 'Revisa el Resultado',
      description: 'Analiza el reporte de validaciones y descarga los detalles si lo necesitas.',
    },
  ];

  protected clientStats: ClientStatCard[] = this.createLoadingStats();

  protected recentUploads: RecentUpload[] = this.createLoadingUploads();

  protected readonly statusClassMap: Record<UploadStatus, string> = {
    success: 'client-recent__status--success',
    warning: 'client-recent__status--warning',
    error: 'client-recent__status--error',
  };

  constructor() {
    this.kpiService.fetchClientDashboardKpis().subscribe({
      next: (kpis) => {
        this.clientStats = this.mapKpisToStats(kpis);
      },
      error: () => {
        this.clientStats = this.createErrorStats();
      },
    });

    this.loadsService
      .fetchLoadDetails()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (details) => {
          const recentUploads = details
            .sort(
              (a, b) =>
                new Date(b.load.created_at).getTime() - new Date(a.load.created_at).getTime()
            )
            .slice(0, 5)
            .map((detail) => this.mapToRecentUpload(detail));

          this.recentUploads = recentUploads.length > 0 ? recentUploads : this.createEmptyUploads();
        },
        error: () => {
          this.recentUploads = this.createErrorUploads();
        },
      });
  }

  protected navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  private mapKpisToStats(kpis: ClientDashboardKpis): ClientStatCard[] {
    return [
      {
        label: 'Plantillas Disponibles',
        value: this.formatNumber(kpis.available_templates),
        caption: `${this.formatNumber(kpis.total_loads)} cargas totales procesadas`,
      },
      {
        label: 'Cargas Este Mes',
        value: this.formatNumber(kpis.current_month_loads),
        caption: `${this.formatNumber(kpis.successful_loads)} cargas exitosas acumuladas`,
      },
      {
        label: 'Tasa de Éxito',
        value: `${this.formatPercentage(kpis.success_rate)}%`,
        caption: '',
      },
    ];
  }

  private formatNumber(value: number | undefined | null): string {
    return this.numberFormatter.format(value ?? 0);
  }

  private formatPercentage(value: number | undefined | null): string {
    if (value === null || value === undefined) {
      return this.percentageFormatter.format(0);
    }

    const percentageValue = value <= 1 ? value * 100 : value;
    return this.percentageFormatter.format(percentageValue);
  }

  private createLoadingStats(): ClientStatCard[] {
    return [
      {
        label: 'Plantillas Disponibles',
        value: '—',
        caption: 'Cargando información…',
      },
      {
        label: 'Cargas Este Mes',
        value: '—',
        caption: 'Cargando información…',
      },
      {
        label: 'Tasa de Éxito',
        value: '—',
        caption: 'Cargando información…',
      },
    ];
  }

  private createErrorStats(): ClientStatCard[] {
    return [
      {
        label: 'Plantillas Disponibles',
        value: '-',
        caption: 'No se pudo obtener la información',
      },
      {
        label: 'Cargas Este Mes',
        value: '-',
        caption: 'No se pudo obtener la información',
      },
      {
        label: 'Tasa de Éxito',
        value: '-',
        caption: 'No se pudo obtener la información',
      },
    ];
  }

  private mapToRecentUpload(detail: LoadDetailResponseItem): RecentUpload {
    const { load, template } = detail;
    const { status, label } = this.mapStatus(load.status);

    return {
      title: load.file_name ?? 'Carga sin nombre',
      template: template?.name ?? 'Plantilla desconocida',
      date: this.formatRecentUploadDate(load.created_at),
      status,
      statusLabel: label,
    };
  }

  private mapStatus(status: string | null | undefined): { status: UploadStatus; label: string } {
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
        return { status: 'success', label: 'Completado' };
      case 'validado con errores':
      case 'con errores':
      case 'with errors':
      case 'completed with errors':
      case 'partial success':
      case 'partial':
      case 'completado con errores':
        return { status: 'warning', label: 'Con observaciones' };
      case 'fallido':
      case 'failed':
      case 'error':
      case 'errores criticos':
      case 'cancelado':
      case 'cancelled':
      case 'canceled':
      case 'aborted':
      case 'stopped':
        return { status: 'error', label: 'Error crítico' };
      case 'procesando':
      case 'en proceso':
      case 'processing':
      case 'in progress':
      case 'in_progress':
      case 'pending':
      case 'queued':
      case 'validando':
      case 'validating':
        return { status: 'warning', label: 'En proceso' };
      default:
        return { status: 'warning', label: 'Estado desconocido' };
    }
  }

  private formatRecentUploadDate(value: string | null | undefined): string {
    if (!value) {
      return 'Fecha desconocida';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Fecha desconocida';
    }

    const dateFormatter = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
    });

    const timeFormatter = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const formattedDate = dateFormatter.format(date);
    const formattedTime = timeFormatter
      .format(date)
      .replace(/\. ?/g, '')
      .replace('a. m.', 'AM')
      .replace('p. m.', 'PM');

    return `${formattedDate}, ${formattedTime}`;
  }

  private createLoadingUploads(): RecentUpload[] {
    return [
      {
        title: 'Cargando cargas recientes…',
        template: 'Por favor espera',
        date: '',
        status: 'warning',
        statusLabel: 'Cargando…',
      },
    ];
  }

  private createErrorUploads(): RecentUpload[] {
    return [
      {
        title: 'No se pudieron obtener las cargas recientes',
        template: 'Intenta nuevamente más tarde',
        date: '',
        status: 'error',
        statusLabel: 'Error',
      },
    ];
  }

  private createEmptyUploads(): RecentUpload[] {
    return [
      {
        title: 'No hay cargas recientes',
        template: 'Empieza subiendo tu primera carga',
        date: '',
        status: 'warning',
        statusLabel: 'Sin registros',
      },
    ];
  }
}
