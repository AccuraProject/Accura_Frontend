import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, firstValueFrom } from 'rxjs';
import { selectIsAdmin, selectSessionUser } from '../../core/store/session/session.selectors';
import { TemplateClientManagementComponent } from './template-client-management/template-client-management.component';
import { TemplateManagementComponent } from './template-management/template-management.component';

@Component({
  selector: 'app-template-layout',
  standalone: true,
  imports: [CommonModule, TemplateManagementComponent, TemplateClientManagementComponent],
  templateUrl: './template-layout.component.html',
  styleUrls: ['./template-layout.component.scss'],
})
export class TemplateLayoutComponent implements OnInit {
  private readonly store = inject(Store);
  protected readonly sessionUser$ = this.store.select(selectSessionUser);
  private readonly isAdmin$: Observable<boolean> = this.store.select(selectIsAdmin);

  public sessionUserId: number | null = null;
  public isAdmin: boolean = false;

  ngOnInit(): void {
    this.initializeTemplates();
  }

  private async initializeTemplates(): Promise<void> {
    const isAdmin = await firstValueFrom(this.isAdmin$);

    this.isAdmin = isAdmin;
  }
}