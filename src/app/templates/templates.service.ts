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
  user_id?: number;
  name: string;
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
}

export interface TemplateColumnRulePayload {
  id: number | string;
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
  data_type?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  deleted?: boolean;
  deleted_by?: number;
  deleted_at?: string;
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(private readonly http: HttpClient, private readonly store: Store) {}

  async createTemplate(payload: TemplateCreatePayload): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.post<TemplateResponse>(`${this.baseUrl}/templates/`, payload, { headers })
    );
  }

  async createTemplateColumns(
    templateId: number | string,
    payload: TemplateColumnPayload[]
  ): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.post<TemplateColumnResponse | TemplateColumnResponse[] | Record<string, unknown> | null>(
        `${this.baseUrl}/templates/${encodedId}/columns`,
        payload,
        { headers }
      )
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      if (this.isTemplateColumnResponse(data)) {
        return [data];
      }

      const asColumn = this.toColumnResponse(data as Record<string, unknown>);
      return asColumn ? [asColumn] : [];
    }

    return [];
  }

  async fetchTemplates(): Promise<TemplateResponse[]> {
    const headers = await this.buildAuthHeaders();
    const data = await firstValueFrom(
      this.http.get<TemplateResponse[] | Record<string, unknown>>(`${this.baseUrl}/templates/`, { headers })
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      const collectionKeys = ['items', 'templates', 'data'];
      for (const key of collectionKeys) {
        const value = data[key as keyof typeof data];
        if (Array.isArray(value)) {
          return value as TemplateResponse[];
        }
      }
    }

    return [];
  }

  async fetchTemplateColumns(templateId: number | string): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.get<TemplateColumnResponse[] | Record<string, unknown>>(
        `${this.baseUrl}/templates/${encodedId}/columns`,
        { headers }
      )
    );

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      const collectionKeys = ['items', 'columns', 'data'];
      for (const key of collectionKeys) {
        const value = data[key as keyof typeof data];
        if (Array.isArray(value)) {
          return value as TemplateColumnResponse[];
        }
      }

      const asColumn = this.toColumnResponse(data);
      return asColumn ? [asColumn] : [];
    }

    return [];
  }

  private toColumnResponse(entry: Record<string, unknown>): TemplateColumnResponse | null {
    const id = entry['id'];
    const name = entry['name'];

    if (typeof id !== 'number' || typeof name !== 'string') {
      return null;
    }

    const description = typeof entry['description'] === 'string' ? entry['description'] : undefined;
    const templateId = typeof entry['template_id'] === 'number' ? entry['template_id'] : 0;
    const rules = Array.isArray(entry['rules']) ? (entry['rules'] as TemplateColumnRulePayload[]) : [];

    return {
      id,
      name,
      description,
      template_id: templateId,
      rules,
      data_type: typeof entry['data_type'] === 'string' ? entry['data_type'] : undefined,
      created_at: typeof entry['created_at'] === 'string' ? entry['created_at'] : undefined,
      updated_at: typeof entry['updated_at'] === 'string' ? entry['updated_at'] : undefined,
      is_active: typeof entry['is_active'] === 'boolean' ? entry['is_active'] : undefined,
      deleted: typeof entry['deleted'] === 'boolean' ? entry['deleted'] : undefined,
      deleted_by: typeof entry['deleted_by'] === 'number' ? entry['deleted_by'] : undefined,
      deleted_at: typeof entry['deleted_at'] === 'string' ? entry['deleted_at'] : undefined
    };
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

  private isTemplateColumnResponse(entry: unknown): entry is TemplateColumnResponse {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<TemplateColumnResponse>;
    return typeof candidate.id === 'number' && typeof candidate.name === 'string';
  }
}
