import { HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom, from, throwError } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { selectSessionState } from '../../core/store/session/session.reducer';

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

export interface TemplateAccessGrantPayload {
  template_id: number;
  user_id: number;
  start_date: string;
  end_date: string;
}

export interface TemplateAccessRevokePayload {
  template_id: number;
  user_id: number;
}

export interface TemplateAccessResponse {
  id: number;
  template_id: number;
  user_id: number;
  start_date?: string;
  end_date?: string;
  revoked_at?: string;
  revoked_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateColumnRulePayload {
  id: number | string;
  'header rule'?: string[];
  rule?: unknown;
  payload?: unknown;
  data?: unknown;
  'Campo obligatorio'?: unknown;
  [key: string]: unknown;
}

export interface TemplateColumnPayload {
  name: string;
  description?: string;
  rules: TemplateColumnRulePayload[];
  is_active?: boolean;
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

export interface TemplateLoad {
  id: number;
  template_id: number;
  user_id: number;
  status: string;
  file_name: string;
  total_rows: number;
  error_rows: number;
  report_path: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TemplateLoadResponse {
  message: string;
  load: TemplateLoad;
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  constructor(
    private readonly http: HttpClient,
    private readonly store: Store,
  ) {}

  getTemplates(): Observable<TemplateResponse[]> {
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

        return this.http.get<TemplateResponse[]>(`${this.baseUrl}/templates`, {
          headers,
        });
      }),
    );
  }

