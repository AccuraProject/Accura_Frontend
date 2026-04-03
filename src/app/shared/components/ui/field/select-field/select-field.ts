import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-select-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SelectModule,
    MessageModule,
    FloatLabelModule,
  ],
  templateUrl: './select-field.html',
})
export class SelectFieldComponent {
  @Input() label?: string;
  @Input() placeholder = 'Selecciona una opción';
  @Input() control!: FormControl;

  @Input() options: any[] = [];
  @Input() optionLabel = 'label';
  @Input() optionValue = 'value';

  @Input() required = false;
  @Input() disabled = false;
  @Input() inputId?: string;
  @Input() fluid = true;
  @Input() errorMessage?: string;

  @Input() filter = false;
  @Input() showClear = false;
  @Input() appendTo: 'body' | HTMLElement | undefined = 'body';

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `select-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'Este campo es requerido.';
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