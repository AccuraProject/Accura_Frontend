import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ValidationRuleFormDialogResult {
  name: string;
  dataType: string;
  mandatory: boolean;
  errorMessage: string;
  status: 'Activa' | 'Inactiva' | 'Borrador';
  documentType: string;
  description: string;
}

export interface ValidationRuleFormDialogData {
  mode: 'create' | 'edit';
  rule?: ValidationRuleFormDialogResult;
}

@Component({
  selector: 'app-validation-rule-form-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './validation-rule-form-dialog.component.html',
  styleUrl: './validation-rule-form-dialog.component.scss'
})
export class ValidationRuleFormDialogComponent {
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;
  protected readonly formModel: ValidationRuleFormDialogResult;

  constructor(
    private readonly dialogRef: MatDialogRef<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogResult | undefined
    >,
    @Inject(MAT_DIALOG_DATA) data: ValidationRuleFormDialogData
  ) {
    this.isEditMode = data.mode === 'edit';
    this.title = this.isEditMode ? 'Editar Regla de Validación' : 'Crear Regla de Validación Global';
    this.description = this.isEditMode
      ? 'Actualiza la configuración de la regla global que se asignará a las plantillas.'
      : 'Define una regla global que podrás asignar a columnas de plantillas según su tipo de dato.';
    this.actionLabel = this.isEditMode ? 'Guardar Cambios' : 'Guardar Regla';
    this.formModel = data.rule ? { ...data.rule } : this.createEmptyForm();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    this.dialogRef.close(this.formModel);
  }

  protected get statusLabel(): string {
    switch (this.formModel.status) {
      case 'Activa':
        return 'Activa';
      case 'Borrador':
        return 'Borrador';
      default:
        return 'Inactiva';
    }
  }

  private createEmptyForm(): ValidationRuleFormDialogResult {
    return {
      name: 'Nueva Regla de Validación',
      dataType: 'Texto',
      mandatory: false,
      errorMessage: 'Define el mensaje de error que verán tus usuarios.',
      status: 'Borrador',
      documentType: 'Plantilla Global',
      description: 'Próximamente podrás detallar la configuración de la regla desde este formulario.'
    };
  }
}
