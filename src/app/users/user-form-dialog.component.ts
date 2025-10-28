import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface UserFormDialogData {
  roles: string[];
  statuses: string[];
  mode?: 'create' | 'edit';
  user?: UserFormDialogResult;
}

export interface UserFormDialogResult {
  name: string;
  email: string;
  role: string;
  status: string;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './user-form-dialog.component.html'
})
export class UserFormDialogComponent {
  protected readonly roles: string[];
  protected readonly statuses: string[];
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;

  protected formModel: UserFormDialogResult;

  constructor(
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent, UserFormDialogResult>,
    @Inject(MAT_DIALOG_DATA) data: UserFormDialogData
  ) {
    this.roles = data.roles;
    this.statuses = data.statuses;
    this.isEditMode = data.mode === 'edit';

    this.title = this.isEditMode ? 'Editar Usuario' : 'Crear Nuevo Usuario';
    this.description = this.isEditMode
      ? 'Actualiza los datos del usuario seleccionado.'
      : 'Completa los datos del nuevo usuario para agregarlo a la plataforma.';
    this.actionLabel = this.isEditMode ? 'Guardar Cambios' : 'Crear Usuario';

    this.formModel = data.user ? { ...data.user } : this.getEmptyForm();
  }

  protected submit(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      name: this.formModel.name.trim(),
      email: this.formModel.email.trim(),
      role: this.formModel.role,
      status: this.formModel.status
    });
  }

  protected cancel(form: NgForm): void {
    this.dialogRef.close();
  }

  private getEmptyForm(): UserFormDialogResult {
    return {
      name: '',
      email: '',
      role: '',
      status: ''
    };
  }
}
