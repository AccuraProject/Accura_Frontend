import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthService } from '../../core/services/auth.service';
import { SessionActions } from '../../core/store/session/session.actions';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private readonly authService = inject(AuthService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly notifications = 4;

  protected onToggleMenu(): void {
    this.menuToggle.emit();
  }

  protected onLogout(): void {
    this.authService.clearSession();
    this.store.dispatch(SessionActions.logout());
    void this.router.navigate(['/login']);
  }
}
