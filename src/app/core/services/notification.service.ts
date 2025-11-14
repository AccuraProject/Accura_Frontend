import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, defer, from, mergeMap, share, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../../environments/environment';
import {
  NotificationEvent,
  NotificationUpdatesEvent,
  NotificationUpdatesLoadEvent,
  NotificationUpdatesLoadEventData,
  NotificationUpdatesNotificationEvent
} from '../models/notification.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly notificationsWsUrl = environment.notificationsWsUrl;
  private notificationUpdates$?: Observable<NotificationUpdatesEvent>;

  fetchNotifications(): Observable<NotificationEvent[]> {
    return this.store.select(selectSessionState).pipe(
      take(1),
      switchMap((session) => {
        if (!session.accessToken) {
          return throwError(() => new Error('No hay un token de autenticación disponible.'));
        }

        const tokenType = session.tokenType ?? 'Bearer';
        const headers = new HttpHeaders({
          Authorization: `${tokenType} ${session.accessToken}`,
        });

        return this.http.get<NotificationEvent[]>(`${this.baseUrl}/notifications/`, { headers });
      })
    );
  }

  markNotificationsAsRead(ids: number[]): Observable<unknown> {
    if (!ids.length) {
      return throwError(() => new Error('No hay notificaciones por marcar como leídas.'));
    }

    return this.store.select(selectSessionState).pipe(
      take(1),
      switchMap((session) => {
        if (!session.accessToken) {
          return throwError(() => new Error('No hay un token de autenticación disponible.'));
        }

        const tokenType = session.tokenType ?? 'Bearer';
        const headers = new HttpHeaders({
          Authorization: `${tokenType} ${session.accessToken}`,
        });

        return this.http.post(`${this.baseUrl}/notifications/mark-read`, { ids }, { headers });
      })
    );
  }

  notificationUpdates(): Observable<NotificationUpdatesEvent> {
    if (!this.notificationUpdates$) {
      this.notificationUpdates$ = defer(() =>
        this.store.select(selectSessionState).pipe(
          take(1),
          switchMap((session) => {
            if (!session.accessToken) {
              return throwError(() => new Error('No hay un token de autenticación disponible.'));
            }

            const url = this.buildNotificationsWsUrl(session.accessToken);

            return webSocket<unknown>({
              url,
              deserializer: ({ data }) => JSON.parse(data), // solo parsear
            });
          }),
          mergeMap((raw: unknown) => {
            const normalized = this.normalizeWebSocketPayload(raw);
            return normalized.length ? from(normalized) : EMPTY;
          }),
          share()
        )
      );
    }

    return this.notificationUpdates$;
  }

  private buildNotificationsWsUrl(token: string): string {
    const base = this.notificationsWsUrl
      ? this.notificationsWsUrl.trim()
      : this.baseUrl.replace(/^http(s?):\/\//, (_match, protocol) =>
          protocol ? `ws${protocol === 's' ? 's' : ''}://` : 'ws://'
        );
    const url = this.notificationsWsUrl ? base : `${base}/notifications/ws`;
    const separator = url.includes('?') ? '&' : '?';

    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  private normalizeWebSocketPayload(raw: unknown): NotificationUpdatesEvent[] {
    if (this.isNotificationEnvelope(raw)) {
      const notifications = this.ensureNotificationArray(raw.data);
      if (!notifications.length) {
        return [];
      }

      const event: NotificationUpdatesNotificationEvent = {
        type: 'notification',
        data: notifications
      };

      return [event];
    }

    if (this.isLoadEventEnvelope(raw)) {
      const data = raw.data;
      const event: NotificationUpdatesLoadEvent = {
        type: 'load-event',
        data: {
          ...data,
          template: data.template ?? null,
          user: data.user ?? null
        }
      };

      return [event];
    }

    if (Array.isArray(raw)) {
      const notifications = this.ensureNotificationArray(raw);
      if (!notifications.length) {
        return [];
      }

      const event: NotificationUpdatesNotificationEvent = {
        type: 'notification',
        data: notifications
      };

      return [event];
    }

    if (this.isNotificationEvent(raw)) {
      const event: NotificationUpdatesNotificationEvent = {
        type: 'notification',
        data: [raw]
      };

      return [event];
    }

    return [];
  }

  private ensureNotificationArray(value: unknown): NotificationEvent[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is NotificationEvent => this.isNotificationEvent(item));
    }

    if (this.isNotificationEvent(value)) {
      return [value];
    }

    return [];
  }

  private isNotificationEnvelope(value: unknown): value is NotificationUpdatesNotificationEvent & {
    data: unknown;
  } {
    return this.isPlainObject(value) && value.type === 'notification';
  }

  private isLoadEventEnvelope(value: unknown): value is NotificationUpdatesLoadEvent {
    if (!this.isPlainObject(value) || value.type !== 'load-event') {
      return false;
    }

    return this.isLoadEventData((value as NotificationUpdatesLoadEvent).data);
  }

  private isLoadEventData(value: unknown): value is NotificationUpdatesLoadEventData {
    if (!this.isPlainObject(value)) {
      return false;
    }

    const data = value as NotificationUpdatesLoadEventData;
    return this.isPlainObject(data.load) && typeof data.event_type === 'string' && typeof data.stage === 'string';
  }

  private isNotificationEvent(value: unknown): value is NotificationEvent {
    if (!this.isPlainObject(value)) {
      return false;
    }

    const candidate = value as NotificationEvent;
    return (
      typeof candidate.id === 'number' &&
      typeof candidate.user_id === 'number' &&
      typeof candidate.event_type === 'string' &&
      typeof candidate.title === 'string' &&
      typeof candidate.message === 'string' &&
      typeof candidate.created_at === 'string' &&
      ('read_at' in candidate ? candidate.read_at === null || typeof candidate.read_at === 'string' : true)
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
