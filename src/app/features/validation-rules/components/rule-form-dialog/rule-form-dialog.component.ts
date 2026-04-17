import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { TextFieldComponent } from '../../../../shared/components/ui/field/text-field/text-field';
import { SelectFieldComponent } from '../../../../shared/components/ui/field/select-field/select-field';
import { RuleExample, RulePayload } from '../../models/rule.model';
import { TextAreaFieldComponent } from '../../../../shared/components/ui/field/textarea-field/textarea-field';
import { ButtonComponent } from '../../../../shared/components/ui/button/button';
import { ValidationRulesService } from '../../validation-rules.service';
import { finalize } from 'rxjs';
import { ToastService } from '../../../../shared/services/toast.service';
import { StepperModule } from 'primeng/stepper';
import { CheckboxFieldComponent } from '../../../../shared/components/ui/field/checkbox-field/checkbox-field';
import { NumberFieldComponent } from '../../../../shared/components/ui/field/number-field/number-field';
import { DateFieldComponent } from '../../../../shared/components/ui/field/date-field/date-field';
import { generateDefaultRuleConfig } from '../../validation-rule-ai.utils';
import { RuleTableEditorComponent } from '../../../../shared/components/data/rule-table-editor/rule-table-editor';
import { FieldsetModule } from 'primeng/fieldset';

interface AiSuggestion {
  id: string;
  payload: RulePayload;
}

export interface RuleFormDialogData {
  mode: 'create' | 'edit';
  rule?: RuleFormDialogResult;
  payload?: RulePayload;
  isActive: boolean;
}

export interface RuleFormDialogResult {
  name: string;
  dataType: string;
  mandatory: boolean;
  status: 'Activa' | 'Inactiva';
  description: string;
  primaryHeader: string;
  secondaryHeaders: string[];
  headerRule: string[];
  exampleEntries: Array<{ key: string; value: string }>;
  ruleConfig: Record<string, unknown>;
}

export interface SaveRuleFormEvent {
  rule: RulePayload;
  isActive: boolean;
}

@Component({
  selector: 'app-rule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    StepperModule,
    SelectModule,
    DialogShellComponent,
    TextFieldComponent,
    NumberFieldComponent,
    TextAreaFieldComponent,
    CheckboxFieldComponent,
    SelectFieldComponent,
    DateFieldComponent,
    ButtonComponent,
    RuleTableEditorComponent,
    FieldsetModule,
  ],
  templateUrl: './rule-form-dialog.component.html',
  styleUrls: ['./rule-form-dialog.component.scss'],
})
export class RuleFormDialogComponent {
  protected isEditMode = false;
  protected isActive = true;
  protected title = 'Crear nueva regla de validación';
  protected description =
    'Define una regla de validación que podrás asignar a columnas de plantillas según su tipo de dato.';
  protected actionLabel = 'Crear regla';

  protected readonly statusOptions = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  protected readonly dateFormatOptions = [
    { label: 'yyyy-MM-dd', value: 'yyyy-MM-dd' },
    { label: 'dd/MM/yyyy', value: 'dd/MM/yyyy' },
    { label: 'MM-dd-yyyy', value: 'MM-dd-yyyy' },
  ];

  private readonly fb = inject(FormBuilder);

  readonly aiForm = this.fb.group({
    description: this.fb.control<string | null>(null, [Validators.required]),
  });

  readonly ruleForm = this.fb.group({
    name: this.fb.control<string | null>(null, [Validators.required]),
    dataType: this.fb.control<string | null>({ value: 'Fecha', disabled: true }, [
      Validators.required,
    ]),
    mandatory: this.fb.control<boolean>(false),
    status: this.fb.control<boolean | null>(true, [Validators.required]),
    description: this.fb.control<string | null>(null),
    headers: this.fb.control<string[]>([]),
    headerRule: this.fb.control<string[]>([]),
    errorMessage: this.fb.control<string | null>(null),
    example: this.fb.control<RuleExample | null>(null),
    validExample: this.fb.control<string | null>(null),
    invalidExample: this.fb.control<string | null>(null),
    rule: this.fb.group({}),
  });

