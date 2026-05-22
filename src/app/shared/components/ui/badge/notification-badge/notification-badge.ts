import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

type BadgeSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-notification-badge',
  standalone: true,
  imports: [OverlayBadgeModule],
  templateUrl: './notification-badge.html',
  styleUrl: './notification-badge.scss'
})
export class NotificationBadgeComponent {
  @Input() icon = 'pi pi-bell';
  @Input() value?: string | number;
  @Input() severity: BadgeSeverity = 'danger';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() ariaLabel = 'Notificaciones';
  @Input() disabled = false;
  @Input() badgeDisabled = false;

  @Output() clicked = new EventEmitter<MouseEvent>();

  get showBadge(): boolean {
    if (this.badgeDisabled) return false;
    if (this.value === null || this.value === undefined) return false;
    return `${this.value}`.trim() !== '' && `${this.value}` !== '0';
  }

  onClick(event: MouseEvent): void {
    if (this.disabled) return;
    this.clicked.emit(event);
  }
}