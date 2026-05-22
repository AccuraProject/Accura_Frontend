import { Component, Input } from '@angular/core';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-message-feedback',
  standalone: true,
  imports: [MessageModule],
  templateUrl: './message-feedback.html',
})
export class MessageFeedbackComponent {
  @Input() text = '';
  @Input() severity: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast' = 'info';
  @Input() variant?: 'simple' | 'outlined' | 'text';
  @Input() size: 'small' | 'large' = 'small';
  @Input() icon?: string;
  @Input() styleClass?: string;
}
