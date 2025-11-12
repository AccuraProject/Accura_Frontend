import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';

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
}
