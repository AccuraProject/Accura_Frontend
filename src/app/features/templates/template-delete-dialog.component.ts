import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface TemplateDeleteDialogData {
  name: string;
}

@Component({
  selector: 'app-template-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './template-delete-dialog.component.html'
})
export class TemplateDeleteDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<TemplateDeleteDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: TemplateDeleteDialogData
  ) {}

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
