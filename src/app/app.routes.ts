import { Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UsersComponent } from './users/users.component';
import { ValidationRulesComponent } from './validation-rules/validation-rules.component';
import { PermissionsComponent } from './permissions/permissions.component';
import { TemplateManagementComponent } from './templates/template-management.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', component: DashboardComponent },
      { path: 'usuarios', component: UsersComponent },
      { path: 'reglas-validacion', component: ValidationRulesComponent },
      { path: 'permisos', component: PermissionsComponent },
      { path: 'plantillas', component: TemplateManagementComponent },
    ]
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
