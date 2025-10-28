import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/auth-response.model';
import { LoginOptions } from '../models/login-options.model';
import type { SessionSnapshot } from '../store/session/session.reducer';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  login(email: string, password: string, options: LoginOptions = {}): Observable<AuthResponse> {
    const {
      rememberMe = false,
      scope = 'offline_access',
      clientId,
      clientSecret,
      grantType = 'password'
    } = options;

    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    formData.append('scope', scope);
    formData.append('grant_type', grantType);
    if (clientId) {
      formData.append('client_id', clientId);
    }
    if (clientSecret) {
      formData.append('client_secret', clientSecret);
    }

    return this.http
      .post<AuthResponse>(`${this.baseUrl}/auth/token`, formData)
      .pipe(tap((response) => this.persistSession(response, rememberMe)));
  }

  persistSession(response: AuthResponse, rememberMe: boolean): void {
    const targetStorage = this.getStorage(rememberMe);
    if (!targetStorage) {
      return;
    }

    this.clearSession();

    targetStorage.setItem('access_token', response.access_token);
    targetStorage.setItem('token_type', response.token_type);
    if (response.role) {
      targetStorage.setItem('role', response.role);
    }
    if (response.must_change_password !== undefined) {
      targetStorage.setItem(
        'must_change_password',
        response.must_change_password ? 'true' : 'false'
      );
    }
    if (response.refresh_token) {
      targetStorage.setItem('refresh_token', response.refresh_token);
    }
    if (response.scope) {
      targetStorage.setItem('scope', response.scope);
    }
    if (response.expires_in !== undefined) {
      targetStorage.setItem('expires_in', response.expires_in.toString());
    }
  }

  getStoredSession(): SessionSnapshot | null {
    const storage = this.getExistingStorage();
    if (!storage) {
      return null;
    }

    const accessToken = storage.getItem('access_token');
    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      tokenType: storage.getItem('token_type'),
      role: storage.getItem('role'),
      mustChangePassword: this.parseBoolean(storage.getItem('must_change_password')),
    };
  }

  clearSession(): void {
    if (typeof window === 'undefined') {
      return;
    }

    [window.localStorage, window.sessionStorage].forEach((storage) => {
      storage.removeItem('access_token');
      storage.removeItem('token_type');
      storage.removeItem('role');
      storage.removeItem('must_change_password');
      storage.removeItem('refresh_token');
      storage.removeItem('scope');
      storage.removeItem('expires_in');
    });
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string') {
        return error.error;
      }

      if (error.error?.detail) {
        return error.error.detail;
      }

      if (error.status === 0) {
        return 'No se pudo establecer conexión con el servidor.';
      }

      if (error.status === 401) {
        return 'Credenciales inválidas, por favor revisa tu correo y contraseña.';
      }

      return 'Ha ocurrido un error inesperado. Inténtalo nuevamente.';
    }

    return 'Ha ocurrido un error desconocido.';
  }

  private getStorage(persistent: boolean): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return persistent ? window.localStorage : window.sessionStorage;
  }

  private getExistingStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (window.localStorage.getItem('access_token')) {
      return window.localStorage;
    }

    if (window.sessionStorage.getItem('access_token')) {
      return window.sessionStorage;
    }

    return null;
  }

  private parseBoolean(value: string | null): boolean | null {
    if (value === null) {
      return null;
    }

    return value === 'true';
  }
}
