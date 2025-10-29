import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { KpiService } from '../../core/services/kpi.service';
import { DashboardKpis } from '../../core/models/dashboard-kpis.model';

interface StatisticCard {
  title: string;
  value: string;
  change: string;
  icon: string;
  highlight?: boolean;
}

interface ActivityItem {
  name: string;
  action: string;
  time: string;
}

interface QuickAction {
  label: string;
  description: string;
  route?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly router = inject(Router);
  private readonly kpiService = inject(KpiService);
  private readonly numberFormatter = new Intl.NumberFormat('es-ES');
  private readonly percentageFormatter = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  protected stats: StatisticCard[] = this.createLoadingStats();

  protected readonly activity: ActivityItem[] = [
    { name: 'María García', action: 'Agregó regla en Plantilla A', time: 'Hace 12 minutos' },
    { name: 'Juan Pérez', action: 'Validó carga con errores críticos', time: 'Hace 30 minutos' },
    { name: 'Ana López', action: 'Actualizó permisos del equipo QA', time: 'Hace 1 hora' },
    { name: 'Accura Bot', action: 'Envió reporte de validaciones diarias', time: 'Hace 3 horas' },
  ];

  protected readonly quickActions: QuickAction[] = [
    { label: 'Gestionar Usuarios', description: 'Administrar roles y accesos', route: '/usuarios' },
    { label: 'Crear Plantilla', description: 'Diseñar nueva configuración', route: '/plantillas' },
    { label: 'Ver Historial de Cargas', description: 'Monitorear ejecuciones recientes' },
  ];

  constructor() {
    this.kpiService.fetchDashboardKpis().subscribe({
      next: (kpis) => {
        this.stats = this.mapKpisToStats(kpis);
      },
      error: () => {
        this.stats = this.createErrorStats();
      },
    });
  }

  protected handleAction(action: QuickAction): void {
    if (action.route) {
      this.router.navigateByUrl(action.route);
    }
  }

  private mapKpisToStats(kpis: DashboardKpis): StatisticCard[] {
    return [
      {
        title: 'Usuarios Activos',
        value: this.formatNumber(kpis.active_users.current_month),
        change: this.formatDelta(kpis.active_users.current_month, kpis.active_users.previous_month),
        icon: 'group',
      },
      {
        title: 'Plantillas Publicadas',
        value: this.formatNumber(kpis.templates.published),
        change: `${this.formatNumber(kpis.templates.unpublished)} sin publicar`,
        icon: 'docs',
        highlight: true,
      },
      {
        title: 'Cargas del Mes',
        value: this.formatNumber(kpis.loads.current_month),
        change: this.formatDelta(kpis.loads.current_month, kpis.loads.previous_month),
        icon: 'upload',
      },
      {
        title: 'Validaciones Exitosas',
        value: this.formatNumber(kpis.validations.successful),
        change: `${this.formatNumber(kpis.validations.total)} totales · ${this.formatPercentage(
          kpis.validations.effectiveness_percentage
        )}% efectividad`,
        icon: 'check_circle',
      },
    ];
  }

  private formatNumber(value: number): string {
    return this.numberFormatter.format(value ?? 0);
  }

  private formatPercentage(value: number): string {
    return this.percentageFormatter.format(value ?? 0);
  }

  private formatDelta(current: number, previous: number): string {
    const difference = (current ?? 0) - (previous ?? 0);
    if (difference === 0) {
      return 'Sin cambios vs mes anterior';
    }

    const sign = difference > 0 ? '+' : '-';
    return `${sign}${this.formatNumber(Math.abs(difference))} vs mes anterior`;
  }

  private createLoadingStats(): StatisticCard[] {
    return [
      { title: 'Usuarios Activos', value: '—', change: 'Cargando...', icon: 'group' },
      {
        title: 'Plantillas Publicadas',
        value: '—',
        change: 'Cargando...',
        icon: 'docs',
      },
      { title: 'Cargas del Mes', value: '—', change: 'Cargando...', icon: 'upload' },
      {
        title: 'Validaciones Exitosas',
        value: '—',
        change: 'Cargando...',
        icon: 'check_circle',
      },
    ];
  }

  private createErrorStats(): StatisticCard[] {
    return [
      {
        title: 'Usuarios Activos',
        value: '-',
        change: 'No se pudo obtener la información',
        icon: 'group',
      },
      {
        title: 'Plantillas Publicadas',
        value: '-',
        change: 'No se pudo obtener la información',
        icon: 'docs',
        highlight: true,
      },
      {
        title: 'Cargas del Mes',
        value: '-',
        change: 'No se pudo obtener la información',
        icon: 'upload',
      },
      {
        title: 'Validaciones Exitosas',
        value: '-',
        change: 'No se pudo obtener la información',
        icon: 'check_circle',
      },
    ];
  }
}
