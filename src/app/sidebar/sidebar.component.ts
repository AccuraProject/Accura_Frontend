import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface SidebarItem {
  readonly label: string;
  readonly icon: string;
  readonly badge?: string;
  readonly active?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly mainNavigation: SidebarItem[] = [
    { label: 'Inicio', icon: 'home', active: true },
    { label: 'Usuarios', icon: 'users' },
    { label: 'Reglas de Validación', icon: 'shield' },
    { label: 'Plantillas', icon: 'layers', badge: '12' },
    { label: 'Permisos', icon: 'key' },
    { label: 'Historial', icon: 'clock' },
    { label: 'Configuración', icon: 'settings' },
  ];

  readonly quickActions: SidebarItem[] = [
    { label: 'Gestionar Usuarios', icon: 'users' },
    { label: 'Crear Plantilla', icon: 'plus' },
    { label: 'Ver Historial de Cargas', icon: 'cloud' },
  ];
}
