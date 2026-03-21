import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { catchError, finalize, map, switchMap, throwError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { SessionActions } from '../../core/store/session/session.actions';
import { ButtonComponent } from '../../shared/ui/button/button';
import { TextFieldComponent } from '../../shared/ui/field/text-field/text-field';
import { PasswordFieldComponent } from '../../shared/ui/field/password-field/password-field';
import { MessageFeedbackComponent } from '../../shared/feedback/message/message-feedback';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule, 
    TextFieldComponent,
    PasswordFieldComponent,
    ButtonComponent,
    MessageFeedbackComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly store = inject(Store);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  readonly isSubmitting = signal(false);
  readonly serverError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor() {
    this.loginForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.serverError()) {
        this.serverError.set(null);
      }
      if (this.successMessage()) {
        this.successMessage.set(null);
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password, rememberMe } = this.loginForm.getRawValue();

    this.isSubmitting.set(true);
    this.serverError.set(null);
    this.successMessage.set(null);

    this.authService
      .login(email, password, { rememberMe })
      .pipe(
        switchMap((response) => {
          this.store.dispatch(SessionActions.loginSuccess({ response }));
          return this.userService.getCurrentUser().pipe(
            map((user) => ({ response, user })),
            catchError((error) => {
              this.store.dispatch(SessionActions.logout());
              return throwError(() => ({ kind: 'current-user', error } as CurrentUserLoadError));
            })
          );
        }),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: ({ response, user }) => {
          if (response.role === 'admin' || response.role === 'user') {
            this.store.dispatch(SessionActions.loadCurrentUserSuccess({ user }));

            const mustChangePassword =
              response.must_change_password ?? user.must_change_password ?? false;

            if (mustChangePassword) {
              this.router.navigate(['/cambiar-contrasena']);
              return;
            }

            this.successMessage.set('Sesión iniciada correctamente.');
            this.router.navigate(['/']);
            return;
          }

          this.store.dispatch(SessionActions.logout());
          this.serverError.set('Tu cuenta no tiene permisos para acceder a la aplicación.');
        },
        error: (error: unknown) => {
          if (isCurrentUserLoadError(error)) {
            this.serverError.set(this.userService.getErrorMessage(error.error));
            return;
          }

          this.serverError.set(this.authService.getErrorMessage(error));
        },
      });
  }

  showEmailError(): boolean {
    const control = this.loginForm.controls.email;
    return control.invalid && (control.dirty || control.touched);
  }

  showPasswordError(): boolean {
    const control = this.loginForm.controls.password;
    return control.invalid && (control.dirty || control.touched);
  }
}

interface CurrentUserLoadError {
  kind: 'current-user';
  error: unknown;
}

function isCurrentUserLoadError(value: unknown): value is CurrentUserLoadError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as CurrentUserLoadError).kind === 'current-user'
  );
}
