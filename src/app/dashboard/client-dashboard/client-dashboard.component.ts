import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { KpiService } from '../../core/services/kpi.service';
import { DashboardKpis } from '../../core/models/dashboard-kpis.model';

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

  protected readonly recentUploads: RecentUpload[] = [
    {
      title: 'Plantilla de Ventas',
      template: 'Plantilla Comercial',
      date: '22 de abril, 09:30 AM',
      status: 'success',
      statusLabel: 'Completado',
    },
    {
      title: 'Plantilla de Inventario',
      template: 'Plantilla Logística',
      date: '21 de abril, 05:18 PM',
      status: 'warning',
      statusLabel: 'Con observaciones',
    },
    {
      title: 'Corte Financiero Q1',
      template: 'Plantilla Financiera',
      date: '20 de abril, 11:02 AM',
      status: 'error',
      statusLabel: 'Error crítico',
    },
  ];

  protected readonly statusClassMap: Record<UploadStatus, string> = {
    success: 'client-recent__status--success',
    warning: 'client-recent__status--warning',
    error: 'client-recent__status--error',
  };

  constructor() {
    this.kpiService.fetchDashboardKpis().subscribe({
      next: (kpis) => {
        this.clientStats = this.mapKpisToStats(kpis);
      },
      error: () => {
        this.clientStats = this.createErrorStats();
      },
    });
  }

  protected navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }

  private mapKpisToStats(kpis: DashboardKpis): ClientStatCard[] {
    const totalTemplates = kpis.templates.total ??
      ((kpis.templates.published ?? 0) + (kpis.templates.unpublished ?? 0));

    return [
      {
        label: 'Plantillas Disponibles',
        value: this.formatNumber(totalTemplates),
        caption: `${this.formatNumber(kpis.templates.published)} publicadas · ${this.formatNumber(kpis.templates.unpublished)} sin publicar`,
      },
      {
        label: 'Cargas Este Mes',
        value: this.formatNumber(kpis.loads.current_month),
        caption: this.formatDelta(kpis.loads.current_month, kpis.loads.previous_month),
      },
      {
        label: 'Tasa de Éxito',
        value: `${this.formatPercentage(kpis.validations.effectiveness_percentage)}%`,
        caption: `${this.formatNumber(kpis.validations.successful)} validaciones exitosas de ${this.formatNumber(kpis.validations.total)} totales`,
      },
    ];
  }

  private formatNumber(value: number | undefined | null): string {
    return this.numberFormatter.format(value ?? 0);
  }

  private formatPercentage(value: number | undefined | null): string {
    return this.percentageFormatter.format(value ?? 0);
  }

  private formatDelta(current: number | undefined | null, previous: number | undefined | null): string {
    const currentValue = current ?? 0;
    const previousValue = previous ?? 0;
    const difference = currentValue - previousValue;

    if (difference === 0) {
      return 'Sin cambios vs mes anterior';
    }

    const sign = difference > 0 ? '+' : '-';
    return `${sign}${this.formatNumber(Math.abs(difference))} vs mes anterior`;
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
}
