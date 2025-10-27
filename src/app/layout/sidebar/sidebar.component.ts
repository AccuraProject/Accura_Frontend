import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() mobileNavOpen = false;
  @Output() requestClose = new EventEmitter<void>();

  protected readonly navigation: NavigationItem[] = [
    { icon: 'home', label: 'Inicio', active: true },
    { icon: 'group', label: 'Usuarios' },
    { icon: 'check_box', label: 'Reglas de Validación' },
    { icon: 'docs', label: 'Plantillas' },
    { icon: 'shield', label: 'Permisos' },
    { icon: 'history', label: 'Historial' },
    { icon: 'settings', label: 'Configuración' }
  ];

  protected onNavigate(): void {
    this.requestClose.emit();
  }
}
