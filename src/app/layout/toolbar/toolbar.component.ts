import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SessionActions } from '../../core/store/session/session.actions';
import { CurrentUserResponse } from '../../core/models/user.model';
import { selectSessionUser } from '../../core/store/session/session.selectors';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  private readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly notifications = 4;
  protected userInitials = '??';

  constructor() {
    this.store
      .select(selectSessionUser)
      .pipe(takeUntilDestroyed())
      .subscribe((user) => {
        this.userInitials = this.getInitials(user);
      });
  }

  protected onToggleMenu(): void {
    this.menuToggle.emit();
  }

  protected onLogout(): void {
    this.store.dispatch(SessionActions.logout());
    void this.router.navigate(['/login']);
  }

  private getInitials(user: CurrentUserResponse | null): string {
    if (!user) {
      return '??';
    }

    const nameInitials = this.getInitialsFromName(user.name);
    if (nameInitials) {
      return nameInitials;
    }

    return this.getInitialsFromEmail(user.email) || '??';
  }

  private getInitialsFromName(name: string | null | undefined): string {
    const cleaned = name?.trim();

    if (!cleaned) {
      return '';
    }

    const parts = cleaned.split(/\s+/);
    const firstLetter = parts[0]?.charAt(0) ?? '';
    const secondLetter =
      parts.length > 1
        ? parts[parts.length - 1]?.charAt(0) ?? ''
        : parts[0]?.charAt(1) ?? '';

    const initials = `${firstLetter}${secondLetter}`.toUpperCase();
    return initials.trim();
  }

  private getInitialsFromEmail(email: string | null | undefined): string {
    if (!email) {
      return '';
    }

    const [localPart = ''] = email.split('@');
    return localPart.substring(0, 2).toUpperCase();
  }
}
