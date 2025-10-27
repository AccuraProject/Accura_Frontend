import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface NavigationItem {
  icon: string;
  label: string;
  active?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  protected readonly navigation: NavigationItem[] = [
    { icon: 'home', label: 'Inicio', active: true },
    { icon: 'users', label: 'Usuarios' },
    { icon: 'shield', label: 'Reglas de Validación' },
    { icon: 'file', label: 'Plantillas' },
    { icon: 'lock', label: 'Permisos' },
    { icon: 'history', label: 'Historial' },
    { icon: 'settings', label: 'Configuración' }
  ];
}
