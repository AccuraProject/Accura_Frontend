import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../shared/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

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
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.successMessage.set('Sesión iniciada correctamente.');
        },
        error: (error: unknown) => {
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
