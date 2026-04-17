import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, firstValueFrom, forkJoin, of, Subject, takeUntil } from 'rxjs';
import { TemplatesService, TemplateResponse } from '../templates/templates.service';
import { UserService } from '../../core/services/user.service';
import { UserResponse } from '../../core/models/user.model';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table';
import {
  AssignedTemplateView,
  AvailableTemplateView,
  EMPTY_PERMISSION_USER_DATA,
  PermissionFormDialogComponent,
  PermissionFormDialogData,
} from './components/permission-form-dialog/permission-form-dialog.component';
import { ToastService } from '../../shared/services/toast.service';
import { TemplateUserAccessResponse } from '../templates/models/template-user-access';

interface PermissionUser {
  id: number;
  name: string;
  email: string;
  lastUpdated: string;
  templates: string;
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageActionsComponent,
    DataTableComponent,
    PermissionFormDialogComponent,
  ],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent implements OnInit, OnDestroy {
  protected searchTerm = '';
  protected users: PermissionUser[] = [];
  protected selectedUser: PermissionUser | null = null;
  protected isTableLoading = signal(false);
  protected usersLoadError: string | null = null;

  columns = [
    { field: 'name', header: 'Usuario' },
    { field: 'templates', header: 'Plantillas asignadas' },
    { field: 'lastUpdated', header: 'Última actualización' },
  ];

  protected permissionDialogVisible = false;
  protected permissionDialogLoading = false;
  protected permissionDialogData: PermissionFormDialogData = EMPTY_PERMISSION_USER_DATA;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly userService: UserService,
    private readonly templatesService: TemplatesService,
    private readonly toast: ToastService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRowSelect(record: PermissionUser): void {
    this.selectedUser = record;
  }

  onRowUnselect() {
    this.selectedUser = null;
  }

  get isManageAccessDisabled(): boolean {
    return !this.selectedUser;
  }

  onManageAccess(): void {
    if (!this.selectedUser) return;

    this.permissionDialogData = {
      id: this.selectedUser.id,
      name: this.selectedUser.name,
      email: this.selectedUser.email,
      availableTemplates: [],
      assignedTemplates: [],
    };

    this.permissionDialogVisible = true;
    this.reloadPermissionDialogData();
  }

  reloadPermissionDialogData(): void {
    if (!this.selectedUser) return;

    this.permissionDialogLoading = true;

    forkJoin({
      allTemplates: this.templatesService.getTemplates(),
      userAccesses: this.templatesService.getTemplatesForUser(this.selectedUser.id),
    })
      .pipe(
        finalize(() => (this.permissionDialogLoading = false)),
        catchError((error: unknown) => {
          const message = this.templatesService.getErrorMessage(error);
          this.toast.error(message);

          this.permissionDialogData = {
            id: this.selectedUser!.id,
            name: this.selectedUser!.name,
            email: this.selectedUser!.email,
            availableTemplates: [],
            assignedTemplates: [],
          };

          return of({
            allTemplates: [] as TemplateResponse[],
            userAccesses: [] as TemplateUserAccessResponse[],
          });
        }),
      )
      .subscribe(({ allTemplates, userAccesses }) => {
        const templatesById = new Map<number, TemplateResponse>();
        for (const template of allTemplates) {
          templatesById.set(template.id, template);
        }

        const sortedAccesses = [...userAccesses].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );

        const latestAccessByTemplateId = new Map<number, TemplateUserAccessResponse>();
        for (const access of sortedAccesses) {
          if (!latestAccessByTemplateId.has(access.template_id)) {
            latestAccessByTemplateId.set(access.template_id, access);
          }
        }

        const latestAccesses = Array.from(latestAccessByTemplateId.values());

        const activeAccesses = latestAccesses.filter((access) => !access.revoked_at);

        const assignedTemplates = activeAccesses
          .map((access): AssignedTemplateView | null => {
            const template = templatesById.get(access.template_id);

            if (!template) {
              return null;
            }

            return {
              id: template.id,
              name: template.name,
              description: template.description || '',
              start_date: access.start_date ? new Date(access.start_date) : null,
              end_date: access.end_date ? new Date(access.end_date) : null,
              revoked_at: access.revoked_at ? new Date(access.revoked_at) : null,
            };
          })
          .filter((item): item is AssignedTemplateView => item !== null);

        const activeAssignedIds = new Set(assignedTemplates.map((template) => template.id));

        const availableTemplates = allTemplates
          .filter((template) => {
            const status = template.status?.toLowerCase()?.trim() ?? '';
            return status === 'published' && !activeAssignedIds.has(template.id);
          })
          .map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description || '',
          }));

        this.permissionDialogData = {
          id: this.selectedUser!.id,
          name: this.selectedUser!.name,
          email: this.selectedUser!.email,
          availableTemplates,
          assignedTemplates,
        };
      });
  }

  protected get filteredUsers(): PermissionUser[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    });
  }

  protected getRemainingCount(user: PermissionUser): number {
    return user.templates.length > 2 ? user.templates.length - 2 : 0;
  }

  private async loadUsers(): Promise<void> {
    if (this.isTableLoading()) {
      return;
    }

    this.isTableLoading.set(true);
    this.usersLoadError = null;

    try {
      const users = await firstValueFrom(this.userService.getUsers());
      const enrichedUsers = await Promise.all(users.map((user) => this.buildPermissionUser(user)));
      this.users = enrichedUsers;
    } catch (error) {
      console.error('Error al cargar los usuarios con sus plantillas.', error);
      this.usersLoadError = 'No fue posible cargar los usuarios. Inténtalo nuevamente.';
    } finally {
      this.isTableLoading.set(false);
    }
  }

  private async buildPermissionUser(user: UserResponse): Promise<PermissionUser> {
    const templates = await this.fetchTemplatesForUser(user.id);

    // Obtener los nombres de las plantillas y concatenarlos
    const templateNames = templates.map((template) => template.name);

    // Concatenar los nombres, limitando la longitud con elipsis si es necesario
    const concatenatedTemplateNames = this.formatTemplateNames(templateNames);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      lastUpdated: this.formatDate(user.updated_at ?? user.created_at),
      templates: concatenatedTemplateNames,
    };
  }

  private formatTemplateNames(templateNames: string[]): string {
    const MAX_LENGTH = 100;
    let concatenated = templateNames.join(', ');
    if (concatenated.length > MAX_LENGTH) {
      concatenated = concatenated.substring(0, MAX_LENGTH) + '...';
    }
    return concatenated;
  }

  private async fetchTemplatesForUser(userId: number): Promise<TemplateResponse[]> {
    try {
      const templates = await this.templatesService.fetchTemplatesForUser(userId);
      return templates;
    } catch (error) {
      console.error(`Error al obtener las plantillas del usuario ${userId}.`, error);
      return [];
    }
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

  protected closePermissionDialog(): void {
    this.permissionDialogVisible = false;
    this.permissionDialogLoading = false;
    this.permissionDialogData = EMPTY_PERMISSION_USER_DATA;
  }
}
