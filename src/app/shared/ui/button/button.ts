import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warn'
  | 'help'
  | 'danger'
  | 'contrast';

type ButtonType = 'button' | 'submit' | 'reset';
type IconPosition = 'left' | 'right' | 'top' | 'bottom';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './button.html'
})
export class ButtonComponent {
  @Input() label?: string;
  @Input() icon?: string;

  @Input() variant: ButtonVariant = 'primary';
  @Input() type: ButtonType = 'button';
  @Input() iconPos: IconPosition = 'left';

  @Input() outlined = false;
  @Input() text = false;
  @Input() raised = false;
  @Input() rounded = false;
  @Input() loading = false;
  @Input() disabled = false;
  @Input() fluid = false;
  @Input() iconOnly = false;

  @Output() clicked = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }

  get severity(): Exclude<ButtonVariant, 'primary'> | undefined {
    return this.variant === 'primary' ? undefined : this.variant;
  }

  get ariaLabel(): string | undefined {
    if (this.label?.trim()) return this.label;
    if (this.iconOnly && this.icon) return 'button';
    return undefined;
  }
}