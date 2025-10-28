import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  UserFormDialogComponent,
  UserFormDialogData,
  UserFormDialogResult
} from './user-form-dialog.component';

interface UserRow {
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  protected searchTerm = '';

  protected readonly roles = ['Administrador', 'Cliente'];
  protected readonly statuses = ['Activo', 'Inactivo'];

  protected users: UserRow[] = [
    {
      name: 'Juan Pérez',
      email: 'juan@example.com',
      role: 'Administrador',
      status: 'Activo',
      createdAt: '2025-01-12'
    },
    {
      name: 'María García',
      email: 'maria@example.com',
      role: 'Cliente',
      status: 'Activo',
      createdAt: '2025-01-08'
    },
    {
      name: 'Carlos López',
      email: 'carlos@example.com',
      role: 'Cliente',
      status: 'Inactivo',
      createdAt: '2024-12-28'
    }
  ];

  protected get filteredUsers(): UserRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
      );
    });
  }

  constructor(private readonly dialog: MatDialog) {}

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      UserFormDialogComponent,
      UserFormDialogData,
      UserFormDialogResult
    >(
      UserFormDialogComponent,
      {
        disableClose: true,
        data: {
          roles: this.roles,
          statuses: this.statuses
        }
      }
    );

    dialogRef.afterClosed().subscribe((result: UserFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addUserEntry(result);
    });
  }

  private addUserEntry(formData: UserFormDialogResult): void {
    const entry: UserRow = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      status: formData.status,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    this.users = [entry, ...this.users];
  }

  protected trackByEmail(_: number, user: UserRow): string {
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

  protected roleClass(role: string): string {
    switch (role) {
      case 'Administrador':
        return 'badge--admin';
      case 'Analista':
        return 'badge--analyst';
      default:
        return 'badge--client';
    }
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Activo':
        return 'badge--active';
      case 'Suspendido':
        return 'badge--suspended';
      default:
        return 'badge--inactive';
    }
  }
}
