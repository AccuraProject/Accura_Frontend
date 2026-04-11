import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, map, Observable, switchMap, take, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { selectSessionState } from '../../core/store/session/session.reducer';
import { RulePayload, RuleResponse } from './models/rule.model';
import {
  extractAiPayloads,
  normalizeAiPayload,
  VALIDATION_RULE_AI_SCHEMA,
} from './validation-rule-ai.utils';

@Injectable({ providedIn: 'root' })
export class ValidationRulesService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  getRules(): Observable<RuleResponse[]> {
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

        return this.http.get<RuleResponse[]>(`${this.baseUrl}/rules`, {
          headers,
        });
      }),
    );
  }

  async fetchRules(): Promise<unknown> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/rules/`, { headers }));
  }

  async fetchRule(ruleId: string | number): Promise<unknown> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(ruleId));
    return await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/rules/${encodedId}`, { headers }),
    );
  }

  saveRule(rule: RulePayload, isActive: boolean): Observable<RuleResponse> {
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

        const body = { rule, is_active: isActive };

        return this.http.post<RuleResponse>(`${this.baseUrl}/rules/`, body, { headers });
      }),
    );
  }

  updateRule(ruleId: number, rule: RulePayload, isActive: boolean): Observable<RuleResponse> {
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

        const body = { rule, is_active: isActive };

        return this.http.put<RuleResponse>(`${this.baseUrl}/rules/${ruleId}`, body, { headers });
      }),
    );
  }

  deleteRule(ruleId: number): Observable<void> {
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

        return this.http.delete<void>(`${this.baseUrl}/rules/${ruleId}`, { headers });
      }),
    );
  }

  private async buildAuthHeaders(): Promise<HttpHeaders> {
    const session = await firstValueFrom(this.store.select(selectSessionState));

    if (!session?.accessToken) {
      throw new Error('No hay un token de autenticación disponible.');
    }

    const tokenType = session.tokenType ?? 'Bearer';

    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${tokenType} ${session.accessToken}`,
    });
  }

  generateRuleWithAi(description: string): Observable<RulePayload[]> {
    return this.store.select(selectSessionState).pipe(
      take(1),
      switchMap((session) => {
        if (!session.accessToken) {
          return throwError(() => new Error('No hay un token de autenticación disponible.'));
        }

        const tokenType = session.tokenType ?? 'Bearer';
        const headers = new HttpHeaders({
          'Content-Type': 'application/json',
          Authorization: `${tokenType} ${session.accessToken}`,
        });

        const body = {
          schema: VALIDATION_RULE_AI_SCHEMA,
          message: description.trim(),
          is_admin: (session.role ?? '').toLowerCase() === 'admin',
        };

        return this.http.post<unknown>(`${this.baseUrl}/assistant/analyze`, body, {
          headers,
        });
      }),
      map((data) =>
        extractAiPayloads(data)
          .map((item) => normalizeAiPayload(item))
          .filter((item): item is RulePayload => item !== null),
      ),
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
