import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
} from '../core/models/user.model';
import { SessionActions } from '../core/store/session/session.actions';

export interface ManagedUser {
  name: string;
  username: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  protected readonly personalInfoForm: FormGroup;
  protected readonly changePasswordForm: FormGroup;

  protected personalInfoAlert: PersonalInfoAlert | null = null;
  protected personalInfoSubmitting = false;

  protected users: ManagedUser[] = [];

  protected searchTerm = '';

  private currentUser: CurrentUserResponse | null = null;
  private personalInfoSubmitted = false;

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
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.store
      .select(selectSessionUser)
      .pipe(takeUntilDestroyed())
      .subscribe((user) => this.handleCurrentUserChange(user));
  }

  public ngOnInit(): void {
    this.loadUsers();
  }

  protected get filteredUsers(): ManagedUser[] {
    const query = this.searchTerm.toLowerCase().trim();

    if (!query) {
      return this.users;
    }

    return this.users.filter((user) =>
      [user.name, user.username, user.email, user.role].some((value) =>
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
      name: this.personalInfoForm.get('fullName')?.value?.trim() ?? '',
      email: this.personalInfoForm.get('email')?.value?.trim() ?? ''
    };

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
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    console.info('Actualizar contraseña', this.changePasswordForm.value);
    this.changePasswordForm.reset();
  }

  protected openManageDialog(user: ManagedUser): void {
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

        if (result.action === 'password') {
          console.info('Actualizar contraseña de usuario', result);
        }

        if (result.action === 'email') {
          console.info('Actualizar correo de usuario', result);
        }
      });
  }

  protected trackByUsername(_: number, user: ManagedUser): string {
    return user.username;
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

  private loadUsers(): void {
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
      }
    });
  }

  private mapToManagedUser(user: UserCreatedByMeResponse): ManagedUser {
    return {
      name: user.name,
      username: this.getUsernameFromEmail(user.email),
      email: user.email,
      role: this.getRoleDisplayName(user.role)
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

    return role.alias?.trim() || role.name?.trim() || 'Sin rol';
  }

  private handleCurrentUserChange(user: CurrentUserResponse | null): void {
    this.currentUser = user;
    this.personalInfoSubmitted = false;
    this.personalInfoAlert = null;

    if (!user) {
      this.personalInfoForm.reset({ fullName: '', email: '', role: '' });
      return;
    }

    this.personalInfoForm.patchValue(
      {
        fullName: user.name,
        email: user.email,
        role: user.role.alias
      },
      { emitEvent: false }
    );
    this.personalInfoForm.markAsPristine();
    this.personalInfoForm.markAsUntouched();
  }
}

interface PersonalInfoAlert {
  type: 'success' | 'error';
  title: string;
  message: string;
}
