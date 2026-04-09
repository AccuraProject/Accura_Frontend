import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';

type NumberMode = 'decimal' | 'currency';

@Component({
  selector: 'app-number-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputNumberModule,
    FloatLabelModule,
    MessageModule,
  ],
  templateUrl: './number-field.html',
})
export class NumberFieldComponent {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;

  @Input() required = false;
  @Input() disabled = false;
  @Input() readonly = false;
  @Input() inputId?: string;
  @Input() fluid = true;
  @Input() errorMessage?: string;

  @Input() min?: number;
  @Input() max?: number;
  @Input() step? = 1;

  @Input() minFractionDigits?: number;
  @Input() maxFractionDigits?: number;

  @Input() useGrouping = false;
  @Input() mode: NumberMode = 'decimal';
  @Input() currency?: string;
  @Input() locale = 'es-PE';

  @Input() prefix?: string;
  @Input() suffix?: string;

  @Input() showButtons = false;
  @Input() buttonLayout: 'stacked' | 'horizontal' | 'vertical' = 'stacked';

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `number-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'Este campo es requerido.';
    if (this.control.errors['min']) return `El valor mínimo es ${this.control.errors['min'].min}.`;
    if (this.control.errors['max']) return `El valor máximo es ${this.control.errors['max'].max}.`;
    if (this.control.errors['pattern']) return 'Formato inválido.';

    return this.errorMessage ?? 'Campo inválido.';
  }
}