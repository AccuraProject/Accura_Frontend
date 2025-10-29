import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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

  protected readonly clientStats: ClientStatCard[] = [
    {
      label: 'Plantillas Disponibles',
      value: '8',
      caption: 'Personalizadas para tus procesos',
    },
    {
      label: 'Cargas Este Mes',
      value: '15',
      caption: '3 cargas pendientes de revisión',
    },
    {
      label: 'Tasa de Éxito',
      value: '93%',
      caption: 'Validaciones superadas la primera vez',
    },
  ];

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

  protected navigateTo(route: string): void {
    this.router.navigateByUrl(route);
  }
}
