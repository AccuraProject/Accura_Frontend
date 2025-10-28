import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  PermissionManageDialogComponent,
  PermissionManageDialogData,
  PermissionManageDialogResult
} from './permission-manage-dialog.component';

interface TemplateDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
}

interface PermissionUser {
  name: string;
  email: string;
  assignedTemplateIds: string[];
  lastUpdated: string;
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent {
  protected searchTerm = '';

  protected readonly templates: TemplateDefinition[] = [
    {
      id: 'sales',
      name: 'Plantilla de Ventas',
      code: 'VD',
      description: 'Plantilla para cargar datos de ventas mensuales o columnas.'
    },
    {
      id: 'claims',
      name: 'Plantilla de Siniestros',
      code: 'ST',
      description: 'Plantilla para gestión de siniestros o columnas.'
    },
    {
      id: 'onboarding',
      name: 'Plantilla de Ingreso',
      code: 'NG',
      description: 'Plantilla para registro de nuevos clientes y documentación.'
    },
    {
      id: 'collections',
      name: 'Plantilla de Cobranza',
      code: 'CB',
      description: 'Plantilla para control de cuentas por cobrar y seguimiento.'
    }
  ];

  protected users: PermissionUser[] = [
    {
      name: 'María García',
      email: 'maria@example.com',
      assignedTemplateIds: ['sales', 'claims'],
      lastUpdated: '2025-01-06'
    },
    {
      name: 'Carlos López',
      email: 'carlos@example.com',
      assignedTemplateIds: ['sales'],
      lastUpdated: '2025-01-04'
    },
    {
      name: 'Ana Martínez',
      email: 'ana@example.com',
      assignedTemplateIds: [],
      lastUpdated: '2025-01-02'
    },
    {
      name: 'Luis Hernández',
      email: 'luis@example.com',
      assignedTemplateIds: ['claims', 'collections'],
      lastUpdated: '2025-01-05'
    }
  ];

  constructor(private readonly dialog: MatDialog) {}

  protected get filteredUsers(): PermissionUser[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    });
  }

  protected trackByEmail(_: number, user: PermissionUser): string {
    return user.email;
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected getAssignedTemplates(user: PermissionUser): TemplateDefinition[] {
    return this.templates.filter((template) =>
      user.assignedTemplateIds.includes(template.id)
    );
  }

  protected getVisibleTemplates(templates: TemplateDefinition[]): TemplateDefinition[] {
    return templates.slice(0, 2);
  }

  protected getRemainingCount(templates: TemplateDefinition[]): number {
    return templates.length > 2 ? templates.length - 2 : 0;
  }

  protected trackByTemplateId(_: number, template: TemplateDefinition): string {
    return template.id;
  }

  protected openManageDialog(user: PermissionUser): void {
    const dialogRef = this.dialog.open<
      PermissionManageDialogComponent,
      PermissionManageDialogData,
      PermissionManageDialogResult
    >(PermissionManageDialogComponent, {
      disableClose: true,
      data: {
        user: {
          name: user.name,
          email: user.email
        },
        templates: this.templates,
        assignedTemplateIds: user.assignedTemplateIds
      }
    });

    dialogRef.afterClosed().subscribe((result: PermissionManageDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.updateUserPermissions(user.email, result.assignedTemplateIds);
    });
  }

  private updateUserPermissions(email: string, assignedTemplateIds: string[]): void {
    const today = new Date().toISOString().slice(0, 10);
    this.users = this.users.map((user) => {
      if (user.email !== email) {
        return user;
      }

      return {
        ...user,
        assignedTemplateIds: [...assignedTemplateIds],
        lastUpdated: today
      };
    });
  }
}
