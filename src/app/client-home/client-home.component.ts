import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface OnboardingStep {
  order: number;
  title: string;
  description: string;
}

interface SummaryCard {
  title: string;
  value: string;
  description: string;
  icon: string;
}

interface RecentUpload {
  name: string;
  timestamp: string;
  status: string;
  state: 'success' | 'warning' | 'info';
}

interface FeaturedTemplate {
  name: string;
  description: string;
  details: string;
  cta: string;
}

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-home.component.html',
  styleUrl: './client-home.component.scss'
})
export class ClientHomeComponent {
  protected readonly onboardingSteps: OnboardingStep[] = [
    {
      order: 1,
      title: 'Selecciona una Plantilla',
      description: 'Explora las plantillas disponibles y elige la que mejor se adapta a tus datos.'
    },
    {
      order: 2,
      title: 'Carga tu Archivo',
      description: 'Sube tu archivo Excel o selecciona uno previo para validar en segundos.'
    },
    {
      order: 3,
      title: 'Revisa el Resultado',
      description: 'Analiza los hallazgos, descarga reportes y comparte con tu equipo.'
    }
  ];

  protected readonly summaryCards: SummaryCard[] = [
    {
      title: 'Plantillas Disponibles',
      value: '12',
      description: 'listas para su uso',
      icon: 'library_books'
    },
    {
      title: 'Cargas Este Mes',
      value: '15',
      description: 'última hace 3 horas',
      icon: 'cloud_upload'
    },
    {
      title: 'Tasa de Éxito',
      value: '93%',
      description: 'basado en las últimas 25 validaciones',
      icon: 'verified'
    }
  ];

  protected readonly recentUploads: RecentUpload[] = [
    {
      name: 'Plantilla de Ventas',
      timestamp: 'Hoy · 09:45 AM',
      status: 'Validación completada sin errores',
      state: 'success'
    },
    {
      name: 'Plantilla de Inventario',
      timestamp: 'Ayer · 06:15 PM',
      status: 'Se detectaron 3 observaciones menores',
      state: 'warning'
    },
    {
      name: 'Plantilla Financiera',
      timestamp: 'Ayer · 11:30 AM',
      status: 'Archivo listo para revisión del área contable',
      state: 'info'
    }
  ];

  protected readonly featuredTemplate: FeaturedTemplate = {
    name: 'Plantilla de Inventario',
    description: 'Mantén tus registros al día con reglas personalizadas para tu operación.',
    details: 'Última actualización: hace 2 días · Responsable: Laura Gómez',
    cta: 'Ver detalles'
  };
}
