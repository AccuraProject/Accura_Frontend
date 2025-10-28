import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import type { ManagedUser } from './settings.component';

export interface SettingsManageUserDialogData {
  user: ManagedUser;
}

export type SettingsManageUserDialogResult =
  | { action: 'password'; user: ManagedUser; newPassword: string }
  | { action: 'email'; user: ManagedUser; email: string };

@Component({
  selector: 'app-settings-manage-user-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './settings-manage-user-dialog.component.html',
  styleUrl: './settings-manage-user-dialog.component.scss'
})
export class SettingsManageUserDialogComponent {
  protected readonly user: ManagedUser;
  protected readonly passwordForm: FormGroup;
  protected readonly emailForm: FormGroup;
  protected passwordMismatch = false;

  constructor(
    private readonly dialogRef: MatDialogRef<
      SettingsManageUserDialogComponent,
      SettingsManageUserDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) data: SettingsManageUserDialogData,
    private readonly formBuilder: FormBuilder
  ) {
    this.user = data.user;
    this.passwordForm = this.formBuilder.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
    this.emailForm = this.formBuilder.group({
      email: [this.user.email, [Validators.required, Validators.email]]
    });
  }

  protected submitPassword(): void {
    this.passwordMismatch = false;

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const newPassword = this.passwordForm.get('newPassword')?.value as string | null;
    const confirmPassword = this.passwordForm.get('confirmPassword')?.value as string | null;

    if (!newPassword || !confirmPassword) {
      return;
    }

    if (newPassword !== confirmPassword) {
      this.passwordMismatch = true;
      this.passwordForm.get('confirmPassword')?.markAsTouched();
      return;
    }

    this.dialogRef.close({
      action: 'password',
      user: this.user,
      newPassword
    });
  }

  protected submitEmail(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const email = (this.emailForm.get('email')?.value as string | null)?.trim();

    if (!email) {
      return;
    }

    this.dialogRef.close({
      action: 'email',
      user: this.user,
      email
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected showFieldError(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  protected get initials(): string {
    return this.user.name
      .split(' ')
      .filter((part) => !!part)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
}
