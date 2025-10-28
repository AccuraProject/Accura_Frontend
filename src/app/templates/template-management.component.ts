import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

import {
  TemplateFormDialogComponent,
  TemplateFormDialogData,
  TemplateFormDialogResult
} from './template-form-dialog.component';
import { TemplateDetailDialogComponent, TemplateDetailDialogData } from './template-detail-dialog.component';
import { TemplateDeleteDialogComponent, TemplateDeleteDialogData } from './template-delete-dialog.component';

type TemplateStatus = 'Publicado' | 'Borrador' | 'Inactivo';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  version: string;
  status: TemplateStatus;
  createdAt: string;
  lastUpdated: string;
  columns: number;
}

@Component({
  selector: 'app-template-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatMenuModule],
  templateUrl: './template-management.component.html',
  styleUrl: './template-management.component.scss'
})
export class TemplateManagementComponent {
  protected searchTerm = '';
  protected statusFilter: TemplateStatus | 'Todos' = 'Todos';

  protected readonly statusOptions: (TemplateStatus | 'Todos')[] = ['Todos', 'Publicado', 'Borrador', 'Inactivo'];

  protected templates: TemplateRow[] = [
    {
      id: 'policy-template',
      name: 'Plantilla de Pólizas',
      description: 'Plantilla para cargar datos de pólizas emitidas mensualmente.',
      version: 'v1.0',
      status: 'Publicado',
      createdAt: '2024-11-12',
      lastUpdated: '2025-02-14',
      columns: 14
    },
    {
      id: 'claims-template',
      name: 'Plantilla de Siniestros',
      description: 'Plantilla para registrar siniestros reportados por los asegurados.',
      version: 'v2.1',
      status: 'Borrador',
      createdAt: '2024-10-03',
      lastUpdated: '2025-01-28',
      columns: 11
    },
    {
      id: 'brokers-template',
      name: 'Plantilla de Brokers',
      description: 'Estructura para actualizar información de brokers y agentes externos.',
      version: 'v1.3',
      status: 'Inactivo',
      createdAt: '2024-07-22',
      lastUpdated: '2024-12-18',
      columns: 9
    }
  ];

  constructor(private readonly dialog: MatDialog) {}

  protected get filteredTemplates(): TemplateRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    const statusFilter = this.statusFilter;

    return this.templates.filter((template) => {
      const matchesTerm =
        !term ||
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term) ||
        template.version.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'Todos' || template.status === statusFilter;

      return matchesTerm && matchesStatus;
    });
  }

  protected get totalTemplates(): number {
    return this.templates.length;
  }

  protected get publishedTemplates(): number {
    return this.templates.filter((template) => template.status === 'Publicado').length;
  }

  protected get draftTemplates(): number {
    return this.templates.filter((template) => template.status === 'Borrador').length;
  }

  protected get inactiveTemplates(): number {
    return this.templates.filter((template) => template.status === 'Inactivo').length;
  }

  protected trackByTemplateId(_: number, template: TemplateRow): string {
    return template.id;
  }

  protected statusClass(status: TemplateStatus): string {
    switch (status) {
      case 'Publicado':
        return 'badge--active';
      case 'Borrador':
        return 'badge--draft';
      default:
        return 'badge--inactive';
    }
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      TemplateFormDialogComponent,
      TemplateFormDialogData,
      TemplateFormDialogResult
    >(TemplateFormDialogComponent, {
      disableClose: true,
      data: {
        mode: 'create'
      }
    });

    dialogRef.afterClosed().subscribe((result: TemplateFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addTemplate(result);
    });
  }

  protected openEditDialog(template: TemplateRow): void {
    const dialogRef = this.dialog.open<
      TemplateFormDialogComponent,
      TemplateFormDialogData,
      TemplateFormDialogResult
    >(TemplateFormDialogComponent, {
      disableClose: true,
      data: {
        mode: 'edit',
        template: {
          name: template.name,
          description: template.description
        }
      }
    });

    dialogRef.afterClosed().subscribe((result: TemplateFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.updateTemplate(template.id, result);
    });
  }

  protected openDetailDialog(template: TemplateRow): void {
    this.dialog.open<TemplateDetailDialogComponent, TemplateDetailDialogData, void>(
      TemplateDetailDialogComponent,
      {
        data: {
          name: template.name,
          description: template.description,
          version: template.version,
          status: template.status,
          createdAt: template.createdAt,
          lastUpdated: template.lastUpdated,
          columns: template.columns
        }
      }
    );
  }

  protected openDeleteDialog(template: TemplateRow): void {
    const dialogRef = this.dialog.open<TemplateDeleteDialogComponent, TemplateDeleteDialogData, boolean>(
      TemplateDeleteDialogComponent,
      {
        disableClose: true,
        data: {
          name: template.name
        }
      }
    );

    dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
      if (!shouldDelete) {
        return;
      }

      this.removeTemplate(template.id);
    });
  }

  private addTemplate(result: TemplateFormDialogResult): void {
    const entry: TemplateRow = {
      id: this.generateId(),
      name: result.name,
      description: result.description,
      version: 'v1.0',
      status: 'Borrador',
      createdAt: new Date().toISOString().slice(0, 10),
      lastUpdated: new Date().toISOString().slice(0, 10),
      columns: 0
    };

    this.templates = [entry, ...this.templates];
  }

  private updateTemplate(templateId: string, result: TemplateFormDialogResult): void {
    this.templates = this.templates.map((template) => {
      if (template.id !== templateId) {
        return template;
      }

      return {
        ...template,
        name: result.name,
        description: result.description,
        lastUpdated: new Date().toISOString().slice(0, 10)
      };
    });
  }

  private removeTemplate(templateId: string): void {
    this.templates = this.templates.filter((template) => template.id !== templateId);
  }

  private generateId(): string {
    return `template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
