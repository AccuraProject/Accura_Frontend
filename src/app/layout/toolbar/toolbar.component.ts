import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss'
})
export class ToolbarComponent {
  @Output() menuToggle = new EventEmitter<void>();

  protected readonly notifications = 4;

  protected onToggleMenu(): void {
    this.menuToggle.emit();
  }
}
