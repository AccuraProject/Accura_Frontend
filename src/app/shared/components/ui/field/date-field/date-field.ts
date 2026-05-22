import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePickerModule,
    FloatLabelModule,
    MessageModule,
  ],
  templateUrl: './date-field.html',
})
export class DateFieldComponent {
  @Input() label?: string;
  @Input() placeholder = '';
  @Input() control!: FormControl;

  @Input() disabled = false;
  @Input() readonly = false;
  @Input() inputId?: string;
  @Input() fluid = true;
  @Input() errorMessage?: string;

  @Input() showIcon = true;
  @Input() dateFormat = 'dd/mm/yy';

  @Input() showTime = false;
  @Input() hourFormat: '12' | '24' = '24';

  @Input() minDate?: Date;
  @Input() maxDate?: Date;

  get showError(): boolean {
    return !!this.control && this.control.invalid && (this.control.touched || this.control.dirty);
  }

  get computedInputId(): string {
    if (this.inputId) return this.inputId;

    return this.label
      ? this.label.toLowerCase().replace(/\s+/g, '-')
      : `date-field-${Math.random().toString(36).slice(2, 9)}`;
  }

  get errorText(): string {
    if (!this.control || !this.control.errors) return '';

    if (this.control.errors['required']) return 'Este campo es requerido.';

    return this.errorMessage ?? 'Fecha inválida.';
  }
}