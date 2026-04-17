import { Routes } from '@angular/router';

import { LoginComponent } from './features/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { UsersComponent } from './features/users/users.component';
import { ValidationRulesComponent } from './features/validation-rules/validation-rules.component';
import { PermissionsComponent } from './features/permissions/permissions.component';
import { HistoryComponent } from './features/history/history.component';
import { SettingsComponent } from './features/settings/settings.component';
import { authGuard } from './core/guards/auth.guard';
import { PasswordUpdateComponent } from './features/password-update/password-update.component';
import { passwordUpdateGuard } from './core/guards/password-update.guard';
import { loginRedirectGuard } from './core/guards/login-redirect.guard';
import { ForgotPasswordComponent } from './features/forgot-password/forgot-password.component';
import { TemplateLayoutComponent } from './features/templates/template-layout.component';

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
      { path: 'plantillas', component: TemplateLayoutComponent, data: { roles: ['admin', 'user'] } },
      { path: 'historial', component: HistoryComponent, data: { roles: ['admin', 'user'] } },
      { path: 'configuracion', component: SettingsComponent, data: { roles: ['admin', 'user'] } },
    ]
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginRedirectGuard],
  },
  {
    path: 'recuperar-contrasena',
    component: ForgotPasswordComponent,
    canActivate: [loginRedirectGuard],
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
