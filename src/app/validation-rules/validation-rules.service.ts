import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { selectSessionState } from '../core/store/session/session.reducer';
import { RulePayload } from './validation-rule-ai.utils';

@Injectable({ providedIn: 'root' })
export class ValidationRulesService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient, private readonly store: Store) {}

  async fetchRules(): Promise<unknown> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(this.http.get<unknown>(`${this.baseUrl}/rules/`, { headers }));
  }

  async fetchRule(ruleId: string | number): Promise<unknown> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(ruleId));
    return await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/rules/${encodedId}`, { headers })
    );
  }

  async saveRule(rule: RulePayload, isActive: boolean): Promise<void> {
    const headers = await this.buildAuthHeaders();
    const body = { rule, is_active: isActive };
    await firstValueFrom(this.http.post<void>(`${this.baseUrl}/rules/`, body, { headers }));
  }

  async updateRule(ruleId: string, rule: RulePayload, isActive: boolean): Promise<void> {
    const headers = await this.buildAuthHeaders();
    const body = { rule, is_active: isActive };
    const encodedId = encodeURIComponent(ruleId);
    await firstValueFrom(this.http.put<void>(`${this.baseUrl}/rules/${encodedId}`, body, { headers }));
  }

  async deleteRule(ruleId: string): Promise<void> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(ruleId);
    await firstValueFrom(this.http.delete<void>(`${this.baseUrl}/rules/${encodedId}`, { headers }));
  }

  private async buildAuthHeaders(): Promise<HttpHeaders> {
    const session = await firstValueFrom(this.store.select(selectSessionState));

    if (!session?.accessToken) {
      throw new Error('No hay un token de autenticación disponible.');
    }

    const tokenType = session.tokenType ?? 'Bearer';

    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `${tokenType} ${session.accessToken}`
    });
  }
}
