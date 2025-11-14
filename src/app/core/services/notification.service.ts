import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, from, mergeMap, of, share, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';
import { webSocket } from 'rxjs/webSocket';

import { environment } from '../../../environments/environment';
import { NotificationEvent } from '../models/notification.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root',
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

  notificationUpdates(): Observable<NotificationEvent> {
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
          mergeMap((raw: any) => {
            console.log('Notificación recibida por WS:', raw);
            // raw es algo como { type, data }

            // Caso A: viene con type y data es un array
            if (raw && Array.isArray(raw.data)) {
              return from(raw.data as NotificationEvent[]);
            }

            // Caso B: viene con type y data es un objeto
            if (raw && raw.data) {
              return of(raw.data as NotificationEvent);
            }

            // Caso C: por si acaso, directo plano o array sin envoltura
            if (Array.isArray(raw)) {
              return from(raw as NotificationEvent[]);
            }

            return of(raw as NotificationEvent);
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
}
