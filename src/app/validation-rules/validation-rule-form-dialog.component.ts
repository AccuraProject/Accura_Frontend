import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ValidationRuleFormDialogResult {
  name: string;
  dataType: string;
  mandatory: boolean;
  errorMessage: string;
  status: 'Activa' | 'Inactiva' | 'Borrador';
  documentType: string;
  description: string;
  secondaryHeaders: string[];
  exampleEntries: Array<{ key: string; value: string }>;
  ruleConfig: Record<string, unknown>;
}

export interface ValidationRuleFormDialogData {
  mode: 'create' | 'edit';
  rule?: ValidationRuleFormDialogResult;
}

@Component({
  selector: 'app-validation-rule-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './validation-rule-form-dialog.component.html',
  styleUrl: './validation-rule-form-dialog.component.scss'
})
export class ValidationRuleFormDialogComponent {
  protected readonly isEditMode: boolean;
  protected readonly title: string;
  protected readonly description: string;
  protected readonly actionLabel: string;
  protected readonly formModel: ValidationRuleFormDialogResult;
  protected readonly dataTypeOptions: string[] = [
    'Texto',
    'Número',
    'Documento',
    'Lista',
    'Lista compleja',
    'Telefono',
    'Correo',
    'Fecha',
    'Dependencia',
    'Validación conjunta',
    'Duplicados'
  ];
  protected readonly statusOptions: Array<ValidationRuleFormDialogResult['status']> = [
    'Activa',
    'Inactiva',
    'Borrador'
  ];

  protected secondaryHeaderDraft = '';
  protected listItemDraft = '';
  protected jointFieldDraft = '';
  protected duplicateFieldDraft = '';
  protected advancedConfigText = '';
  protected advancedConfigError: string | null = null;

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
    this.formModel = data.rule ? this.cloneRule(data.rule) : this.createEmptyForm();
    this.ensureCollections();
    this.updateAdvancedConfigText();
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (!this.canSave) {
      return;
    }

