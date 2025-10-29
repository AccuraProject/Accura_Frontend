import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import {
  UserFormDialogComponent,
  UserFormDialogData,
  UserFormDialogValue,
  UserRoleOption,
} from './user-form-dialog.component';
import {
  UserDeleteDialogComponent,
  UserDeleteDialogData,
} from './user-delete-dialog.component';

import { UserService } from '../core/services/user.service';
import { CreatedUserResponse } from '../core/models/user.model';

interface UserRow {
  name: string;
  email: string;
  roleId: number;
  role: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatMenuModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  protected searchTerm = '';

  protected readonly roles: UserRoleOption[] = [
    { id: 1, label: 'Administrador' },
    { id: 2, label: 'Cliente' },
  ];

  protected users: UserRow[] = [];

  constructor(
    private readonly dialog: MatDialog,
    private readonly userService: UserService,
  ) {
    this.users = [
      this.createUserRow('Juan Pérez', 'juan@example.com', 1, 'Activo', '2025-01-12'),
      this.createUserRow('María García', 'maria@example.com', 2, 'Activo', '2025-01-08'),
      this.createUserRow('Carlos López', 'carlos@example.com', 2, 'Inactivo', '2024-12-28'),
    ];
  }

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

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      UserFormDialogComponent,
      UserFormDialogData,
      UserFormDialogValue
    >(
      UserFormDialogComponent,
      {
        disableClose: true,
        data: {
          roles: this.roles,
          mode: 'create',
        },
      },
    );

    dialogRef.afterClosed().subscribe((result: UserFormDialogValue | undefined) => {
      if (!result) {
        return;
      }

      this.userService
        .createUser({
          name: result.name,
          email: result.email,
          role_id: result.roleId,
        })
        .subscribe({
          next: (createdUser: CreatedUserResponse) => {
            this.addUserEntry(createdUser);
            console.info(
              'Usuario creado correctamente. Contraseña temporal:',
              createdUser.temporary_password,
            );
          },
          error: (error: unknown) => {
            const message = this.userService.getErrorMessage(error);
            if (typeof window !== 'undefined') {
              window.alert(message);
            } else {
              console.error(message);
            }
          },
        });
    });
  }

  protected openEditDialog(user: UserRow): void {
    const dialogRef = this.dialog.open<
      UserFormDialogComponent,
      UserFormDialogData,
      UserFormDialogValue
    >(
      UserFormDialogComponent,
      {
        disableClose: true,
        data: {
          roles: this.roles,
          mode: 'edit',
          user: {
            name: user.name,
            email: user.email,
            roleId: user.roleId,
          },
        },
      },
    );

    dialogRef.afterClosed().subscribe((result: UserFormDialogValue | undefined) => {
      if (!result) {
        return;
      }

      this.updateUserEntry(user.email, result);
    });
  }

  protected openDeleteDialog(user: UserRow): void {
    const dialogRef = this.dialog.open<
      UserDeleteDialogComponent,
      UserDeleteDialogData,
      boolean
    >(
      UserDeleteDialogComponent,
      {
        disableClose: true,
        data: {
          name: user.name,
          email: user.email,
        },
      },
    );

    dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
      if (!shouldDelete) {
        return;
      }

      this.removeUserEntry(user.email);
    });
  }

  private addUserEntry(createdUser: CreatedUserResponse): void {
    const entry = this.createUserRow(
      createdUser.name,
      createdUser.email,
      createdUser.role_id,
      createdUser.is_active ? 'Activo' : 'Inactivo',
      new Date().toISOString().slice(0, 10),
    );

    this.users = [entry, ...this.users];
  }

  private updateUserEntry(email: string, formData: UserFormDialogValue): void {
    this.users = this.users.map((user) => {
      if (user.email !== email) {
        return user;
      }

      const roleId = formData.roleId;

      return {
        ...user,
        name: formData.name,
        roleId,
        role: this.getRoleLabel(roleId),
      };
    });
  }

  private removeUserEntry(email: string): void {
    this.users = this.users.filter((user) => user.email !== email);
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

  private createUserRow(
    name: string,
    email: string,
    roleId: number,
    status: string,
    createdAt: string,
  ): UserRow {
    return {
      name,
      email,
      roleId,
      role: this.getRoleLabel(roleId),
      status,
      createdAt,
    };
  }

  private getRoleLabel(roleId: number): string {
    return this.roles.find((role) => role.id === roleId)?.label ?? 'Cliente';
  }
}
