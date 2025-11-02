import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Store } from '@ngrx/store';

import {
  SettingsManageUserDialogComponent,
  SettingsManageUserDialogResult
} from './settings-manage-user-dialog.component';
import { UserService } from '../core/services/user.service';
import { selectSessionUser } from '../core/store/session/session.selectors';
import {
  CurrentUserResponse,
  UpdateUserPayload,
  UserCreatedByMeResponse,
  UserRole,
  UserDetail,
} from '../core/models/user.model';
import { SessionActions } from '../core/store/session/session.actions';

export interface ManagedUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  protected readonly personalInfoForm: FormGroup;
  protected readonly changePasswordForm: FormGroup;

  protected personalInfoAlert: PersonalInfoAlert | null = null;
  protected personalInfoSubmitting = false;
  protected changePasswordAlert: ChangePasswordAlert | null = null;
  protected changePasswordSubmitting = false;
  protected manageUsersAlert: ManageUsersAlert | null = null;
  protected canManageUsers = false;

  protected users: ManagedUser[] = [];

  protected searchTerm = '';

  private currentUser: CurrentUserResponse | null = null;
  private personalInfoSubmitted = false;
  private changePasswordSubmitted = false;
  private manageUsersLoaded = false;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly userService: UserService,
    private readonly store: Store
  ) {
    this.personalInfoForm = this.formBuilder.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      role: [{ value: '', disabled: true }],
      email: ['', [Validators.required, Validators.email]]
    });

    this.changePasswordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: [
        '',
        [Validators.required, Validators.minLength(8), this.confirmPasswordValidator()]
      ]
    });

    this.changePasswordForm
      .get('newPassword')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.changePasswordForm.get('confirmPassword')?.updateValueAndValidity({ onlySelf: true });
      });

    this.store
      .select(selectSessionUser)
      .pipe(takeUntilDestroyed())
      .subscribe((user) => this.handleCurrentUserChange(user));
  }

  protected get filteredUsers(): ManagedUser[] {
    const query = this.searchTerm.toLowerCase().trim();

    if (!query) {
      return this.users;
    }

    return this.users.filter((user) =>
      [user.name, user.email, user.role, user.status].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }

  protected submitPersonalInfo(): void {
    this.personalInfoSubmitted = true;

    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }

    if (!this.currentUser) {
      this.personalInfoAlert = {
        type: 'error',
        title: 'No se pudo actualizar la información',
        message: 'No se encontró información del usuario en sesión. Inténtalo nuevamente.',
      };
      return;
    }

    const payload: UpdateUserPayload = {
      name: this.personalInfoForm.get('fullName')?.value?.trim() ?? ''
    };

    if (!this.userIsClient(this.currentUser)) {
      payload.email = this.personalInfoForm.get('email')?.value?.trim() ?? '';
    }

    this.personalInfoSubmitting = true;
    this.personalInfoAlert = null;

    this.userService
      .updateUser(this.currentUser.id, payload)
      .pipe(finalize(() => (this.personalInfoSubmitting = false)))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.store.dispatch(SessionActions.loadCurrentUserSuccess({ user }));

          this.personalInfoForm.patchValue(
            {
              fullName: user.name,
              email: user.email
            },
            { emitEvent: false }
          );
          this.personalInfoForm.get('role')?.setValue(user.role.alias, { emitEvent: false });
          this.personalInfoForm.markAsPristine();
          this.personalInfoForm.markAsUntouched();
          this.personalInfoSubmitted = false;

          this.personalInfoAlert = {
            type: 'success',
            title: 'Cambios guardados',
            message: 'Tu información personal se actualizó correctamente.'
          };
        },
        error: (error: unknown) => {
          this.personalInfoAlert = {
            type: 'error',
            title: 'No se pudo actualizar la información',
            message: this.userService.getErrorMessage(error)
          };
        }
      });
  }

  protected submitChangePassword(): void {
    this.changePasswordSubmitted = true;

    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    if (!this.currentUser) {
      this.changePasswordAlert = {
        type: 'error',
        title: 'No se pudo actualizar la contraseña',
        message: 'No se encontró información del usuario en sesión. Inténtalo nuevamente.'
      };
      return;
    }

    const payload: UpdateUserPayload = {
      current_password: this.changePasswordForm.get('currentPassword')?.value ?? '',
      password: this.changePasswordForm.get('newPassword')?.value ?? ''
    };

    this.changePasswordSubmitting = true;
    this.changePasswordAlert = null;

    this.userService
      .updateUser(this.currentUser.id, payload)
      .pipe(finalize(() => (this.changePasswordSubmitting = false)))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.store.dispatch(SessionActions.loadCurrentUserSuccess({ user }));

          this.changePasswordForm.reset();
          this.changePasswordForm.markAsPristine();
          this.changePasswordForm.markAsUntouched();
          this.changePasswordSubmitted = false;

          this.changePasswordAlert = {
            type: 'success',
            title: 'Contraseña actualizada',
            message: 'Tu contraseña se actualizó correctamente.'
          };
        },
        error: (error: unknown) => {
          this.changePasswordAlert = {
            type: 'error',
            title: 'No se pudo actualizar la contraseña',
            message: this.userService.getErrorMessage(error)
          };
        }
      });
  }

  protected openManageDialog(user: ManagedUser): void {
    if (!this.canManageUsers) {
      return;
    }

    this.dialog
      .open(SettingsManageUserDialogComponent, {
        width: '540px',
        data: { user },
        autoFocus: false
      })
      .afterClosed()
      .subscribe((result: SettingsManageUserDialogResult | undefined) => {
        if (!result) {
          return;
        }

        if (result.action === 'email') {
          this.updateManagedUserEmail(result.user.id, result.email);
        }

        if (result.action === 'reset-password') {
          this.resetManagedUserPassword(result.user.id);
        }
      });
  }

  protected trackByUserId(_: number, user: ManagedUser): number {
    return user.id;
  }

  protected userInitials(user: ManagedUser): string {
    return user.name
      .split(' ')
      .filter((part) => !!part)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
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

  protected showChangePasswordError(
    controlName: 'currentPassword' | 'newPassword' | 'confirmPassword'
  ): boolean {
    const control = this.changePasswordForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched || this.changePasswordSubmitted);
  }

  protected hasChangePasswordError(
    controlName: 'currentPassword' | 'newPassword' | 'confirmPassword',
    errorCode: string
  ): boolean {
    const control = this.changePasswordForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.hasError(errorCode);
  }

  protected showPersonalInfoError(controlName: 'fullName' | 'email'): boolean {
    const control = this.personalInfoForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched || this.personalInfoSubmitted);
  }

  protected hasPersonalInfoError(controlName: 'fullName' | 'email', errorCode: string): boolean {
    const control = this.personalInfoForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.hasError(errorCode);
  }

  protected dismissPersonalInfoAlert(): void {
    this.personalInfoAlert = null;
  }

  protected dismissChangePasswordAlert(): void {
    this.changePasswordAlert = null;
  }

  protected dismissManageUsersAlert(): void {
    this.manageUsersAlert = null;
  }

  private loadUsers(): void {
    if (!this.canManageUsers) {
      return;
    }

    this.manageUsersLoaded = true;

    this.userService.getUsersCreatedByMe().subscribe({
      next: (users: UserCreatedByMeResponse[]) => {
        this.users = users.map((user) => this.mapToManagedUser(user));
      },
      error: (error: unknown) => {
        const message = this.userService.getErrorMessage(error);
        if (typeof window !== 'undefined') {
          window.alert(message);
        } else {
          console.error(message);
        }
        this.manageUsersLoaded = false;
      }
    });
  }

  private updateManagedUserEmail(userId: number, email: string): void {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      return;
    }

    this.manageUsersAlert = null;

    this.userService.updateUser(userId, { email: trimmedEmail }).subscribe({
      next: (updatedUser) => {
        const managedUser = this.mapToManagedUser(updatedUser);
        this.users = this.users.map((user) =>
          user.id === userId ? { ...user, ...managedUser } : user
        );
        this.manageUsersAlert = {
          type: 'success',
          title: 'Correo actualizado',
          message: 'El correo electrónico se actualizó correctamente.'
        };
      },
      error: (error: unknown) => {
        this.manageUsersAlert = {
          type: 'error',
          title: 'No se pudo actualizar el correo electrónico',
          message: this.userService.getErrorMessage(error)
        };
      }
    });
  }

  private resetManagedUserPassword(userId: number): void {
    this.manageUsersAlert = null;

    this.userService.resetManagedUserPassword(userId).subscribe({
      next: () => {
        this.manageUsersAlert = {
          type: 'success',
          title: 'Contraseña reseteada',
          message:
            'Se generó una nueva contraseña y se envió al correo del usuario seleccionado.'
        };
      },
      error: (error: unknown) => {
        this.manageUsersAlert = {
          type: 'error',
          title: 'No se pudo resetear la contraseña',
          message: this.userService.getErrorMessage(error)
        };
      }
    });
  }

  private mapToManagedUser(user: UserDetail): ManagedUser {
    return {
      id: user.id,
      name: user.name,
      username: this.getUsernameFromEmail(user.email),
      email: user.email,
      role: this.getRoleDisplayName(user.role),
      status: this.getStatusLabel(user.is_active),
      createdAt: this.formatDate(user.created_at)
    };
  }

  private getUsernameFromEmail(email: string): string {
    if (!email) {
      return '';
    }

    const [username] = email.split('@');
    return username?.trim() || email;
  }

  private getRoleDisplayName(role?: UserRole | null): string {
    if (!role) {
      return 'Sin rol';
    }

    return role.name?.trim() || role.alias?.trim() || 'Sin rol';
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

  private handleCurrentUserChange(user: CurrentUserResponse | null): void {
    this.currentUser = user;
    this.personalInfoSubmitted = false;
    this.personalInfoAlert = null;
    this.changePasswordSubmitted = false;
    this.changePasswordAlert = null;
    this.manageUsersAlert = null;

    this.canManageUsers = this.userCanManageUsers(user);

    if (!this.canManageUsers) {
      this.users = [];
      this.manageUsersLoaded = false;
    }

    if (!user) {
      this.personalInfoForm.reset({ fullName: '', email: '', role: '' });
      this.changePasswordForm.reset();
      return;
    }

    if (this.canManageUsers && !this.manageUsersLoaded) {
      this.loadUsers();
    }

    this.personalInfoForm.patchValue(
      {
        fullName: user.name,
        email: user.email,
        role: user.role.name
      },
      { emitEvent: false }
    );
    this.personalInfoForm.markAsPristine();
    this.personalInfoForm.markAsUntouched();
    this.changePasswordForm.reset();
    this.changePasswordForm.markAsPristine();
    this.changePasswordForm.markAsUntouched();
  }

  private confirmPasswordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) {
        return null;
      }

      const newPassword = control.parent.get('newPassword')?.value;
      const confirmPassword = control.value;

      if (!confirmPassword || !newPassword) {
        return null;
      }

    return newPassword === confirmPassword ? null : { passwordMismatch: true };
    };
  }

  private userCanManageUsers(user: CurrentUserResponse | null): boolean {
    if (!user?.role) {
      return false;
    }

    const alias = user.role.alias?.toLowerCase();
    if (alias) {
      return alias === 'admin';
    }

    const name = user.role.name?.toLowerCase();
    return name === 'administrador';
  }

  private userIsClient(user: CurrentUserResponse | null): boolean {
    const alias = user?.role?.alias?.toLowerCase();
    if (alias) {
      return alias === 'user';
    }

    const name = user?.role?.name?.toLowerCase();
    return name === 'cliente' || name === 'usuario';
  }
}

interface PersonalInfoAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
}

interface ChangePasswordAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
}

interface ManageUsersAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
}
