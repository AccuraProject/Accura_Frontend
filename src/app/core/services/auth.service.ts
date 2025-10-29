import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/auth-response.model';
import { LoginOptions } from '../models/login-options.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  login(email: string, password: string, options: LoginOptions = {}): Observable<AuthResponse> {
    const { scope = 'offline_access', clientId, clientSecret, grantType = 'password' } = options;

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

    return this.http.post<AuthResponse>(`${this.baseUrl}/auth/token`, formData);
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

}
