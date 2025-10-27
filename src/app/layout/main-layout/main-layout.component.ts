import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

interface StatisticCard {
  title: string;
  value: string;
  change: string;
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
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, SidebarComponent, ToolbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  protected mobileNavOpen = false;

  protected readonly stats: StatisticCard[] = [
    { title: 'Total Usuarios', value: '24', change: '+8 vs mes pasado' },
    { title: 'Plantillas Activas', value: '12', change: '3 desactivadas', highlight: true },
    { title: 'Cargas Hoy', value: '48', change: '+22 vs ayer' },
    { title: 'Validaciones Exitosas', value: '452', change: '95% efectividad' }
  ];

  protected readonly activity: ActivityItem[] = [
    { name: 'María García', action: 'Agregó regla en Plantilla A', time: 'Hace 12 minutos' },
    { name: 'Juan Pérez', action: 'Validó carga con errores críticos', time: 'Hace 30 minutos' },
    { name: 'Ana López', action: 'Actualizó permisos del equipo QA', time: 'Hace 1 hora' },
    { name: 'Accura Bot', action: 'Envió reporte de validaciones diarias', time: 'Hace 3 horas' }
  ];

  protected readonly quickActions: QuickAction[] = [
    { label: 'Gestionar Usuarios', description: 'Administrar roles y accesos' },
    { label: 'Crear Plantilla', description: 'Diseñar nueva configuración' },
    { label: 'Ver Historial de Cargas', description: 'Monitorear ejecuciones recientes' }
  ];

  protected toggleMobileNav(): void {
    this.mobileNavOpen = !this.mobileNavOpen;
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen = false;
  }
}
