import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastFeedbackComponent } from './shared/components/feedback/toast/toast-feedback';
import { ConfirmDialogComponent } from './shared/components/overlay/dialog/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastFeedbackComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
