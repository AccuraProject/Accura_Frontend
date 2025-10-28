import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  ValidationRuleFormDialogComponent,
  ValidationRuleFormDialogData,
  ValidationRuleFormDialogResult
} from './validation-rule-form-dialog.component';
import {
  ValidationRuleDeleteDialogComponent,
  ValidationRuleDeleteDialogData
} from './validation-rule-delete-dialog.component';

interface ValidationRule {
  id: string;
  name: string;
  dataType: string;
  mandatory: boolean;
  errorMessage: string;
  status: 'Activa' | 'Inactiva' | 'Borrador';
  documentType: string;
  description: string;
}

@Component({
  selector: 'app-validation-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './validation-rules.component.html',
  styleUrl: './validation-rules.component.scss'
})
export class ValidationRulesComponent {
  protected searchTerm = '';

  protected rules: ValidationRule[] = [
    {
      id: 'pricing-rule',
      name: 'Validación de Precio',
      dataType: 'Número',
      mandatory: true,
      errorMessage: 'El precio debe estar entre 0 y 10,000 con 2 decimales',
      status: 'Activa',
      documentType: 'Catálogo de Productos',
      description:
        'Verifica que el precio ingresado se encuentre dentro del rango permitido y con el número de decimales adecuado.'
    },
    {
      id: 'dni-rule',
      name: 'Validación de DNI',
      dataType: 'Texto',
      mandatory: true,
      errorMessage: 'El DNI debe tener exactamente 8 dígitos',
      status: 'Activa',
      documentType: 'Documentos de Identidad',
      description: 'Controla que el número de documento tenga la cantidad exacta de dígitos requerida.'
    },
    {
      id: 'doc-type-rule',
      name: 'Tipo de Documento',
      dataType: 'Lista',
      mandatory: false,
      errorMessage: 'Selecciona un tipo de documento válido',
      status: 'Inactiva',
      documentType: 'Documentos de Identidad',
      description: 'Limita la selección del tipo de documento a los valores permitidos por el área legal.'
    },
    {
      id: 'address-rule',
      name: 'Dirección Completa',
      dataType: 'Texto',
      mandatory: true,
      errorMessage: 'La dirección debe contener al menos 12 caracteres',
      status: 'Borrador',
      documentType: 'Clientes',
      description: 'Verifica que la dirección incluya el detalle mínimo requerido para despachos.'
    }
  ];

  constructor(private readonly dialog: MatDialog) {}

  protected get filteredRules(): ValidationRule[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.rules;
    }

    return this.rules.filter((rule) => {
      return (
        rule.name.toLowerCase().includes(term) ||
        rule.dataType.toLowerCase().includes(term) ||
        rule.status.toLowerCase().includes(term) ||
        rule.documentType.toLowerCase().includes(term)
      );
    });
  }

  protected get totalRules(): number {
    return this.rules.length;
  }

  protected get activeRules(): number {
    return this.rules.filter((rule) => rule.status === 'Activa').length;
  }

  protected get dataTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.dataType)).size;
  }

  protected get documentTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.documentType)).size;
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogData,
      ValidationRuleFormDialogResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
      data: {
        mode: 'create'
      }
    });

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.addRule(result);
    });
  }

  protected openEditDialog(rule: ValidationRule): void {
    const dialogRef = this.dialog.open<
      ValidationRuleFormDialogComponent,
      ValidationRuleFormDialogData,
      ValidationRuleFormDialogResult
    >(ValidationRuleFormDialogComponent, {
      disableClose: true,
      data: {
        mode: 'edit',
        rule: { ...rule }
      }
    });

    dialogRef.afterClosed().subscribe((result: ValidationRuleFormDialogResult | undefined) => {
      if (!result) {
        return;
      }

      this.updateRule(rule.id, result);
    });
  }

  protected openDeleteDialog(rule: ValidationRule): void {
    const dialogRef = this.dialog.open<
      ValidationRuleDeleteDialogComponent,
      ValidationRuleDeleteDialogData,
      boolean
    >(ValidationRuleDeleteDialogComponent, {
      disableClose: true,
      data: {
        name: rule.name,
        documentType: rule.documentType
      }
    });

    dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
      if (!shouldDelete) {
        return;
      }

      this.removeRule(rule.id);
    });
  }

  protected trackByRuleId(_: number, rule: ValidationRule): string {
    return rule.id;
  }

  protected mandatoryLabel(rule: ValidationRule): string {
    return rule.mandatory ? 'Sí' : 'No';
  }

  protected statusClass(status: ValidationRule['status']): string {
    switch (status) {
      case 'Activa':
        return 'badge--active';
      case 'Borrador':
        return 'badge--draft';
      default:
        return 'badge--inactive';
    }
  }

  private addRule(result: ValidationRuleFormDialogResult): void {
    const entry: ValidationRule = {
      id: this.generateId(),
      name: result.name.trim(),
      dataType: result.dataType,
      mandatory: result.mandatory,
      errorMessage: result.errorMessage,
      status: result.status,
      documentType: result.documentType,
      description: result.description
    };

    this.rules = [entry, ...this.rules];
  }

  private updateRule(ruleId: string, result: ValidationRuleFormDialogResult): void {
    this.rules = this.rules.map((rule) => {
      if (rule.id !== ruleId) {
        return rule;
      }

      return {
        ...rule,
        name: result.name.trim(),
        dataType: result.dataType,
        mandatory: result.mandatory,
        errorMessage: result.errorMessage,
        status: result.status,
        documentType: result.documentType,
        description: result.description
      };
    });
  }

  private removeRule(ruleId: string): void {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
  }

  private generateId(): string {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
