import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Store } from '@ngrx/store';

import { UserService } from '../../core/services/user.service';
import { selectSessionUser } from '../../core/store/session/session.selectors';
import { CurrentUserResponse, UpdateUserPayload } from '../../core/models/user.model';
import { SessionActions } from '../../core/store/session/session.actions';
import { TextFieldComponent } from '../../shared/components/ui/field/text-field/text-field';
import { ButtonComponent } from '../../shared/components/ui/button/button';
import { ToastService } from '../../shared/services/toast.service';

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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, TextFieldComponent, ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);

  readonly personalInfoForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    role: [{ value: '', disabled: true }, [Validators.required]],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
  });

  protected readonly changePasswordForm: FormGroup;

  protected personalInfoAlert: PersonalInfoAlert | null = null;
  readonly isSubmittingPersonalInfo = signal(false);
  protected personalInfoSubmitting = false;
  protected changePasswordAlert: ChangePasswordAlert | null = null;
  protected changePasswordSubmitting = false;
  protected manageUsersAlert: ManageUsersAlert | null = null;
  protected canManageUsers = false;

  protected users: ManagedUser[] = [];

  protected searchTerm = '';

  protected readonly pageSize = 10;
  protected currentPage = 1;

  private currentUser: CurrentUserResponse | null = null;
  private personalInfoSubmitted = false;
  private changePasswordSubmitted = false;

  constructor(
    private readonly userService: UserService,
    private readonly store: Store,
    private readonly toast: ToastService,
  ) {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: [
        '',
        [Validators.required, Validators.minLength(8), this.confirmPasswordValidator()],
      ],
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
        value.toLowerCase().includes(query),
      ),
    );
  }

  protected get paginatedUsers(): ManagedUser[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
  }

  protected get totalPages(): number {
    const total = Math.ceil(this.filteredUsers.length / this.pageSize);
    return total > 0 ? total : 1;
  }

  protected get pageStart(): number {
    if (this.filteredUsers.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  protected get pageEnd(): number {
    if (this.filteredUsers.length === 0) {
      return 0;
    }

    return Math.min(this.filteredUsers.length, this.currentPage * this.pageSize);
  }

  protected goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  protected goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  protected onSearchChange(): void {
    this.currentPage = 1;
  }

  protected onSubmitPersonalInfo(): void {
    if (this.isSubmittingPersonalInfo()) {
      return;
    }

    this.isSubmittingPersonalInfo.set(true);

    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }

    if (!this.currentUser) {
      this.toast.warn('No se encontró información del usuario en sesión. Inténtalo nuevamente.');
      return;
    }

    const rawVlue = this.personalInfoForm.getRawValue();

    const payload: UpdateUserPayload = {
      name: rawVlue.fullName.trim(),
    };

    this.userService
      .updateUser(this.currentUser.id, payload)
      .pipe(finalize(() => this.isSubmittingPersonalInfo.set(false)))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.store.dispatch(SessionActions.loadCurrentUserSuccess({ user }));
          this.toast.success('Tu información personal se actualizó correctamente.');
        },
        error: (error: unknown) => {
          const message = this.userService.getErrorMessage(error);
          this.toast.error(message);
        },
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
        message: 'No se encontró información del usuario en sesión. Inténtalo nuevamente.',
      };
      return;
    }

    const payload: UpdateUserPayload = {
      current_password: this.changePasswordForm.get('currentPassword')?.value ?? '',
      password: this.changePasswordForm.get('newPassword')?.value ?? '',
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
            message: 'Tu contraseña se actualizó correctamente.',
          };
        },
        error: (error: unknown) => {
          this.changePasswordAlert = {
            type: 'error',
            title: 'No se pudo actualizar la contraseña',
            message: this.userService.getErrorMessage(error),
          };
        },
      });
  }

  protected showChangePasswordError(
    controlName: 'currentPassword' | 'newPassword' | 'confirmPassword',
  ): boolean {
    const control = this.changePasswordForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched || this.changePasswordSubmitted);
  }

  protected hasChangePasswordError(
    controlName: 'currentPassword' | 'newPassword' | 'confirmPassword',
    errorCode: string,
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

  private handleCurrentUserChange(user: CurrentUserResponse | null): void {
    this.currentUser = user;
    this.personalInfoSubmitted = false;
    this.personalInfoAlert = null;
    this.changePasswordSubmitted = false;
    this.changePasswordAlert = null;
    this.manageUsersAlert = null;

    if (!user) {
      this.personalInfoForm.reset({ fullName: '', email: '', role: '' });
      this.changePasswordForm.reset();
      return;
    }

    this.personalInfoForm.patchValue(
      {
        fullName: user.name,
        email: user.email,
        role: user.role.name,
      },
      { emitEvent: false },
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
