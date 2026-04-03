import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastFeedbackComponent } from './shared/components/feedback/toast/toast-feedback';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastFeedbackComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}
