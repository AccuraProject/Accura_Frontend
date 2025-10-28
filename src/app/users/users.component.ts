import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';

import { CreateUserDialogComponent, CreateUserDialogResult } from './create-user-dialog.component';

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
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatDialogModule,
    MatCardModule,
    CreateUserDialogComponent
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  protected searchTerm = '';

  protected readonly roles = ['Administrador', 'Cliente', 'Analista'];
  protected readonly statuses = ['Activo', 'Inactivo', 'Suspendido'];

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
    },
    {
      name: 'Ana Martínez',
      email: 'ana@example.com',
      role: 'Analista',
      status: 'Activo',
      createdAt: '2024-12-18'
    }
  ];

  protected readonly displayedColumns: (keyof UserRow | 'actions')[] = [
    'name',
    'role',
    'status',
    'createdAt',
    'actions'
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

  protected openModal(): void {
    const dialogRef = this.dialog.open(CreateUserDialogComponent, {
      panelClass: 'create-user-dialog',
      backdropClass: 'create-user-dialog-backdrop',
      data: {
        roles: this.roles,
        statuses: this.statuses
      }
    });

    dialogRef.afterClosed().subscribe((result?: CreateUserDialogResult) => {
      if (!result) {
        return;
      }

      const entry: UserRow = {
        name: result.name.trim(),
        email: result.email.trim(),
        role: result.role,
        status: result.status,
        createdAt: new Date().toISOString().slice(0, 10)
      };

      this.users = [entry, ...this.users];
    });
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
