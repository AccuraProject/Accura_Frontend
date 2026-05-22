import { NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-progress-spinner',
  templateUrl: './progress-spinner.html',
  styleUrl: './progress-spinner.scss',
  imports: [NgClass, ProgressSpinnerModule],
})
export class ProgressSpinnerComponent {
  @Input() loading: boolean = false;
  @Input() size: string = '50';
  @Input() backgroundType: 'transparent' | 'white' | 'none' = 'transparent';

  get backgroundClass(): string {
    switch (this.backgroundType) {
      case 'white':
        return 'white-background';
      case 'none':
        return 'no-background';
      default:
        return 'transparent-background';
    }
  }
}
