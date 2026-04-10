import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';

import { environment } from '../../../environments/environment';
import { LoadDetailResponseItem } from '../models/load-detail.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root'
})
export class LoadsService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  fetchLoadDetails(): Observable<LoadDetailResponseItem[]> {
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

        return this.http.get<LoadDetailResponseItem[]>(`${this.baseUrl}/loads/details`, {
          headers
        });
      })
    );
  }

  downloadLoadReport(loadId: string): Observable<HttpResponse<Blob>> {
    return this.requestLoadFile(loadId, 'report');
  }

  downloadLoadSource(loadId: string): Observable<HttpResponse<Blob>> {
    return this.requestLoadFile(loadId, 'source');
  }

  private requestLoadFile(loadId: string, resource: 'report' | 'source'): Observable<HttpResponse<Blob>> {
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

        return this.http.get(`${this.baseUrl}/loads/${loadId}/${resource}`, {
          headers,
          responseType: 'blob',
          observe: 'response'
        });
      })
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const err = error.error;

      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }

      if (err?.detail) {
        if (typeof err.detail === 'string') {
          return err.detail;
        }

        if (Array.isArray(err.detail) || typeof err.detail === 'object') {
          console.warn('Error detail no controlado:', err.detail);
          return 'Ocurrió un error inesperado. Contacta al soporte o intenta nuevamente.';
        }
      }

      // Sin conexión
      if (error.status === 0) {
        return 'No se pudo establecer conexión con el servidor.';
      }

      // No autorizado
      if (error.status === 401) {
        return 'No estás autorizado para realizar esta acción.';
      }

      // Error genérico backend
      return 'No se pudo completar la solicitud. Inténtalo nuevamente.';
    }

    return 'Ha ocurrido un error desconocido al procesar la solicitud.';
  }
}
