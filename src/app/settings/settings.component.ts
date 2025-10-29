import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  SettingsManageUserDialogComponent,
  SettingsManageUserDialogResult
} from './settings-manage-user-dialog.component';

export interface ManagedUser {
  name: string;
  username: string;
  email: string;
  role: 'Administrador' | 'Cliente';
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatDialogModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  protected readonly personalInfoForm: FormGroup;
  protected readonly changePasswordForm: FormGroup;

  protected readonly users: ManagedUser[] = [
    { name: 'Administrador', username: 'admin', email: 'deviyadsegh@gmail.com', role: 'Administrador' },
    { name: 'Gwyneth', username: 'gwyneth', email: 'gwyneth@gmail.com', role: 'Administrador' },
    { name: 'Cliente 1', username: 'cliente1', email: 'cliente1@gmail.com', role: 'Cliente' },
    { name: 'Cliente 2', username: 'cliente2', email: 'cliente2@gmail.com', role: 'Cliente' }
  ];

  protected searchTerm = '';

  constructor(private readonly formBuilder: FormBuilder, private readonly dialog: MatDialog) {
    this.personalInfoForm = this.formBuilder.group({
      fullName: ['Administrador', [Validators.required]],
      role: ['admin', [Validators.required]],
      email: ['deviyadsegh@gmail.com', [Validators.required, Validators.email]]
    });

    this.changePasswordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  protected get filteredUsers(): ManagedUser[] {
    const query = this.searchTerm.toLowerCase().trim();

    if (!query) {
      return this.users;
    }

    return this.users.filter((user) =>
      [user.name, user.username, user.email, user.role].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }

  protected submitPersonalInfo(): void {
    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }

    // Placeholder for future integration
    console.info('Actualizar información personal', this.personalInfoForm.value);
  }

  protected submitChangePassword(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    console.info('Actualizar contraseña', this.changePasswordForm.value);
    this.changePasswordForm.reset();
  }

  protected openManageDialog(user: ManagedUser): void {
    this.dialog
      .open(SettingsManageUserDialogComponent, {
        width: '540px',
        data: { user },
        autoFocus: false
      })
      .afterClosed()
      .subscribe((result: SettingsManageUserDialogResult | undefined) => {
        if (!result) {
          return;
        }

        if (result.action === 'password') {
          console.info('Actualizar contraseña de usuario', result);
        }

        if (result.action === 'email') {
          console.info('Actualizar correo de usuario', result);
        }
      });
  }

  protected trackByUsername(_: number, user: ManagedUser): string {
    return user.username;
  }

  protected userInitials(user: ManagedUser): string {
    return user.name
      .split(' ')
      .filter((part) => !!part)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