    const documentType = this.formModel.documentType.trim() || 'Plantilla Global';
    const secondaryHeaders = this.formModel.secondaryHeaders
      .map((item) => item.trim())
      .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index && item !== documentType);

    const exampleEntries = this.formModel.exampleEntries
      .map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
      .filter((entry) => entry.key.length > 0 || entry.value.length > 0);

    const result: ValidationRuleFormDialogResult = {
      ...this.formModel,
      name: this.formModel.name.trim(),
      errorMessage: this.formModel.errorMessage.trim(),
      description: this.formModel.description.trim(),
      documentType,
      secondaryHeaders,
      exampleEntries,
      ruleConfig: JSON.parse(JSON.stringify(this.formModel.ruleConfig)) as Record<string, unknown>
    };

    this.dialogRef.close(result);
  }

  protected get canSave(): boolean {
    if (!this.formModel.name.trim() || !this.formModel.errorMessage.trim()) {
      return false;
    }

    if (!this.formModel.documentType.trim()) {
      return false;
    }

    if (this.advancedConfigError) {
      return false;
    }

    switch (this.formModel.dataType) {
      case 'Lista':
        return this.listValues.length > 0;
      case 'Validación conjunta':
        return this.jointFieldValues.length > 0;
      case 'Duplicados':
        return this.duplicateFieldValues.length > 0;
      default:
        return true;
    }
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  protected onDataTypeChange(): void {
    this.formModel.ruleConfig = this.createDefaultRuleConfig(this.formModel.dataType);
    this.listItemDraft = '';
    this.jointFieldDraft = '';
    this.duplicateFieldDraft = '';
    this.updateAdvancedConfigText();
  }

  protected addSecondaryHeader(): void {
    const value = this.secondaryHeaderDraft.trim();
    if (!value) {
      return;
    }

    if (!this.formModel.secondaryHeaders.includes(value) && value !== this.formModel.documentType.trim()) {
      this.formModel.secondaryHeaders.push(value);
    }

    this.secondaryHeaderDraft = '';
  }

  protected removeSecondaryHeader(index: number): void {
    this.formModel.secondaryHeaders.splice(index, 1);
  }

  protected addListValue(): void {
    const value = this.listItemDraft.trim();
    if (!value) {
      return;
    }

    const values = this.listValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Lista'] = values;
    this.listItemDraft = '';
  }

  protected removeListValue(index: number): void {
    const values = this.listValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Lista'] = values;
  }

  protected addJointField(): void {
    const value = this.jointFieldDraft.trim();
    if (!value) {
      return;
    }

    const values = this.jointFieldValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Nombre de campos'] = values;
    this.jointFieldDraft = '';
  }

  protected removeJointField(index: number): void {
    const values = this.jointFieldValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Nombre de campos'] = values;
  }

  protected addDuplicateField(): void {
    const value = this.duplicateFieldDraft.trim();
    if (!value) {
      return;
    }

    const values = this.duplicateFieldValues;
    if (!values.includes(value)) {
      values.push(value);
    }

    this.formModel.ruleConfig['Campos'] = values;
    this.duplicateFieldDraft = '';
  }

  protected removeDuplicateField(index: number): void {
    const values = this.duplicateFieldValues;
    values.splice(index, 1);
    this.formModel.ruleConfig['Campos'] = values;
  }

  protected toggleIgnoreEmpty(value: boolean): void {
    this.formModel.ruleConfig['Ignorar vacios'] = value;
  }

  protected get listValues(): string[] {
    const values = this.formModel.ruleConfig['Lista'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  }

  protected get jointFieldValues(): string[] {
    const values = this.formModel.ruleConfig['Nombre de campos'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  }

  protected get duplicateFieldValues(): string[] {
    const values = this.formModel.ruleConfig['Campos'];
    return Array.isArray(values)
      ? (values as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
  }

  protected get ignoreEmptyDuplicates(): boolean {
    return Boolean(this.formModel.ruleConfig['Ignorar vacios']);
  }

  protected addExampleEntry(): void {
    this.formModel.exampleEntries.push({ key: '', value: '' });
  }

  protected removeExampleEntry(index: number): void {
    this.formModel.exampleEntries.splice(index, 1);
  }

  protected hasExampleEntries(): boolean {
    return this.formModel.exampleEntries.length > 0;
  }

  protected get ruleConfig(): Record<string, any> {
    return this.formModel.ruleConfig as Record<string, any>;
  }

  protected showAdvancedConfig(): boolean {
    return ['Lista compleja', 'Dependencia'].includes(this.formModel.dataType);
  }

  protected onAdvancedConfigChange(value: string): void {
    this.advancedConfigText = value;

    const key = this.formModel.dataType === 'Lista compleja' ? 'Lista compleja' : 'reglas especifica';

    if (!value.trim()) {
      this.formModel.ruleConfig[key] = [];
      this.advancedConfigError = null;
      return;
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error('El contenido debe ser un arreglo JSON.');
      }

      this.formModel.ruleConfig[key] = parsed;
      this.advancedConfigError = null;
    } catch (error) {
      console.error('[ValidationRuleFormDialog] Error al procesar la configuración avanzada:', error);
      this.advancedConfigError = 'Ingresa un arreglo JSON válido.';
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
      description: 'Describe la regla para que otros usuarios entiendan su propósito.',
      secondaryHeaders: [],
      exampleEntries: [],
      ruleConfig: this.createDefaultRuleConfig('Texto')
    };
  }

  private cloneRule(rule: ValidationRuleFormDialogResult): ValidationRuleFormDialogResult {
    return {
      ...rule,
      secondaryHeaders: [...(rule.secondaryHeaders ?? [])],
      exampleEntries: (rule.exampleEntries ?? []).map((entry) => ({ ...entry })),
      ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig ?? {})) as Record<string, unknown>
    };
  }

  private ensureCollections(): void {
    if (!Array.isArray(this.formModel.secondaryHeaders)) {
      this.formModel.secondaryHeaders = [];
    }

    if (!Array.isArray(this.formModel.exampleEntries)) {
      this.formModel.exampleEntries = [];
    }
  }

  private updateAdvancedConfigText(): void {
    if (this.formModel.dataType === 'Lista compleja') {
      const value = this.formModel.ruleConfig['Lista compleja'];
      this.advancedConfigText = JSON.stringify(Array.isArray(value) ? value : [], null, 2);
      this.advancedConfigError = null;
      return;
    }

    if (this.formModel.dataType === 'Dependencia') {
      const value = this.formModel.ruleConfig['reglas especifica'];
      this.advancedConfigText = JSON.stringify(Array.isArray(value) ? value : [], null, 2);
      this.advancedConfigError = null;
      return;
    }

    this.advancedConfigText = '';
    this.advancedConfigError = null;
  }

  private createDefaultRuleConfig(dataType: string): Record<string, unknown> {
    switch (dataType) {
      case 'Texto':
        return { 'Longitud minima': 0, 'Longitud maxima': 0 };
      case 'Número':
        return { 'Valor mínimo': null, 'Valor máximo': null, 'Número de decimales': 0 };
      case 'Documento':
        return { 'Longitud minima': 1, 'Longitud maxima': 1 };
      case 'Lista':
        return { Lista: [] };
      case 'Lista compleja':
        return { 'Lista compleja': [] };
      case 'Telefono':
        return { 'Longitud minima': 1, 'Código de país': '+00' };
      case 'Correo':
        return { Formato: 'usuario@dominio.com', 'Longitud máxima': 1 };
      case 'Fecha':
        return { Formato: 'yyyy-MM-dd', 'Fecha mínima': '1900-01-01', 'Fecha máxima': '2100-12-31' };
      case 'Dependencia':
        return { 'reglas especifica': [] };
      case 'Validación conjunta':
        return { 'Nombre de campos': [] };
      case 'Duplicados':
        return { Campos: [], 'Ignorar vacios': false };
      default:
        return {};
    }
  }
}
