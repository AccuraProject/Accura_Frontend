import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, take, throwError } from 'rxjs';
import { Store } from '@ngrx/store';

import { environment } from '../../../environments/environment';
import {
  CreatedUserResponse,
  CreateUserPayload,
  CurrentUserResponse,
  ResetPasswordPayload,
  UpdateUserPayload,
  UserResponse,
} from '../models/user.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  createUser(payload: CreateUserPayload): Observable<CreatedUserResponse> {
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

        return this.http.post<CreatedUserResponse>(`${this.baseUrl}/users`, payload, { headers });
      }),
    );
  }

  getUsers(): Observable<UserResponse[]> {
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

        return this.http.get<UserResponse[]>(`${this.baseUrl}/users`, {
          headers,
        });
      }),
    );
  }

  getCurrentUser(): Observable<CurrentUserResponse> {
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

        return this.http.get<CurrentUserResponse>(`${this.baseUrl}/users/me`, { headers });
      }),
    );
  }

  updateUser(userId: number, payload: UpdateUserPayload): Observable<CurrentUserResponse> {
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

        return this.http.put<CurrentUserResponse>(`${this.baseUrl}/users/${userId}`, payload, {
          headers,
        });
      }),
    );
  }

  deleteUser(userId: number): Observable<void> {
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

        return this.http.delete<void>(`${this.baseUrl}/users/${userId}`, { headers });
      }),
    );
  }

  changePassword(payload: UpdateUserPayload): Observable<CurrentUserResponse> {
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

        return this.http.put<CurrentUserResponse>(`${this.baseUrl}/users/me/password`, payload, {
          headers,
        });
      }),
    );
  }

  resetPassword(userId: number, payload: ResetPasswordPayload): Observable<void> {
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

        return this.http.put<void>(`${this.baseUrl}/users/${userId}`, payload, { headers });
      }),
    );
  }

  resetManagedUserPassword(userId: number): Observable<void> {
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

        return this.http.post<void>(
          `${this.baseUrl}/users/${userId}/reset-password`,
          {},
          {
            headers,
          },
        );
      }),
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
