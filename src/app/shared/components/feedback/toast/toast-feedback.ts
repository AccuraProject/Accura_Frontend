import { Component, Input } from '@angular/core';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [ToastModule],
  templateUrl: './toast-feedback.html',
})
export class ToastFeedbackComponent {
  @Input() key = 'global';
  @Input() position:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
    | 'center' = 'top-right';

  @Input() life = 3000;
  @Input() baseZIndex = 10000;
  @Input() preventDuplicates = false;
  @Input() preventOpenDuplicates = false;

  @Input() showTransformOptions = 'translateY(100%)';
  @Input() hideTransformOptions = 'translateY(-100%)';
  @Input() showTransitionOptions = '300ms ease-out';
  @Input() hideTransitionOptions = '250ms ease-in';
}