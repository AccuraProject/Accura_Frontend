import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  constructor(private readonly router: Router) {}

  protected readonly stats: StatisticCard[] = [
    { title: 'Total Usuarios', value: '24', change: '+8 vs mes pasado', icon: 'group' },
    {
      title: 'Plantillas Activas',
      value: '12',
      change: '3 desactivadas',
      icon: 'docs',
      highlight: true
    },
    { title: 'Cargas Hoy', value: '48', change: '+22 vs ayer', icon: 'upload' },
    { title: 'Validaciones Exitosas', value: '452', change: '95% efectividad', icon: 'check_circle' }
  ];

  protected readonly activity: ActivityItem[] = [
    { name: 'María García', action: 'Agregó regla en Plantilla A', time: 'Hace 12 minutos' },
    { name: 'Juan Pérez', action: 'Validó carga con errores críticos', time: 'Hace 30 minutos' },
    { name: 'Ana López', action: 'Actualizó permisos del equipo QA', time: 'Hace 1 hora' },
    { name: 'Accura Bot', action: 'Envió reporte de validaciones diarias', time: 'Hace 3 horas' }
  ];

  protected readonly quickActions: QuickAction[] = [
    { label: 'Gestionar Usuarios', description: 'Administrar roles y accesos', route: '/usuarios' },
    { label: 'Crear Plantilla', description: 'Diseñar nueva configuración' },
    { label: 'Ver Historial de Cargas', description: 'Monitorear ejecuciones recientes' }
  ];

  protected handleAction(action: QuickAction): void {
    if (action.route) {
      this.router.navigateByUrl(action.route);
    }
  }
}
