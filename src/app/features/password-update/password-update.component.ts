import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { finalize } from 'rxjs';

import { UserService } from '../../core/services/user.service';
import { SessionActions } from '../../core/store/session/session.actions';
import { selectSessionUser } from '../../core/store/session/session.selectors';
import { CurrentUserResponse } from '../../core/models/user.model';

interface PasswordUpdateAlert {
  type: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-password-update',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './password-update.component.html',
  styleUrl: './password-update.component.scss',
})
export class PasswordUpdateComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly store = inject(Store);
  private readonly router = inject(Router);

  private currentUser: CurrentUserResponse | null = null;

  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly alert = signal<PasswordUpdateAlert | null>(null);

  readonly passwordUpdateForm = this.formBuilder.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: [
      '',
      [Validators.required, Validators.minLength(8), this.confirmPasswordValidator()],
    ],
  });

  constructor() {
    this.store
      .select(selectSessionUser)
      .pipe(takeUntilDestroyed())
      .subscribe((user) => (this.currentUser = user));

    this.passwordUpdateForm
      .get('newPassword')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.passwordUpdateForm
          .get('confirmPassword')
          ?.updateValueAndValidity({ onlySelf: true });
      });

    this.passwordUpdateForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.alert()) {
        this.alert.set(null);
      }
    });
  }

  submit(): void {
    this.submitted.set(true);

    if (this.passwordUpdateForm.invalid) {
      this.passwordUpdateForm.markAllAsTouched();
      return;
    }

    if (!this.currentUser) {
      this.alert.set({
        type: 'error',
        message:
          'No se encontró la información del usuario en sesión. Inténtalo nuevamente.',
      });
      return;
    }

    const password = this.passwordUpdateForm.get('newPassword')?.value ?? '';

    this.submitting.set(true);
    this.alert.set(null);

    this.userService
      .resetPassword(this.currentUser.id, { password })
      .pipe(
        finalize(() => this.submitting.set(false))
      )
      .subscribe({
        next: () => {
          this.passwordUpdateForm.reset();
          this.passwordUpdateForm.markAsPristine();
          this.passwordUpdateForm.markAsUntouched();
          this.submitted.set(false);

          this.store.dispatch(SessionActions.logout());

          this.alert.set({
            type: 'success',
            message: 'Tu contraseña se actualizó correctamente. Inicia sesión nuevamente.',
          });
        },
        error: (error: unknown) => {
          this.alert.set({
            type: 'error',
            message: this.userService.getErrorMessage(error),
          });
        },
      });
  }

  showError(controlName: 'newPassword' | 'confirmPassword'): boolean {
    const control = this.passwordUpdateForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched || this.submitted());
  }

  hasError(controlName: 'newPassword' | 'confirmPassword', errorCode: string): boolean {
    const control = this.passwordUpdateForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.hasError(errorCode);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  private confirmPasswordValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.parent) {
        return null;
      }

      const newPassword = control.parent.get('newPassword')?.value;
      const confirmPassword = control.value;

      if (!newPassword || !confirmPassword) {
        return null;
      }

      return newPassword === confirmPassword ? null : { passwordMismatch: true };
    };
  }
}
