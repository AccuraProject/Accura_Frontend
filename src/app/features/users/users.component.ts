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
} from './components/user-form-dialog/user-form-dialog.component';
import { UserDeleteDialogComponent, UserDeleteDialogData } from './user-delete-dialog.component';

import { UserService } from '../../core/services/user.service';
import {
  CreatedUserResponse,
  UpdateUserPayload,
  UserResponse,
  UserRole,
} from '../../core/models/user.model';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { CardModule } from 'primeng/card';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table';
import { ToastService } from '../../shared/services/toast.service';

interface UserRow {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  role: string;
  status: string;
  isActive: boolean;
  createdAt: string;
}

interface UsersAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatMenuModule,
    PageActionsComponent,
    DataTableComponent,
    CardModule,
    UserFormDialogComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  protected searchTerm = '';

  protected formAlert: UsersAlert | null = null;

  protected readonly roles: UserRoleOption[] = [
    // { id: 1, label: 'Administrador' },
    { id: 2, label: 'Cliente' },
  ];

  protected users: UserRow[] = [];
  protected selectedUser: UserRow | null = null;
  protected usersLoading = false;
  protected usersError: string | null = null;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  columns = [
    { field: 'name', header: 'Nombre' },
    { field: 'email', header: 'Email' },
    { field: 'role', header: 'Rol' },
    { field: 'status', header: 'Estado' },
    { field: 'createdAt', header: 'Fecha de Creación' },
  ];

  protected userDialogVisible = false;

  userDialogData: UserFormDialogData = {
    roles: [],
    mode: 'create',
  };

  protected isEditing = false;

  constructor(
    private readonly dialog: MatDialog,
    private readonly userService: UserService,
    private readonly toast: ToastService,
  ) {}

  public ngOnInit(): void {
    this.loadUsers();
  }

  onCreateUser(): void {
    this.isEditing = false;
    this.openCreateDialog();
  }

  onEditUser(): void {
    this.isEditing = true;
    if (!this.selectedUser) return;

    const user = this.selectedUser;

    console.log('Editar usuario', user);
    this.openEditDialog(user);
  }

  onDeleteUsers(): void {
    if (!this.selectedUser) return;

    console.log('Eliminar usuarios', this.selectedUser);
  }

  onRowSelect(user: UserRow) {
    this.selectedUser = user;
    console.log('Usuario seleccionado', user);
  }

  onRowUnselect() {
    this.selectedUser = null;
    console.log('Deseleccionado');
  }

  handleSaveUser(user: UserFormDialogValue): void {
    if (!this.isEditing) {
      this.userService
        .createUser({
          name: user.name,
          email: user.email,
          role_id: user.roleId,
        })
        .subscribe({
          next: () => {
            this.loadUsers();
            this.toast.success('Usuario creado exitosamente');
          },
          error: (error: unknown) => {
            const message = this.userService.getErrorMessage(error);
            this.toast.error(message);
          },
        });
    } else {
      if (this.selectedUser) {
        const payload: UpdateUserPayload = {
          name: user.name,
          role_id: user.roleId,
          email: user.email,
          is_active: user.status,
        };

        this.userService.updateUser(this.selectedUser.id, payload).subscribe({
          next: (updatedUser: UserResponse) => {
            const updatedRow = this.mapToUserRow(updatedUser);
            this.users = this.users.map((current) =>
              current.id === updatedRow.id ? updatedRow : current,
            );

            this.toast.success('Usuario actualizado exitosamente');
          },
          error: (error: unknown) => {
            const message = this.userService.getErrorMessage(error);
            this.toast.error(message);
          },
        });
      }
    }
  }

  handleCancelUserDialog(): void {
    console.log('cancelado');
  }

  protected onSearchChange(): void {
    this.currentPage = 1;
  }

  protected openCreateDialog(): void {
    this.userDialogVisible = true;
    this.userDialogData = {
      roles: this.roles,
      mode: 'create',
    };
  }

  protected openEditDialog(user: UserRow): void {
    this.userDialogVisible = true;
    this.userDialogData = {
      roles: this.roles,
      mode: 'edit',
      user: {
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        status: user.isActive,
      },
    };
  }

  protected openDeleteDialog(user: UserRow): void {
    const dialogRef = this.dialog.open<UserDeleteDialogComponent, UserDeleteDialogData, boolean>(
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

      this.formAlert = null;

      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.removeUserEntry(user.id);
          this.formAlert = {
            type: 'success',
            title: 'Usuario eliminado',
            message: 'El usuario se eliminó correctamente.',
          };
        },
        error: (error: unknown) => {
          this.formAlert = {
            type: 'error',
            title: 'No se pudo eliminar al usuario',
            message: this.userService.getErrorMessage(error),
          };
        },
      });
    });
  }

  protected closeAlert(): void {
    this.formAlert = null;
  }

  private removeUserEntry(userId: number): void {
    this.users = this.users.filter((user) => user.id !== userId);
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
      default:
        return 'badge--client';
    }
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Activo':
        return 'badge--active';
      default:
        return 'badge--inactive';
    }
  }

  private loadUsers(): void {
    if (this.usersLoading) {
      return;
    }

    this.usersLoading = true;
    this.usersError = null;

    this.userService.getUsers().subscribe({
      next: (users: UserResponse[]) => {
        this.users = users.map((user) => this.mapToUserRow(user));
        this.usersLoading = false;
      },
      error: (error: unknown) => {
        this.users = [];
        this.usersError = this.userService.getErrorMessage(error);
        this.usersLoading = false;
        console.error(this.usersError);
      },
    });
  }

  private mapToUserRow(user: UserResponse): UserRow {
    return this.createUserRow(
      user.id,
      user.name,
      user.email,
      user.role?.id ?? null,
      user.is_active,
      this.formatDate(user.created_at),
      this.getRoleDisplayName(user.role),
    );
  }

  private createUserRow(
    id: number,
    name: string,
    email: string,
    roleId: number | null,
    isActive: boolean,
    createdAt: string,
    roleLabel?: string,
  ): UserRow {
    return {
      id,
      name,
      email,
      roleId,
      role: roleLabel ?? this.getRoleLabel(roleId),
      status: this.getStatusLabel(isActive),
      isActive,
      createdAt,
    };
  }

  private getRoleLabel(roleId: number | null): string {
    if (roleId === null) {
      return 'Sin rol';
    }

    return this.roles.find((role) => role.id === roleId)?.label ?? 'Sin rol';
  }

  private getRoleDisplayName(role?: UserRole | null): string {
    if (!role) {
      return this.getRoleLabel(null);
    }

    return role.name?.trim() || role.alias?.trim() || this.getRoleLabel(role.id ?? null);
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
