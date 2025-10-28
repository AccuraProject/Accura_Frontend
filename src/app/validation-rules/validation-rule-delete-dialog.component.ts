import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ValidationRuleDeleteDialogData {
  name: string;
  documentType: string;
}

@Component({
  selector: 'app-validation-rule-delete-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './validation-rule-delete-dialog.component.html'
})
export class ValidationRuleDeleteDialogComponent {
  constructor(
    private readonly dialogRef: MatDialogRef<ValidationRuleDeleteDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) protected readonly data: ValidationRuleDeleteDialogData
  ) {}

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
