import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { KpiService } from '../../core/services/kpi.service';
import { ClientDashboardKpis } from '../../core/models/client-dashboard-kpis.model';

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
    this.kpiService.fetchClientDashboardKpis().subscribe({
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
        caption: `${this.formatNumber(kpis.successful_rows)} filas validadas correctamente`,
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
}