  readonly currentStep = signal<1 | 2>(1);

  readonly isStep1 = computed(() => this.currentStep() === 1);
  readonly isStep2 = computed(() => this.currentStep() === 2);

  readonly saveLabel = computed(() => 'Crear regla');

  readonly isSubmittingAi = signal(false);
  protected aiSuggestion: AiSuggestion | null = null;

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() saveRule = new EventEmitter<SaveRuleFormEvent>();
  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: RuleFormDialogData | null) {
    if (!value) {
      this.resetDialogState();
      return;
    }

    this.isEditMode = value.mode === 'edit';

    this.title = this.isEditMode ? 'Editar regla de validación' : 'Crear nueva regla de validación';
    this.description = this.isEditMode
      ? 'Actualiza la configuración de la regla de validación que se asignará a las plantillas.'
      : 'Define una regla de validación que podrás asignar a columnas de plantillas según su tipo de dato.';
    this.actionLabel = this.isEditMode ? 'Guardar cambios' : 'Crear regla';

    this.aiSuggestion = null;
    this.aiForm.reset({ description: null });

    if (this.isEditMode && value.payload) {
      this.applyRulePayload(value.payload, value.isActive);
      this.currentStep.set(2);
      return;
    }

    this.resetRuleForm();
    this.currentStep.set(1);
  }

  constructor(
    private readonly validationRulesService: ValidationRulesService,
    private readonly toast: ToastService,
  ) {}

  private resetDialogState(): void {
    this.isEditMode = false;
    this.isActive = true;
    this.title = 'Crear nueva regla de validación';
    this.description =
      'Define una regla de validación que podrás asignar a columnas de plantillas según su tipo de dato.';
    this.actionLabel = 'Crear regla';

    this.aiSuggestion = null;

    this.aiForm.reset({ description: null });
    this.resetRuleForm();
    this.currentStep.set(1);
  }

  private resetRuleForm(): void {
    this.ruleForm.reset({
      name: null,
      dataType: 'Texto',
      mandatory: false,
      status: true,
      description: null,
      headers: [],
      headerRule: [],
      errorMessage: null,
      example: {},
      rule: {},
    });
  }

  get ruleGroup(): FormGroup {
    return this.ruleForm.get('rule') as FormGroup;
  }

  getRuleControl(name: string): FormControl {
    return this.ruleGroup.get(name) as FormControl;
  }

  protected submitAiForm(): void {
    if (this.isSubmittingAi()) {
      return;
    }

    if (this.aiForm.invalid) {
      this.aiForm.markAllAsTouched();
      return;
    }

    const rawValue = this.aiForm.getRawValue();
    const description = rawValue.description?.trim() ?? '';

    this.isSubmittingAi.set(true);
    this.aiSuggestion = null;

    this.validationRulesService
      .generateRuleWithAi(description)
      .pipe(finalize(() => this.isSubmittingAi.set(false)))
      .subscribe({
        next: (payloads) => {
          if (payloads.length === 0) {
            this.toast.error('El asistente no devolvió sugerencias para la descripción ingresada.');
            return;
          }

          this.aiSuggestion = {
            id: this.generateSuggestionId(),
            payload: structuredClone(payloads[0]),
          };

          this.applyRulePayload(this.aiSuggestion.payload);

          this.currentStep.set(2);
        },
        error: (error: unknown) => {
          this.aiSuggestion = null;

          const message = this.validationRulesService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  readonly saveDisabled = computed(() => {
    return this.currentStep() !== 2 || this.ruleForm.invalid || this.loading;
  });

  private applyRulePayload(payload: RulePayload, isActive = true): void {
    const dataType = payload['Tipo de dato'] ?? 'Texto';
    const example = payload['Ejemplo'] ?? {};

    this.ruleForm.patchValue({
      name: payload['Nombre de la regla'] ?? null,
      dataType,
      mandatory: payload['Campo obligatorio'] ?? false,
      status: isActive,
      description: payload['Descripción'] ?? null,
      headers: payload['Header'] ?? [],
      headerRule: payload['Header rule'] ?? [],
      errorMessage: payload['Mensaje de error'] ?? null,
      example: payload['Ejemplo'] ?? {},
      validExample: this.stringifyExampleValue(example['Ejemplo válido']),
      invalidExample: this.stringifyExampleValue(example['Ejemplo inválido']),
    });

    this.setRuleConfigByDataType(dataType);

    const ruleConfig = payload['Regla'];
    if (ruleConfig && typeof ruleConfig === 'object') {
      this.ruleGroup.patchValue(ruleConfig);
    } else {
      this.ruleGroup.reset({});
    }
  }

  private stringifyExampleValue(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private parseExampleValue(value: string | null | undefined): unknown {
    const trimmed = value?.trim() ?? '';

    if (!trimmed) {
      return '';
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  private setRuleConfigByDataType(dataType: string): void {
    const ruleGroup = this.createRuleGroup(dataType);
    this.ruleForm.setControl('rule', ruleGroup);
  }

  private createRuleGroup(dataType: string): FormGroup {
    const config = generateDefaultRuleConfig(dataType);

    const controls: Record<string, FormControl> = {};

    Object.entries(config).forEach(([key, value]) => {
      controls[key] = this.fb.control(
        value,
        this.getValidatorsByField(dataType, key),
      ) as FormControl;
    });

    return this.fb.group(controls);
  }

  private getValidatorsByField(dataType: string, key: string): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    // regla general
    validators.push(Validators.required);

    // reglas específicas por tipo
    if (dataType === 'Texto') {
      if (key === 'Longitud mínima' || key === 'Longitud máxima') {
        validators.push(Validators.min(0));
      }
    }

    if (dataType === 'Número') {
      if (key === 'Número de decimales') {
        validators.push(Validators.min(0));
        validators.push(Validators.max(10));
      }
    }

    if (dataType === 'Correo') {
      if (key === 'Formato') {
        validators.push(Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
      }
    }

    if (dataType === 'Fecha') {
      if (key === 'Formato') {
        validators.push(Validators.required);
      }
    }

    return validators;
  }

  private generateSuggestionId(): string {
    return `ai-suggestion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getTableColumns(): string[] {
    const dataType = this.ruleForm.controls.dataType.getRawValue();

    if (dataType === 'Lista' || dataType === 'Lista compleja' || dataType === 'Dependencia') {
      const headers = this.ruleForm.controls.headers.getRawValue() ?? [];
      return headers.length ? headers : ['Lista'];
    }

    return [];
  }

  getTableRows(): Record<string, string>[] {
    const dataType = this.ruleForm.controls.dataType.getRawValue();
    const rawRule = this.ruleGroup.getRawValue();
    const columns = this.getTableColumns();

    if (dataType === 'Lista') {
      const firstColumn = columns[0] ?? 'Lista';
      const values = Array.isArray(rawRule['Lista']) ? rawRule['Lista'] : [];

      return values.map((value: string) => ({
        [firstColumn]: value,
      }));
    }

    if (dataType === 'Lista compleja') {
      const values = Array.isArray(rawRule['Lista compleja']) ? rawRule['Lista compleja'] : [];

      return values.map((row: Record<string, unknown>) =>
        columns.reduce(
          (acc, column) => {
            acc[column] = typeof row?.[column] === 'string' ? row[column] : '';
            return acc;
          },
          {} as Record<string, string>,
        ),
      );
    }

    if (dataType === 'Dependencia') {
      const values = Array.isArray(rawRule['reglas especifica'])
        ? rawRule['reglas especifica']
        : [];

      return this.mapDependencyRuleToRows(values, columns);
    }

    return [];
  }

  updateTableRows(rows: Record<string, string>[]): void {
    const dataType = this.ruleForm.controls.dataType.getRawValue();
    const columns = this.getTableColumns();

    if (dataType === 'Lista') {
      const firstColumn = columns[0] ?? 'Lista';
      const values = rows
        .map((row) => row[firstColumn]?.trim() ?? '')
        .filter((value) => value.length > 0);

      this.getRuleControl('Lista').setValue(values);
      this.getRuleControl('Lista').markAsDirty();
      this.getRuleControl('Lista').markAsTouched();
      return;
    }

    if (dataType === 'Lista compleja') {
      const normalizedRows = rows.map((row) =>
        columns.reduce(
          (acc, column) => {
            acc[column] = row[column]?.trim() ?? '';
            return acc;
          },
          {} as Record<string, string>,
        ),
      );

      this.getRuleControl('Lista compleja').setValue(normalizedRows);
      this.getRuleControl('Lista compleja').markAsDirty();
      this.getRuleControl('Lista compleja').markAsTouched();
      return;
    }

    if (dataType === 'Dependencia') {
      const normalizedRows = this.mapRowsToDependencyRule(rows, columns);

      this.getRuleControl('reglas especifica').setValue(normalizedRows);
      this.getRuleControl('reglas especifica').markAsDirty();
      this.getRuleControl('reglas especifica').markAsTouched();
      return;
    }
  }

  private mapDependencyRuleToRows(
    values: Record<string, unknown>[],
    columns: string[],
  ): Record<string, string>[] {
    const [sourceColumn, targetColumn] = columns;

    if (!sourceColumn || !targetColumn) {
      return [];
    }

    return values.map((row) => {
      const sourceValue = typeof row?.[sourceColumn] === 'string' ? row[sourceColumn] : '';

      const lista = row?.['Lista'];
      let targetValue = '';

      if (lista && typeof lista === 'object' && !Array.isArray(lista)) {
        const nestedValues = (lista as Record<string, unknown>)[targetColumn];

        if (Array.isArray(nestedValues)) {
          targetValue = nestedValues
            .filter((item): item is string => typeof item === 'string')
            .join(', ');
        }
      }

      return {
        [sourceColumn]: sourceValue,
        [targetColumn]: targetValue,
      };
    });
  }

  private mapRowsToDependencyRule(
    rows: Record<string, string>[],
    columns: string[],
  ): Record<string, unknown>[] {
    const [sourceColumn, targetColumn] = columns;

    if (!sourceColumn || !targetColumn) {
      return [];
    }

    return rows
      .map((row): Record<string, unknown> & { Lista: Record<string, string[]> } => {
        const sourceValue = row[sourceColumn]?.trim() ?? '';
        const rawTargetValue = row[targetColumn]?.trim() ?? '';

        const targetValues = rawTargetValue
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);

        return {
          [sourceColumn]: sourceValue,
          Lista: {
            [targetColumn]: targetValues,
          },
        };
      })
      .filter((row) => {
        const sourceValue = row[sourceColumn] as string;
        const nestedValues = row.Lista[targetColumn] as string[];

        return sourceValue.length > 0 && nestedValues.length > 0;
      });
  }

  protected submitRuleForm(): void {
    if (this.loading) {
      return;
    }

    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }

    const rawValue = this.ruleForm.getRawValue();

    const payload: SaveRuleFormEvent = {
      rule: {
        'Nombre de la regla': rawValue.name ?? '',
        'Tipo de dato': rawValue.dataType ?? '',
        'Campo obligatorio': rawValue.mandatory ?? true,
        Header: rawValue.headers ?? [],
        'Header rule': rawValue.headerRule ?? [],
        'Mensaje de error': rawValue.errorMessage ?? '',
        Descripción: rawValue.description ?? '',
        Ejemplo: {
          'Ejemplo válido': this.parseExampleValue(rawValue.validExample),
          'Ejemplo inválido': this.parseExampleValue(rawValue.invalidExample),
        },
        Regla: rawValue.rule,
      },
      isActive: rawValue.status ?? true,
    };

    this.saveRule.emit(payload);
  }

  protected cancel(): void {
    if (this.isSubmittingAi() || this.loading) {
      return;
    }

    this.cancelDialog.emit();
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
