import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    MessageModule,
    FloatLabelModule
  ],
  templateUrl: './password-field.html'
})
export class PasswordFieldComponent {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;
  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() inputId?: string;
  @Input() autocomplete = 'current-password';

  @Input() toggleMask = true;
  @Input() feedback = false;
  @Input() showClear = false;
  @Input() fluid = true;

  @Input() errorMessage?: string;

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `password-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'La contraseña es requerida.';

    if (this.control.errors['minlength']) {
      return `Mínimo ${this.control.errors['minlength'].requiredLength} caracteres.`;
    }

    if (this.control.errors['maxlength']) {
      return `Máximo ${this.control.errors['maxlength'].requiredLength} caracteres.`;
    }

    if (this.control.errors['pattern']) {
      return 'Formato inválido.';
    }

    return this.errorMessage ?? 'Campo inválido.';
  }
}