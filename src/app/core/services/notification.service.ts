import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, share, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../../environments/environment';
import { NotificationEvent } from '../models/notification.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly notificationsWsUrl = environment.notificationsWsUrl;
  private notificationUpdates$?: Observable<NotificationEvent>;

  fetchNotifications(): Observable<NotificationEvent[]> {
    return this.store.select(selectSessionState).pipe(
      take(1),
      switchMap((session) => {
        if (!session.accessToken) {
          return throwError(() => new Error('No hay un token de autenticación disponible.'));
        }

        const tokenType = session.tokenType ?? 'Bearer';
        const headers = new HttpHeaders({
          Authorization: `${tokenType} ${session.accessToken}`
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.post(`${this.baseUrl}/notifications/mark-read`, { ids }, { headers });
      })
    );
  }

  notificationUpdates(): Observable<NotificationEvent> {
    if (!this.notificationUpdates$) {
      this.notificationUpdates$ = defer(() =>
        this.store.select(selectSessionState).pipe(
          take(1),
          switchMap((session) => {
            if (!session.accessToken) {
              return throwError(() => new Error('No hay un token de autenticación disponible.'));
            }

            const tokenType = session.tokenType ?? 'Bearer';
            const authorization = `${tokenType} ${session.accessToken}`;
            const url = this.buildNotificationsWsUrl(authorization);

            return webSocket<NotificationEvent>({
              url,
              deserializer: ({ data }) => JSON.parse(data) as NotificationEvent
            });
          })
        )
      ).pipe(share());
    }

    return this.notificationUpdates$;
  }

  private buildNotificationsWsUrl(authorization: string): string {
    const base = this.notificationsWsUrl
      ? this.notificationsWsUrl.trim()
      : this.baseUrl.replace(/^http(s?):\/\//, (_match, protocol) =>
          protocol ? `ws${protocol === 's' ? 's' : ''}://` : 'ws://'
        );
    const url = this.notificationsWsUrl ? base : `${base}/notifications/stream`;
    const separator = url.includes('?') ? '&' : '?';

    return `${url}${separator}token=${encodeURIComponent(authorization)}`;
  }
}
