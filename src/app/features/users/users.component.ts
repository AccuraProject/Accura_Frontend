import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UserFormDialogComponent,
  UserFormDialogData,
  UserFormDialogValue,
  UserRoleOption,
} from './components/user-form-dialog/user-form-dialog.component';

import { UserService } from '../../core/services/user.service';
import { UpdateUserPayload, UserResponse, UserRole } from '../../core/models/user.model';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { CardModule } from 'primeng/card';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../shared/components/data/data-table/data-table';
import { ToastService } from '../../shared/services/toast.service';
import { ConfirmService } from '../../shared/services/confirm.service';
import { finalize } from 'rxjs';
import { formatDateOnly } from '../../shared/utils/date-util';

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

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageActionsComponent,
    DataTableComponent,
    CardModule,
    UserFormDialogComponent,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  protected searchTerm = '';

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

  columns: DataTableColumn[] = [
    { field: 'name', header: 'Nombre' },
    { field: 'email', header: 'Email' },
    { field: 'role', header: 'Rol', align: 'center' },
    {
      field: 'status',
      header: 'Estado',
      align: 'center',
      isBadge: true,
      badgeSeverityMap: {
        'Activo': 'success',
        'Inactivo': 'danger',
      },
    },
    { field: 'createdAt', header: 'Fecha de creación', align: 'center' },
  ];

  protected userDialogVisible = false;
  protected userDialogLoading = false;

  userDialogData: UserFormDialogData = {
    roles: [],
    mode: 'create',
  };

  protected isEditing = false;

  constructor(
    private readonly userService: UserService,
    private readonly toast: ToastService,
    private readonly confirm: ConfirmService,
  ) {}

  public ngOnInit(): void {
    this.loadUsers();
  }

  get isResetPasswordDisabled(): boolean {
    return !this.selectedUser || !this.selectedUser.isActive;
  }

  onCreateUser(): void {
    this.isEditing = false;
    this.openCreateDialog();
  }

  onEditUser(): void {
    this.isEditing = true;
    if (!this.selectedUser) return;

    const user = this.selectedUser;

    this.openEditDialog(user);
  }

  onDeleteUsers(): void {
    if (!this.selectedUser) return;

    const user = this.selectedUser;

    this.confirm.confirmDelete(() => {
      this.handleDeleteUser(user.id);
    });
  }

  onResetPassword(): void {
    if (!this.selectedUser || !this.selectedUser.isActive) return;

    const user = this.selectedUser;

    this.confirm.confirmAction(
      () => this.handleResetPassword(user.id),
      `Se generará una nueva contraseña para <b>${user.name}</b> y se enviará a su correo registrado. ¿Deseas continuar?`,
      'Restablecer contraseña',
      'Restablecer',
    );
  }

  onRowSelect(user: UserRow) {
    this.selectedUser = user;
  }

  onRowUnselect() {
    this.selectedUser = null;
  }

  handleSaveUser(user: UserFormDialogValue): void {
    this.userDialogLoading = true;
    this.cdr.markForCheck();

    if (!this.isEditing) {
      this.userService
        .createUser({
          name: user.name,
          email: user.email,
          role_id: user.roleId,
        })
        .pipe(
          finalize(() => {
            this.userDialogLoading = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: () => {
            this.loadUsers();
            this.toast.success('Usuario creado exitosamente.');
            this.closeUserDialog();
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

        this.userService
          .updateUser(this.selectedUser.id, payload)
          .pipe(
            finalize(() => {
              this.selectedUser = null;
              this.userDialogLoading = false;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: (updatedUser: UserResponse) => {
              const updatedRow = this.mapToUserRow(updatedUser);
              this.users = this.users.map((current) =>
                current.id === updatedRow.id ? updatedRow : current,
              );

              this.toast.success('Usuario actualizado exitosamente.');
              this.closeUserDialog();
            },
            error: (error: unknown) => {
              const message = this.userService.getErrorMessage(error);
              this.toast.error(message);
            },
          });
      } else {
        this.userDialogLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  handleDeleteUser(userId: number): void {
    this.usersLoading = true;

    this.userService
      .deleteUser(userId)
      .pipe(
        finalize(() => {
          this.selectedUser = null;
          this.usersLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.removeUserEntry(userId);
          this.toast.success('Usuario eliminado exitosamente.');
        },
        error: (error: unknown) => {
          const message = this.userService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  handleResetPassword(userId: number): void {
    this.userService.resetManagedUserPassword(userId).subscribe({
      next: () => {
        this.toast.success('La contraseña fue restablecida y enviada al correo del usuario.');
      },
      error: (error: unknown) => {
        const message = this.userService.getErrorMessage(error);
        this.toast.error(message);
      },
    });
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

  protected closeUserDialog(): void {
    this.userDialogVisible = false;
    this.userDialogLoading = false;
    this.userDialogData = {
      roles: this.roles,
      mode: 'create',
    };
  }

  private removeUserEntry(userId: number): void {
    this.users = this.users.filter((user) => user.id !== userId);
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
      formatDateOnly(user.created_at),
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
}
