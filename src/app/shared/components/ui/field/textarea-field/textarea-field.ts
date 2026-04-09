import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-textarea-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TextareaModule,
    MessageModule,
    FloatLabelModule,
    IconFieldModule,
    InputIconModule,
  ],
  templateUrl: './textarea-field.html',
})
export class TextAreaFieldComponent {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;

  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() inputId?: string;
  @Input() fluid = true;
  @Input() errorMessage?: string;

  @Input() rows = 4;
  @Input() cols = 30;
  @Input() autoResize = false;

  @Input() icon?: string;
  @Input() iconPosition: 'left' | 'right' = 'left';

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get hasIcon(): boolean {
    return !!this.icon;
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `text-area-${Math.random().toString(36).slice(2, 9)}`;
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