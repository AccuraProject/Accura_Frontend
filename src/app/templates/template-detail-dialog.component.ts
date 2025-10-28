import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface TemplateDetailDialogData {
  name: string;
  description: string;
  version: string;
  status: string;
  lastUpdated: string;
  createdAt: string;
  columns: number;
}

@Component({
  selector: 'app-template-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './template-detail-dialog.component.html',
  styleUrl: './template-detail-dialog.component.scss'
})
export class TemplateDetailDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) protected readonly data: TemplateDetailDialogData) {}
}
