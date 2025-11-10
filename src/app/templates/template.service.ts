import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { selectSessionState } from '../core/store/session/session.reducer';

export interface TemplateColumnResponse {
  id?: number | string;
  name?: string;
  data_type?: string;
  description?: string;
  rule_id?: number | string | null;
  header?: string[];
  is_active?: boolean;
  [key: string]: unknown;
}

export interface TemplateWithColumns {
  id: number | string;
  user_id?: number;
  name?: string;
  status?: string;
  description?: string;
  table_name?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  deleted?: boolean;
  deleted_by?: number;
  deleted_at?: string;
  columns?: TemplateColumnResponse[];
  [key: string]: unknown;
}

export interface TemplateCreatePayload {
  name: string;
  table_name: string;
  description?: string;
}

export interface TemplateColumnPayload {
  name: string;
  rule_id?: number | string | null;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient, private readonly store: Store) {}

  async fetchTemplates(): Promise<TemplateWithColumns[]> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.get<TemplateWithColumns[]>(`${this.baseUrl}/templates/`, { headers })
    );
  }

  async createTemplate(payload: TemplateCreatePayload): Promise<TemplateWithColumns> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.post<TemplateWithColumns>(`${this.baseUrl}/templates/`, payload, { headers })
    );
  }

  async createColumns(
    templateId: number | string,
    columns: TemplateColumnPayload[]
  ): Promise<unknown> {
    const headers = await this.buildAuthHeaders();
    const body = { columns };
    const encodedId = encodeURIComponent(String(templateId));
    return await firstValueFrom(
      this.http.post<unknown>(`${this.baseUrl}/templates/${encodedId}/columns`, body, { headers })
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
      Authorization: `${tokenType} ${session.accessToken}`
    });
  }
}
