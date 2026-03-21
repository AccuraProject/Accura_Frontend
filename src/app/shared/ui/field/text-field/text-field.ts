import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-text-field',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    MessageModule,
    FloatLabelModule
  ],
  templateUrl: './text-field.html'
})
export class TextFieldComponent {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;

  @Input() type:
    | 'text'
    | 'email'
    | 'password'
    | 'search'
    | 'tel'
    | 'url' = 'text';

  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() inputId?: string;
  @Input() autocomplete?: string = "off";
  @Input() fluid = true;

  // opcional: override manual
  @Input() errorMessage?: string;

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `text-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  // 🔥 lógica inteligente de errores
  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'Este campo es requerido.';

    if (this.control.errors['email']) return 'Correo inválido.';

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