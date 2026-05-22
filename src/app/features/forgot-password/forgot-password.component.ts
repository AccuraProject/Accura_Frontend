import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/services/auth.service';
import { TextFieldComponent } from '../../shared/components/ui/field/text-field/text-field';
import { MessageFeedbackComponent } from '../../shared/components/feedback/message/message-feedback';
import { ButtonComponent } from '../../shared/components/ui/button/button';

interface AlertMessage {
  type: 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    RouterModule,
    TextFieldComponent,
    MessageFeedbackComponent,
    ButtonComponent
  ],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly alert = signal<AlertMessage | null>(null);

  constructor() {
    this.forgotPasswordForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.alert()) {
        this.alert.set(null);
      }
    });
  }

  submit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const { email } = this.forgotPasswordForm.getRawValue();

    this.submitting.set(true);
    this.alert.set(null);

    this.authService
      .requestPasswordReset(email)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (response) => {
          const message = this.getSuccessMessage(response, email);
          this.alert.set({
            type: 'success',
            message,
          });
        },
        error: (error: unknown) => {
          this.alert.set({
            type: 'error',
            message: this.authService.getErrorMessage(error),
          });
        },
      });
  }

  showEmailError(): boolean {
    const control = this.forgotPasswordForm.controls.email;
    return control.invalid && (control.dirty || control.touched);
  }

  hasError(errorCode: string): boolean {
    return this.forgotPasswordForm.controls.email.hasError(errorCode);
  }

  private getSuccessMessage(response: unknown, email: string): string {
    if (response && typeof response === 'object') {
      const detail = (response as { detail?: string }).detail;
      const message = (response as { message?: string }).message;

      if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
      }

      if (typeof message === 'string' && message.trim().length > 0) {
        return message;
      }
    }

    return `Se han enviado las instrucciones de recuperación a ${email}. Por favor revisa tu bandeja de entrada.`;
  }
}
