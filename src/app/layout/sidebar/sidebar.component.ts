import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RippleModule } from 'primeng/ripple';
import { TooltipModule } from 'primeng/tooltip';

import { selectSessionRole } from '../../core/store/session/session.selectors';

type NavigationRole = 'admin' | 'user';

interface NavigationItem {
  icon: string;
  label: string;
  route: string;
  exact?: boolean;
  roles?: NavigationRole[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, RippleModule, TooltipModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() mobileNavOpen = false;
  @Input() collapsed = false;
  @Output() requestClose = new EventEmitter<void>();

  private readonly store = inject(Store);

  protected readonly navigation: NavigationItem[] = [
    { icon: 'pi pi-home', label: 'Inicio', route: '/', exact: true },
    { icon: 'pi pi-users', label: 'Usuarios', route: '/usuarios', roles: ['admin'] },
    {
      icon: 'pi pi-check-square',
      label: 'Reglas de Validación',
      route: '/reglas-validacion',
      roles: ['admin'],
    },
    { icon: 'pi pi-file', label: 'Plantillas', route: '/plantillas' },
    { icon: 'pi pi-shield', label: 'Permisos', route: '/permisos', roles: ['admin'] },
    { icon: 'pi pi-history', label: 'Historial', route: '/historial' },
    {
      icon: 'pi pi-question-circle',
      label: 'Manual de usuario',
      route: '/manual-usuario',
    },
    { icon: 'pi pi-cog', label: 'Configuración', route: '/configuracion' },
  ];

  protected readonly filteredNavigation$: Observable<NavigationItem[]> = this.store
    .select(selectSessionRole)
    .pipe(map((role) => this.filterNavigation(role)));

  protected onNavigate(): void {
    this.requestClose.emit();
  }

  private filterNavigation(role: string | null): NavigationItem[] {
    const normalizedRole: NavigationRole = role === 'admin' ? 'admin' : 'user';

    return this.navigation.filter((item) => {
      if (!item.roles?.length) {
        return true;
      }

      return item.roles.includes(normalizedRole);
    });
  }
}
