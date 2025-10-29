import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { selectSessionRole } from '../../core/store/session/session.selectors';

interface NavigationItem {
  icon: string;
  label: string;
  route?: string;
  exact?: boolean;
  roles?: NavigationRole[];
}

type NavigationRole = 'admin' | 'user';

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

  private readonly store = inject(Store);

  protected readonly filteredNavigation$: Observable<NavigationItem[]> = this.store
    .select(selectSessionRole)
    .pipe(map((role) => this.filterNavigation(role)));

  constructor(private readonly router: Router) {}

  protected readonly navigation: NavigationItem[] = [
    { icon: 'home', label: 'Inicio', route: '/', exact: true },
    { icon: 'group', label: 'Usuarios', route: '/usuarios', roles: ['admin'] },
    {
      icon: 'check_box',
      label: 'Reglas de Validación',
      route: '/reglas-validacion',
      roles: ['admin'],
    },
    { icon: 'docs', label: 'Plantillas', route: '/plantillas' },
    { icon: 'upload_file', label: 'Cargar archivo', route: '/cargar-archivo', roles: ['user'] },
    { icon: 'shield', label: 'Permisos', route: '/permisos', roles: ['admin'] },
    { icon: 'history', label: 'Historial', route: '/historial' },
    { icon: 'settings', label: 'Configuración', route: '/configuracion' }
  ];

  protected trackByLabel(_: number, item: NavigationItem): string {
    return item.label;
  }

  protected navigate(item: NavigationItem): void {
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }

    this.requestClose.emit();
  }

  private filterNavigation(role: string | null): NavigationItem[] {
    const normalizedRole: NavigationRole = role === 'admin' ? 'admin' : 'user';

    return this.navigation.filter((item) => {
      if (!item.roles || item.roles.length === 0) {
        return true;
      }

      return item.roles.includes(normalizedRole);
    });
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
