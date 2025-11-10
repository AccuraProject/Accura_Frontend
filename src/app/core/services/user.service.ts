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
  UserResponse
} from '../models/user.model';
import { selectSessionState } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root'
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.post<CreatedUserResponse>(`${this.baseUrl}/users`, payload, { headers });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.get<UserResponse[]>(`${this.baseUrl}/users`, {
          headers
        });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.get<CurrentUserResponse>(`${this.baseUrl}/users/me`, { headers });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.put<CurrentUserResponse>(`${this.baseUrl}/users/${userId}`, payload, {
          headers
        });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.delete<void>(`${this.baseUrl}/users/${userId}`, { headers });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.put<void>(`${this.baseUrl}/users/${userId}`, payload, { headers });
      })
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
          Authorization: `${tokenType} ${session.accessToken}`
        });

        return this.http.post<void>(`${this.baseUrl}/users/${userId}/reset-password`, {}, {
          headers
        });
      })
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim().length > 0) {
        return error.error;
      }

      if (error.error?.detail) {
        return error.error.detail;
      }

      if (error.status === 0) {
        return 'No se pudo establecer conexión con el servidor.';
      }

      if (error.status === 401) {
        return 'No estás autorizado para realizar esta acción.';
      }

      return 'No se pudo completar la solicitud. Inténtalo nuevamente.';
    }

    return 'Ha ocurrido un error desconocido al procesar la solicitud.';
  }
}
