import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface UserDeleteDialogData {
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './user-delete-dialog.component.html'
})
export class UserDeleteDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<UserDeleteDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: UserDeleteDialogData
  ) {}

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
