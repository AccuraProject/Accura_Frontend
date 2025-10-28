import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface TemplateFormDialogData {
  mode: 'create' | 'edit';
  template?: TemplateFormDialogResult;
}

export interface TemplateFormDialogResult {
  name: string;
  description: string;
}

@Component({
  selector: 'app-template-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './template-form-dialog.component.html',
  styleUrl: './template-form-dialog.component.scss'
})
export class TemplateFormDialogComponent {
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;

  protected formModel: TemplateFormDialogResult;

  constructor(
    private readonly dialogRef: MatDialogRef<TemplateFormDialogComponent, TemplateFormDialogResult>,
    @Inject(MAT_DIALOG_DATA) data: TemplateFormDialogData
  ) {
    this.isEditMode = data.mode === 'edit';
    this.title = this.isEditMode ? 'Editar Plantilla' : 'Crear Nueva Plantilla';
    this.description = this.isEditMode
      ? 'Actualiza la información básica de la plantilla.'
      : 'Define la estructura inicial de tu nueva plantilla.';
    this.actionLabel = this.isEditMode ? 'Guardar Cambios' : 'Crear Plantilla';

    this.formModel = data.template ? { ...data.template } : { name: '', description: '' };
  }

  protected submit(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      name: this.formModel.name.trim(),
      description: this.formModel.description.trim()
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
