import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, ToolbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  protected mobileNavOpen = false;
  protected sidebarCollapsed = false;

  protected toggleSidebar(): void {
    if (window.innerWidth <= 991) {
      this.mobileNavOpen = !this.mobileNavOpen;
      return;
    }

    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen = false;
  }
}
