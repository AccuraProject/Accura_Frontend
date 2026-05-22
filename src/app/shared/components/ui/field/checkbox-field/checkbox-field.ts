import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-checkbox-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CheckboxModule,
    MessageModule,
  ],
  templateUrl: './checkbox-field.html',
})
export class CheckboxFieldComponent {
  @Input() label?: string;
  @Input() control!: FormControl;
  @Input() required = false;
  @Input() disabled = false;
  @Input() inputId?: string;
  @Input() errorMessage?: string;

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `checkbox-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'Este campo es requerido.';
    if (this.control.errors['requiredTrue']) return 'Debes aceptar esta opción.';

    return this.errorMessage ?? 'Campo inválido.';
  }
}