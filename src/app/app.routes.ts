import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UsersComponent } from './users/users.component';
import { ValidationRulesComponent } from './validation-rules/validation-rules.component';
import { PermissionsComponent } from './permissions/permissions.component';
import { TemplateManagementComponent } from './templates/template-management.component';
import { HistoryComponent } from './history/history.component';
import { SettingsComponent } from './settings/settings.component';
import { authGuard } from './core/guards/auth.guard';
import { PasswordUpdateComponent } from './password-update/password-update.component';
import { passwordUpdateGuard } from './core/guards/password-update.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', component: DashboardComponent, data: { roles: ['admin', 'user'] } },
      { path: 'usuarios', component: UsersComponent, data: { roles: ['admin'] } },
      {
        path: 'reglas-validacion',
        component: ValidationRulesComponent,
        data: { roles: ['admin'] },
      },
      { path: 'permisos', component: PermissionsComponent, data: { roles: ['admin'] } },
      { path: 'plantillas', component: TemplateManagementComponent, data: { roles: ['admin', 'user'] } },
      { path: 'historial', component: HistoryComponent, data: { roles: ['admin', 'user'] } },
      { path: 'configuracion', component: SettingsComponent, data: { roles: ['admin', 'user'] } },
    ]
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'cambiar-contrasena',
    component: PasswordUpdateComponent,
    canActivate: [passwordUpdateGuard],
  },
  {
    path: '**',
    redirectTo: ''
  }
];
