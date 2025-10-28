import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface NavigationItem {
  icon: string;
  label: string;
  route?: string;
  exact?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, MatListModule, MatButtonModule, MatIconModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  @Input() mobileNavOpen = false;
  @Output() requestClose = new EventEmitter<void>();

  constructor(private readonly router: Router) {}

  protected readonly navigation: NavigationItem[] = [
    { icon: 'home', label: 'Inicio', route: '/', exact: true },
    { icon: 'group', label: 'Usuarios', route: '/usuarios' },
    { icon: 'check_box', label: 'Reglas de Validación' },
    { icon: 'docs', label: 'Plantillas' },
    { icon: 'shield', label: 'Permisos' },
    { icon: 'history', label: 'Historial' },
    { icon: 'settings', label: 'Configuración' }
  ];

  protected navigate(item: NavigationItem): void {
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }

    this.requestClose.emit();
  }

  protected isActive(item: NavigationItem): boolean {
    if (!item.route) {
      return false;
    }

    if (item.exact) {
      return this.router.url === item.route;
    }

    return this.router.url.startsWith(item.route);
  }
}
