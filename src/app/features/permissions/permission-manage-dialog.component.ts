import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import {
  TemplateResponse,
  TemplatesService,
  TemplateAccessGrantPayload,
  TemplateAccessRevokePayload
} from '../templates/templates.service';

interface PermissionDialogUser {
  id: number;
  name: string;
  email: string;
}

export interface PermissionManageDialogData {
  user: PermissionDialogUser;
}

export interface PermissionManageDialogResult {
  refresh?: boolean;
}

interface TemplateDateRange {
  startDate: string;
  endDate: string;
}

@Component({
  selector: 'app-permission-manage-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './permission-manage-dialog.component.html',
  styleUrl: './permission-manage-dialog.component.scss'
})
export class PermissionManageDialogComponent implements OnInit {
  protected isLoading = false;
  protected assignedTemplates: TemplateResponse[] = [];
  protected availableTemplates: TemplateResponse[] = [];
  protected errorMessage: string | null = null;
  protected successMessage: string | null = null;

  private readonly dateRanges = new Map<number, TemplateDateRange>();
  private readonly pendingTemplateIds = new Set<number>();
  private hasUpdates = false;

  constructor(
    private readonly dialogRef: MatDialogRef<
      PermissionManageDialogComponent,
      PermissionManageDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) public readonly data: PermissionManageDialogData,
    private readonly templatesService: TemplatesService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTemplates();
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected trackByTemplateId(_: number, template: TemplateResponse): number {
    return template.id;
  }

  protected get templateHint(): string {
    return 'Solo se pueden asignar plantillas en estado publicado.';
  }

  protected getStatusLabel(template: TemplateResponse): string {
    if (!template.status) {
      return 'Desconocido';
    }

    const normalized = template.status.toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  protected getTableName(template: TemplateResponse): string {
    return template.table_name ?? 'Sin tabla asociada';
  }

  protected getDateRange(templateId: number): TemplateDateRange {
    return this.dateRanges.get(templateId) ?? { startDate: '', endDate: '' };
  }

  protected setDateRange(templateId: number, field: keyof TemplateDateRange, value: string): void {
    const current = this.getDateRange(templateId);
    const trimmed = value?.trim() ?? '';
    const next: TemplateDateRange = {
      ...current,
      [field]: trimmed
    };

    this.dateRanges.set(templateId, next);
  }

  protected canAssign(templateId: number): boolean {
    const range = this.getDateRange(templateId);
    if (!range.startDate || !range.endDate) {
      return false;
    }

    return range.startDate <= range.endDate;
  }

  protected isPending(templateId: number): boolean {
    return this.pendingTemplateIds.has(templateId);
  }

  protected async assignTemplate(template: TemplateResponse): Promise<void> {
    const templateId = template.id;
    const range = this.getDateRange(templateId);

    this.successMessage = null;

    if (!range.startDate || !range.endDate) {
      this.errorMessage = 'Debes seleccionar las fechas de inicio y fin para otorgar acceso.';
      return;
    }

    if (range.startDate > range.endDate) {
      this.errorMessage = 'La fecha de inicio no puede ser posterior a la fecha de fin.';
      return;
    }

    this.errorMessage = null;

    const payload: TemplateAccessGrantPayload[] = [
      {
        template_id: templateId,
        user_id: this.data.user.id,
        start_date: range.startDate,
        end_date: range.endDate
      }
    ];

    try {
      await this.withPending(templateId, async () => {
        await this.templatesService.grantTemplateAccess(payload);
        this.hasUpdates = true;
      });
    } catch {
      return;
    }

    this.dateRanges.delete(templateId);

    const successText = `Se otorgó acceso a "${template.name}".`;
    await this.loadTemplates();

    if (!this.errorMessage) {
      this.successMessage = successText;
    }
  }

  protected async revokeTemplate(template: TemplateResponse): Promise<void> {
    const templateId = template.id;
    this.successMessage = null;
    this.errorMessage = null;

    const payload: TemplateAccessRevokePayload[] = [
      {
        template_id: templateId,
        user_id: this.data.user.id
      }
    ];

    try {
      await this.withPending(templateId, async () => {
        await this.templatesService.revokeTemplateAccess(payload);
        this.hasUpdates = true;
      });
    } catch {
      return;
    }

    const successText = `Se revocó el acceso a "${template.name}".`;
    await this.loadTemplates();

    if (!this.errorMessage) {
      this.successMessage = successText;
    }
  }

  protected close(): void {
    if (this.hasUpdates) {
      this.dialogRef.close({ refresh: true });
      return;
    }

    this.dialogRef.close();
  }

  private async loadTemplates(): Promise<void> {
    const userId = this.data.user?.id;
    if (userId === undefined || userId === null) {
      this.errorMessage = 'No fue posible determinar el usuario seleccionado.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const [allTemplates, userTemplates] = await Promise.all([
        this.templatesService.fetchTemplates(),
        this.templatesService.fetchTemplatesForUser(userId)
      ]);

      const uniqueAssigned = new Map<number, TemplateResponse>();
      for (const template of userTemplates) {
        uniqueAssigned.set(template.id, template);
      }

      this.assignedTemplates = Array.from(uniqueAssigned.values());

      const assignedIds = new Set(this.assignedTemplates.map((template) => template.id));
      this.availableTemplates = allTemplates.filter((template) => {
        if (assignedIds.has(template.id)) {
          return false;
        }

        const status = template.status?.toLowerCase() ?? '';
        return status === 'published';
      });
    } catch (error) {
      this.handleError(error);
    } finally {
      this.isLoading = false;
    }
  }

  private async withPending(templateId: number, task: () => Promise<void>): Promise<void> {
    this.pendingTemplateIds.add(templateId);

    try {
      await task();
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.pendingTemplateIds.delete(templateId);
    }
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const detail =
        (typeof error.error === 'object' && error.error && 'detail' in error.error
          ? String((error.error as Record<string, unknown>)['detail'])
          : undefined) ?? error.message;
      this.errorMessage = detail;
      this.successMessage = null;
      return;
    }

    if (error instanceof Error) {
      this.errorMessage = error.message;
      this.successMessage = null;
      return;
    }

    this.errorMessage = 'Ocurrió un error inesperado al procesar la solicitud.';
    this.successMessage = null;
  }
}
