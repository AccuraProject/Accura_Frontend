import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface TemplateColumnDetail {
  name: string;
  type: string;
  required: boolean;
  rule: string;
  example?: string;
}

export interface TemplateDetailDialogData {
  name: string;
  description: string;
  version: string;
  status: string;
  lastUpdated: string | Date;
  createdAt?: string | Date;
  columnsCount?: number;
  owner?: string;
  tags?: string[];
  statusClass?: string;
  columnsDetail: TemplateColumnDetail[];
}

@Component({
  selector: 'app-template-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './template-detail-dialog.component.html',
  styleUrl: './template-detail-dialog.component.scss'
})
export class TemplateDetailDialogComponent {
  protected readonly statusClassMap: Record<string, string> = {
    Publicado: 'badge--active',
    Activo: 'badge--active',
    'En Revisión': 'badge--review',
    Borrador: 'badge--draft',
    Inactivo: 'badge--inactive'
  };

  constructor(@Inject(MAT_DIALOG_DATA) protected readonly data: TemplateDetailDialogData) {}

  protected get statusBadgeClass(): string {
    if (this.data.statusClass) {
      return this.data.statusClass;
    }

    return this.statusClassMap[this.data.status] ?? 'badge--inactive';
  }

  protected get totalColumns(): number {
    if (typeof this.data.columnsCount === 'number') {
      return this.data.columnsCount;
    }

    return this.data.columnsDetail.length;
  }
}
