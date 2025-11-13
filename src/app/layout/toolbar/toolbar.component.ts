import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { SessionActions } from '../../core/store/session/session.actions';
import { CurrentUserResponse } from '../../core/models/user.model';
import { selectSessionUser } from '../../core/store/session/session.selectors';
import { NotificationService } from '../../core/services/notification.service';
import { NotificationEvent } from '../../core/models/notification.model';

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
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected notifications: NotificationEvent[] = [];
  protected unreadCount = 0;
  protected showNotifications = false;
  protected isLoadingNotifications = true;
  protected notificationsError = '';
  protected markNotificationsError = '';
  protected isMarkingNotifications = false;
  protected userInitials = '??';

  constructor() {
    this.store
      .select(selectSessionUser)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.userInitials = this.getInitials(user);
      });

    this.loadNotifications();
    this.listenToNotificationUpdates();
  }

  protected onToggleMenu(): void {
    this.menuToggle.emit();
  }

  protected onToggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  protected onLogout(): void {
    this.store.dispatch(SessionActions.logout());
    void this.router.navigate(['/login']);
  }

  protected trackByNotificationId(_: number, notification: NotificationEvent): number {
    return notification.id;
  }

  protected onMarkNotificationsAsRead(): void {
    if (this.isMarkingNotifications || this.unreadCount === 0) {
      return;
    }

    const unreadIds = this.notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);

    if (unreadIds.length === 0) {
      return;
    }

    this.isMarkingNotifications = true;
    this.markNotificationsError = '';

    this.notificationService
      .markNotificationsAsRead(unreadIds)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isMarkingNotifications = false;
        })
      )
      .subscribe({
        next: () => {
          const readTimestamp = new Date().toISOString();

          this.notifications = this.notifications.map((notification) =>
            notification.read_at ? notification : { ...notification, read_at: readTimestamp }
          );
          this.unreadCount = this.notifications.filter((notification) => !notification.read_at).length;
        },
        error: (error) => {
          this.markNotificationsError =
            error?.message ?? 'No fue posible marcar las notificaciones como leídas. Intenta nuevamente.';
        }
      });
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

  private loadNotifications(): void {
    this.notificationService
      .fetchNotifications()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notifications) => {
          this.notifications = notifications;
          this.unreadCount = notifications.filter((notification) => !notification.read_at).length;
          this.isLoadingNotifications = false;
        },
        error: (error) => {
          this.notificationsError = error?.message ?? 'No fue posible cargar las notificaciones.';
          this.isLoadingNotifications = false;
        }
      });
  }

  private listenToNotificationUpdates(): void {
    this.notificationService
      .notificationUpdates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notification) => {
          console.log(notification);
          const existingIndex = this.notifications.findIndex((item) => item.id === notification.id);

          if (existingIndex >= 0) {
            this.notifications = this.notifications.map((item, index) =>
              index === existingIndex ? notification : item
            );
          } else {
            this.notifications = [notification, ...this.notifications];
          }

          this.unreadCount = this.notifications.filter((item) => !item.read_at).length;

          console.log(this.notifications)
        },
        error: (error) => {
          this.notificationsError = error?.message ?? 'No fue posible recibir nuevas notificaciones.';
        }
      });
  }
}
