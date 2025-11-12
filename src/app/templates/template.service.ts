import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { selectSessionState } from '../core/store/session/session.reducer';

export interface TemplateCreatePayload {
  name: string;
  table_name: string;
  description?: string;
}

export interface TemplateResponse {
  id: number;
  user_id: number;
  name: string;
  status: string;
  description: string;
  table_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  deleted: boolean;
  deleted_by: number | null;
  deleted_at: string | null;
  columns: unknown[];
}

export interface TemplateColumnRulePayload {
  id: number;
  'header rule'?: string[];
}

export interface TemplateColumnPayload {
  name: string;
  description?: string;
  rules: TemplateColumnRulePayload[];
}

export interface TemplateColumnResponse extends TemplateColumnPayload {
  id: number;
  template_id: number;
  data_type: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  deleted: boolean;
  deleted_by: number | null;
  deleted_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient, private readonly store: Store) {}

  async createTemplate(payload: TemplateCreatePayload): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.post<TemplateResponse>(`${this.baseUrl}/templates/`, payload, { headers })
    );
  }

  async listTemplates(): Promise<TemplateResponse[]> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.get<TemplateResponse[]>(`${this.baseUrl}/templates/`, { headers })
    );
  }

  async createColumn(
    templateId: number,
    payload: TemplateColumnPayload
  ): Promise<TemplateColumnResponse> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.post<TemplateColumnResponse>(
        `${this.baseUrl}/templates/${encodeURIComponent(String(templateId))}/columns`,
        payload,
        { headers }
      )
    );
  }

  async listColumns(templateId: number): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.get<TemplateColumnResponse[]>(
        `${this.baseUrl}/templates/${encodeURIComponent(String(templateId))}/columns`,
        { headers }
      )
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
}