  saveTemplate(
    template: TemplateCreatePayload,
  ): Observable<TemplateResponse> {
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

        const body = { ...template };

        return this.http.post<TemplateResponse>(`${this.baseUrl}/templates/`, body, {
          headers,
        });
      }),
    );
  }

  async createTemplate(payload: TemplateCreatePayload): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    return await firstValueFrom(
      this.http.post<TemplateResponse>(`${this.baseUrl}/templates/`, payload, { headers }),
    );
  }

  updateTemplate(
    templateId: number,
    template: TemplateCreatePayload,
  ): Observable<TemplateResponse> {
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

        const body = { template };

        return this.http.put<TemplateResponse>(`${this.baseUrl}/templates/${templateId}`, body, {
          headers,
        });
      }),
    );
  }

  async updateTemplate2(
    templateId: number | string,
    payload: TemplateCreatePayload,
  ): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.put<TemplateResponse | Record<string, unknown> | null>(
        `${this.baseUrl}/templates/${encodedId}`,
        payload,
        { headers },
      ),
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
        { headers },
      ),
    );

    if (!data) {
      return null;
    }

    return this.parseTemplateResponse(data);
  }

  async fetchTemplateDetail(templateId: number | string): Promise<TemplateResponse | null> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.get<TemplateResponse | Record<string, unknown> | null>(
        `${this.baseUrl}/templates/${encodedId}/detail`,
        { headers },
      ),
    );

    if (!data) {
      return null;
    }

    return this.parseTemplateResponse(data);
  }

  async downloadTemplateExcel(templateId: number | string): Promise<Blob> {
    const headers = await this.buildAuthHeaders();
    const sanitizedHeaders = headers.delete('Content-Type');
    const encodedId = encodeURIComponent(String(templateId));

    return await firstValueFrom<Blob>(
      this.http.get<Blob>(`${this.baseUrl}/templates/${encodedId}/excel`, {
        headers: sanitizedHeaders,
        responseType: 'blob' as 'json',
      }),
    );
  }

  uploadTemplateLoad(
    templateId: number | string,
    file: File,
  ): Observable<HttpEvent<TemplateLoadResponse>> {
    return from(this.buildAuthHeaders({ contentType: null })).pipe(
      switchMap((headers) => {
        const encodedId = encodeURIComponent(String(templateId));
        const formData = new FormData();
        formData.append('file', file, file.name);

        const safeHeaders = headers.delete('Content-Type');

        return this.http.post<TemplateLoadResponse>(
          `${this.baseUrl}/templates/${encodedId}/loads`,
          formData,
          {
            headers: safeHeaders,
            reportProgress: true,
            observe: 'events' as const,
          },
        );
      }),
    );
  }

  async createTemplateColumns(
    templateId: number | string,
    payload: TemplateColumnPayload[],
  ): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.post<
        TemplateColumnResponse | TemplateColumnResponse[] | Record<string, unknown> | null
      >(`${this.baseUrl}/templates/${encodedId}/columns`, payload, { headers }),
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

  async updateTemplateColumns(
    templateId: number | string,
    payload: TemplateColumnPayload[],
  ): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.put<
        TemplateColumnResponse | TemplateColumnResponse[] | Record<string, unknown> | null
      >(`${this.baseUrl}/templates/${encodedId}/columns`, payload, { headers }),
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
      this.http.get<TemplateResponse[] | Record<string, unknown>>(`${this.baseUrl}/templates/`, {
        headers,
      }),
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

  async fetchTemplatesForUser(userId: number | string): Promise<TemplateResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(userId));
    const data = await firstValueFrom(
      this.http.get<TemplateAccessResponse[] | Record<string, unknown>>(
        `${this.baseUrl}/templates/users/${encodedId}/access`,
        { headers },
      ),
    );

    const accessEntries = this.normalizeTemplateAccessCollection(data);
    if (!accessEntries.length) {
      return [];
    }

    const templateIds = Array.from(
      new Set(
        accessEntries
          .map((entry) => entry.template_id)
          .filter((templateId) => typeof templateId === 'number' && !Number.isNaN(templateId)),
      ),
    );

    const session = await firstValueFrom(this.store.select(selectSessionState));
    const isAdmin = session?.role === 'admin';

    const templates = await Promise.all(
      templateIds.map(async (templateId) => {
        try {
          if (isAdmin) {
            return await this.fetchTemplate(templateId);
          }

          return await this.fetchTemplateDetail(templateId);
        } catch (error) {
          console.error(
            `[TemplatesService] Error al obtener la plantilla ${templateId} para el usuario ${userId}.`,
            error,
          );
          return null;
        }
      }),
    );

    return templates.filter((template): template is TemplateResponse => template !== null);
  }

  private normalizeTemplateAccessCollection(
    data: TemplateAccessResponse[] | Record<string, unknown> | null | undefined,
  ): TemplateAccessResponse[] {
    if (!data) {
      return [];
    }

    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data !== 'object') {
      return [];
    }

    const record = data as Record<string, unknown>;
    const collectionKeys = ['items', 'access', 'data', 'results'];
    for (const key of collectionKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        return value as TemplateAccessResponse[];
      }
    }

    return [];
  }

  async grantTemplateAccess(payload: TemplateAccessGrantPayload[]): Promise<void> {
    if (!payload.length) {
      return;
    }

    const headers = await this.buildAuthHeaders();
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/templates/access`, payload, { headers }),
    );
  }

  async revokeTemplateAccess(payload: TemplateAccessRevokePayload[]): Promise<void> {
    if (!payload.length) {
      return;
    }

    const headers = await this.buildAuthHeaders();
    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/templates/access/revoke`, payload, { headers }),
    );
  }

  async fetchTemplateColumns(templateId: number | string): Promise<TemplateColumnResponse[]> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));
    const data = await firstValueFrom(
      this.http.get<TemplateColumnResponse[] | Record<string, unknown>>(
        `${this.baseUrl}/templates/${encodedId}/columns`,
        { headers },
      ),
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
    status: 'published' | 'unpublished',
  ): Promise<TemplateResponse> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));

    return await firstValueFrom(
      this.http.patch<TemplateResponse>(
        `${this.baseUrl}/templates/${encodedId}/status`,
        { status },
        { headers },
      ),
    );
  }

  async deleteTemplate(templateId: number | string): Promise<void> {
    const headers = await this.buildAuthHeaders();
    const encodedId = encodeURIComponent(String(templateId));

    await firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/templates/${encodedId}`, { headers }),
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
      return record as unknown as TemplateResponse;
    }

    if (typeof idValue === 'string') {
      const numericId = Number(idValue);
      if (!Number.isNaN(numericId)) {
        return { ...(record as unknown as TemplateResponse), id: numericId };
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
    payload: TemplateCreatePayload,
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
    const rules = Array.isArray(entry['rules'])
      ? (entry['rules'] as TemplateColumnRulePayload[])
      : [];

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
      deleted_at: typeof entry['deleted_at'] === 'string' ? entry['deleted_at'] : undefined,
    };
  }

  private async buildAuthHeaders(options?: { contentType?: string | null }): Promise<HttpHeaders> {
    const session = await firstValueFrom(this.store.select(selectSessionState));

    if (!session?.accessToken) {
      throw new Error('No hay un token de autenticación disponible.');
    }

    const tokenType = session.tokenType ?? 'Bearer';
    const headers: Record<string, string> = {
      Authorization: `${tokenType} ${session.accessToken}`,
    };
    const contentType = options?.contentType ?? 'application/json';

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    return new HttpHeaders(headers);
  }

  private isTemplateColumnResponse(entry: unknown): entry is TemplateColumnResponse {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<TemplateColumnResponse>;
    return typeof candidate.id === 'number' && typeof candidate.name === 'string';
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
