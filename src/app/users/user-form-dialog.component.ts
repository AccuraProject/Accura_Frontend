import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface UserFormDialogData {
  roles: UserRoleOption[];
  mode?: 'create' | 'edit';
  user?: UserFormDialogValue;
}

export interface UserRoleOption {
  id: number;
  label: string;
}

export interface UserFormDialogValue {
  name: string;
  email: string;
  roleId: number;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './user-form-dialog.component.html'
})
export class UserFormDialogComponent {
  protected readonly roles: UserRoleOption[];
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;

  protected formModel: UserFormDialogModel;

  constructor(
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent, UserFormDialogValue>,
    @Inject(MAT_DIALOG_DATA) data: UserFormDialogData
  ) {
    this.roles = data.roles;
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

    if (this.formModel.roleId === null) {
      form.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      name: this.formModel.name.trim(),
      email: this.formModel.email.trim(),
      roleId: this.formModel.roleId
    });
  }

  protected cancel(form: NgForm): void {
    this.dialogRef.close();
  }

  private getEmptyForm(): UserFormDialogModel {
    return {
      name: '',
      email: '',
      roleId: null
    };
  }
}

interface UserFormDialogModel {
  name: string;
  email: string;
  roleId: number | null;
}
