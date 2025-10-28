import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface UserFormDialogData {
  roles: string[];
  statuses: string[];
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

  protected formModel: UserFormDialogResult = this.getEmptyForm();

  constructor(
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent, UserFormDialogResult>,
    @Inject(MAT_DIALOG_DATA) data: UserFormDialogData
  ) {
    this.roles = data.roles;
    this.statuses = data.statuses;
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
    form.resetForm(this.getEmptyForm());
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
