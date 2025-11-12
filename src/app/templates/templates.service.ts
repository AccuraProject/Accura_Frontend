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

  async updateTemplate(
    templateId: number | string,
    payload: TemplateCreatePayload
  ): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.put<TemplateResponse | Record<string, unknown> | null>(
        `${this.baseUrl}/templates/${encodedId}`,
        payload,
        { headers }
      )
    );

    if (data) {
      const parsed = this.parseTemplateResponse(data);
      if (parsed) {
        return parsed;
      }
    }

    const refreshed = await this.fetchTemplate(templateId);
    if (refreshed) {
      return refreshed;
    }

    return this.buildTemplateFallback(templateId, payload);
  }

  async fetchTemplate(templateId: number | string): Promise<TemplateResponse | null> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.get<TemplateResponse | Record<string, unknown> | null>(
        `${this.baseUrl}/templates/${encodedId}`,
        { headers }
      )
    );

    if (!data) {
      return null;
    }

    return this.parseTemplateResponse(data);
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

  async updateTemplateStatus(
    templateId: number | string,
    status: 'published' | 'unpublished'
  ): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));

    return await firstValueFrom(
      this.http.patch<TemplateResponse>(
        `${this.baseUrl}/templates/${encodedId}/status`,
        { status },
        { headers }
      )
    );
  }

  async deleteTemplate(templateId: number | string): Promise<void> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));

    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/templates/${encodedId}`, { headers })
    );
  }

  private parseTemplateResponse(data: unknown): TemplateResponse | null {
    if (!data) {
      return null;
    }

    if (Array.isArray(data)) {
      for (const entry of data) {
        const parsed = this.parseTemplateResponse(entry);
        if (parsed) {
          return parsed;
        }
      }

      return null;
    }

    if (typeof data !== 'object') {
      return null;
    }

    const record = data as Record<string, unknown>;
    const idValue = record['id'];

    if (typeof idValue === 'number') {
      return (record as unknown) as TemplateResponse;
    }

    if (typeof idValue === 'string') {
      const numericId = Number(idValue);
      if (!Number.isNaN(numericId)) {
        return { ...((record as unknown) as TemplateResponse), id: numericId };
      }
    }

    const candidateKeys = ['template', 'data', 'item', 'result'];
    for (const key of candidateKeys) {
      const candidate = record[key];
      if (candidate && candidate !== data) {
        const parsed = this.parseTemplateResponse(candidate);
        if (parsed) {
          return parsed;
        }
      }
    }

    return null;
  }

  private buildTemplateFallback(
    templateId: number | string,
    payload: TemplateCreatePayload
  ): TemplateResponse {
    const numericId = typeof templateId === 'number' ? templateId : Number(templateId);

    if (Number.isNaN(numericId)) {
      throw new Error('No fue posible determinar el identificador de la plantilla.');
    }

    return {
      id: numericId,
      name: payload.name,
      description: payload.description,
      table_name: payload.table_name,
    };
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
