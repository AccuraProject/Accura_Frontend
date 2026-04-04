import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
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
import { PasswordFieldComponent } from '../../shared/components/ui/field/password-field/password-field';

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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TextFieldComponent,
    PasswordFieldComponent,
    ButtonComponent,
  ],
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

  readonly changePasswordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: [
      '',
      [Validators.required, Validators.minLength(8), this.confirmPasswordValidator()],
    ],
  });

  readonly isSubmittingPersonalInfo = signal(false);
  readonly isSubmittingChangePassword = signal(false);

  private currentUser: CurrentUserResponse | null = null;

  constructor(
    private readonly userService: UserService,
    private readonly store: Store,
    private readonly toast: ToastService,
  ) {
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

  protected onSubmitChangePassword(): void {
    if (this.isSubmittingChangePassword()) {
      return;
    }

    this.isSubmittingChangePassword.set(true);

    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    if (!this.currentUser) {
      this.toast.warn('No se encontró información del usuario en sesión. Inténtalo nuevamente.');
      return;
    }

    const rawVlue = this.changePasswordForm.getRawValue();

    const payload: UpdateUserPayload = {
      current_password: rawVlue.currentPassword ?? '',
      password: rawVlue.newPassword ?? ''
    };

    this.userService
      .updateUser(this.currentUser.id, payload)
      .pipe(finalize(() => this.isSubmittingChangePassword.set(false)))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.store.dispatch(SessionActions.loadCurrentUserSuccess({ user }));
          this.toast.success('Tu contraseña se actualizó correctamente.');

          // this.changePasswordForm.reset();
          // this.changePasswordForm.markAsPristine();
          // this.changePasswordForm.markAsUntouched();
          // this.changePasswordSubmitted = false;
        },
        error: (error: unknown) => {
          const message = this.userService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  private handleCurrentUserChange(user: CurrentUserResponse | null): void {
    this.currentUser = user;

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
}
