import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';

import {
  PermissionManageDialogComponent,
  PermissionManageDialogData,
  PermissionManageDialogResult
} from './permission-manage-dialog.component';
import { TemplatesService, TemplateResponse } from '../templates/templates.service';
import { UserService } from '../../core/services/user.service';
import { UserResponse } from '../../core/models/user.model';

interface PermissionUser {
  id: number;
  name: string;
  email: string;
  lastUpdated: string;
  templates: TemplatePreview[];
}

interface TemplatePreview {
  id: number;
  name: string;
  code: string;
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent implements OnInit, OnDestroy {
  protected searchTerm = '';
  protected users: PermissionUser[] = [];
  protected isLoading = false;
  protected loadError: string | null = null;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly dialog: MatDialog,
    private readonly userService: UserService,
    private readonly templatesService: TemplatesService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get filteredUsers(): PermissionUser[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    });
  }

  protected get paginatedUsers(): PermissionUser[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
  }

  protected get totalPages(): number {
    const total = Math.ceil(this.filteredUsers.length / this.pageSize);
    return total > 0 ? total : 1;
  }

  protected get pageStart(): number {
    if (this.filteredUsers.length === 0) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  protected get pageEnd(): number {
    if (this.filteredUsers.length === 0) {
      return 0;
    }

    return Math.min(this.filteredUsers.length, this.currentPage * this.pageSize);
  }

  protected goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  protected goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  protected onSearchChange(): void {
    this.currentPage = 1;
  }

  protected trackByUserId(_: number, user: PermissionUser): number {
    return user.id;
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected getVisibleTemplates(user: PermissionUser): TemplatePreview[] {
    return user.templates.slice(0, 2);
  }

  protected getRemainingCount(user: PermissionUser): number {
    return user.templates.length > 2 ? user.templates.length - 2 : 0;
  }

  protected trackByTemplateId(_: number, template: TemplatePreview): number {
    return template.id;
  }

  protected openManageDialog(user: PermissionUser): void {
    const dialogRef = this.dialog.open<
      PermissionManageDialogComponent,
      PermissionManageDialogData,
      PermissionManageDialogResult
    >(PermissionManageDialogComponent, {
      disableClose: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: PermissionManageDialogResult | undefined) => {
        if (!result?.refresh) {
          return;
        }

        void this.loadUsers();
      });
  }

  private async loadUsers(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      const users = await firstValueFrom(this.userService.getUsers());
      const enrichedUsers = await Promise.all(
        users.map((user) => this.buildPermissionUser(user))
      );
      this.users = enrichedUsers;
      this.updatePaginationAfterDataChange(this.users.length);
    } catch (error) {
      console.error('Error al cargar los usuarios con sus plantillas.', error);
      this.loadError = 'No fue posible cargar los usuarios. Inténtalo nuevamente.';
    } finally {
      this.isLoading = false;
    }
  }

  private updatePaginationAfterDataChange(totalItems: number): void {
    const totalPages = this.calculateTotalPages(totalItems);
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }

    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private calculateTotalPages(totalItems: number): number {
    return totalItems > 0 ? Math.ceil(totalItems / this.pageSize) : 1;
  }

  private async buildPermissionUser(user: UserResponse): Promise<PermissionUser> {
    const templates = await this.fetchTemplatesForUser(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      lastUpdated: this.formatDate(user.updated_at ?? user.created_at),
      templates
    };
  }

  private async fetchTemplatesForUser(userId: number): Promise<TemplatePreview[]> {
    try {
      const templates = await this.templatesService.fetchTemplatesForUser(userId);
      return templates.map((template) => this.toTemplatePreview(template));
    } catch (error) {
      console.error(`Error al obtener las plantillas del usuario ${userId}.`, error);
      return [];
    }
  }

  private toTemplatePreview(template: TemplateResponse): TemplatePreview {
    return {
      id: template.id,
      name: template.name,
      code: this.buildTemplateCode(template)
    };
  }

  private buildTemplateCode(template: TemplateResponse): string {
    const tableName = template.table_name?.trim();
    if (tableName) {
      return tableName.toUpperCase();
    }

    const initials = template.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');

    return initials || `#${template.id}`;
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value.slice(0, 10);
    }

    return parsed.toISOString().slice(0, 10);
  }
}
