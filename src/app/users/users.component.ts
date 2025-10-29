import { Component, OnInit } from '@angular/core';
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
import { CreatedUserResponse, UserCreatedByMeResponse, UserRole } from '../core/models/user.model';

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
export class UsersComponent implements OnInit {
  protected searchTerm = '';

  protected readonly roles: UserRoleOption[] = [
    { id: 1, label: 'Administrador' },
    { id: 2, label: 'Cliente' },
  ];

  protected users: UserRow[] = [];

  constructor(
    private readonly dialog: MatDialog,
    private readonly userService: UserService,
  ) {}

  public ngOnInit(): void {
    this.loadUsers();
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
            this.loadUsers();
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
    const normalizedRole = role.trim().toLowerCase();

    switch (normalizedRole) {
      case 'administrador':
      case 'admin':
        return 'badge--admin';
      case 'analista':
      case 'analyst':
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

  private loadUsers(): void {
    this.userService.getUsersCreatedByMe().subscribe({
      next: (users: UserCreatedByMeResponse[]) => {
        this.users = users.map((user) => this.mapToUserRow(user));
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
  }

  private mapToUserRow(user: UserCreatedByMeResponse): UserRow {
    const roleId = user.role?.id ?? 0;

    return this.createUserRow(
      user.name,
      user.email,
      roleId,
      this.getStatusLabel(user.is_active),
      this.formatDate(user.created_at),
      this.getRoleDisplayName(user.role),
    );
  }

  private createUserRow(
    name: string,
    email: string,
    roleId: number,
    status: string,
    createdAt: string,
    roleLabel?: string,
  ): UserRow {
    return {
      name,
      email,
      roleId,
      role: roleLabel ?? this.getRoleLabel(roleId),
      status,
      createdAt,
    };
  }

  private getRoleLabel(roleId: number | null): string {
    if (roleId === null || roleId <= 0) {
      return 'Sin rol';
    }

    return this.roles.find((role) => role.id === roleId)?.label ?? 'Sin rol';
  }

  private getRoleDisplayName(role?: UserRole | null): string {
    if (!role) {
      return this.getRoleLabel(null);
    }

    return role.alias?.trim() || role.name?.trim() || this.getRoleLabel(role.id ?? null);
  }

  private getStatusLabel(isActive: boolean): string {
    return isActive ? 'Activo' : 'Inactivo';
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('es-ES').format(date);
  }
}
