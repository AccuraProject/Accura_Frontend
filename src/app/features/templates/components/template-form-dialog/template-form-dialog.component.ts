import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  inject,
  Inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { read, utils, writeFileXLSX } from 'xlsx';

import { ValidationRulesService } from '../../../validation-rules/validation-rules.service';
import {
  TemplateCreatePayload,
  TemplateColumnPayload,
  TemplateColumnResponse,
  TemplateColumnRulePayload,
  TemplateResponse,
  TemplatesService,
} from '../../templates.service';
import { StepperModule } from 'primeng/stepper';
import { TextFieldComponent } from '../../../../shared/components/ui/field/text-field/text-field';
import { TextAreaFieldComponent } from '../../../../shared/components/ui/field/textarea-field/textarea-field';
import { ToastService } from '../../../../shared/services/toast.service';
import { finalize } from 'rxjs';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { ButtonComponent } from '../../../../shared/components/ui/button/button';
import {
  ColumnRowForm,
  ColumnRuleForm,
  Step2Form,
  TemplateRuleOption,
} from '../../models/template-columns-editor';
import { TemplateColumnsEditorComponent } from '../../../../shared/components/data/template-columns-editor/template-columns-editor';
import { RuleResponse } from '../../../validation-rules/models/rule.model';

export interface TemplateCreateDialogResult {
  template: TemplateResponse;
  columns: TemplateColumnResponse[];
}

export interface SaveTemplateColumnsEvent {
  templateId: number | null;
  columns: TemplateColumnPayload[];
}

export interface TemplateDialogData {
  mode: 'create' | 'edit';
  template?: TemplateResponse;
  columns?: TemplateColumnResponse[];
}

@Component({
  selector: 'app-template-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    ReactiveFormsModule,
    DialogShellComponent,
    StepperModule,
    TextFieldComponent,
    TextAreaFieldComponent,
    ButtonComponent,
    TemplateColumnsEditorComponent,
  ],
  templateUrl: './template-form-dialog.component.html',
  styleUrl: './template-form-dialog.component.scss',
})
export class TemplateFormDialogComponent {
  protected isEditMode = false;

  protected title = 'Crear nueva plantilla';
  protected description =
    'Configura la estructura de la plantilla que los usuarios utilizarán para cargar y validar sus datos.';
  protected actionLabel = 'Crear plantilla';

  protected templateId: number | null = null;

  private readonly fb = inject(FormBuilder);

  readonly step1Form = this.fb.group({
    name: this.fb.control<string | null>(null, [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
    ]),
    tableName: this.fb.control<string | null>(null, [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50),
    ]),
    description: this.fb.control<string | null>(null, [Validators.maxLength(200)]),
  });

  readonly step2Form: Step2Form = this.fb.group({
    columns: this.fb.array<ColumnRowForm>([]),
  });

  readonly currentStep = signal<1 | 2>(1);

  readonly isStep1 = computed(() => this.currentStep() === 1);
  readonly isStep2 = computed(() => this.currentStep() === 2);

  readonly saveLabel = computed(() => 'Crear plantilla');

  readonly isSubmittingStep1 = signal(false);
  readonly isImportingColumns = signal(false);

  protected ruleOptions: TemplateRuleOption[] = [];
  protected rulesLoading = false;
  protected rulesError: string | null = null;

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() saveTemplate = new EventEmitter<SaveTemplateColumnsEvent>();
  @Output() cancelDialog = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: TemplateDialogData | null) {
    if (!value) {
      this.resetDialogState();
      return;
    }

    this.isEditMode = value.mode === 'edit';
    this.currentStep.set(1);

    if (this.isEditMode && value.template) {
      this.templateId = value.template.id ?? null;

      this.title = 'Editar plantilla';
      this.description =
        'Actualiza la información general de la plantilla antes de configurar sus columnas.';
      this.actionLabel = 'Guardar cambios';

      this.step1Form.reset({
        name: value.template.name ?? null,
        tableName: value.template.table_name ?? null,
        description: value.template.description ?? null,
      });
    } else {
      this.templateId = null;

      this.title = 'Crear nueva plantilla';
      this.description =
        'Configura la estructura de la plantilla que los usuarios utilizarán para cargar y validar sus datos.';
      this.actionLabel = 'Crear plantilla';

      this.step1Form.reset({
        name: null,
        tableName: null,
        description: null,
      });
    }

    this.clearColumnsForm();
  }

  protected generalError: string | null = null;
  protected generalLoading = false;

  protected columns = [];
  protected columnsError: string | null = null;
  protected columnsLoading = false;

  protected rules: TemplateRuleOption[] = [];

  protected template: TemplateResponse | null = null;

  constructor(
    private readonly templatesService: TemplatesService,
    private readonly validationRulesService: ValidationRulesService,
    private readonly toast: ToastService,
  ) {}

  get columnsFormArray(): FormArray<ColumnRowForm> {
    return this.step2Form.controls.columns;
  }

  private mapRuleResponseToOption(rule: RuleResponse): TemplateRuleOption {
    return {
      id: rule.id,
      name: rule.rule['Nombre de la regla'] ?? '',
      dataType: rule.rule['Tipo de dato'] ?? '',
      headerRule: Array.isArray(rule.rule['Header rule']) ? rule.rule['Header rule'] : [],
    };
  }

  private mapTemplateColumnResponseToFormValue(
    column: TemplateColumnResponse,
  ): Partial<TemplateColumnPayload> {
    return {
      name: column.name ?? '',
      description: column.description ?? '',
      rules: (column.rules ?? []).map((rule) => {
        const matchedRule = this.ruleOptions.find((option) => option.id === rule.id);

        return {
          id: rule.id ?? null,
          'header rule': Array.isArray(rule['header rule'])
            ? rule['header rule']
            : (matchedRule?.headerRule ?? []),
        };
      }),
    };
  }

  private populateColumnsForm(columns: TemplateColumnResponse[] = []): void {
    this.columnsFormArray.clear();

    if (!columns.length) {
      this.ensureAtLeastOneColumnRow();
      return;
    }

    for (const column of columns) {
      this.columnsFormArray.push(
        this.createColumnRowForm(this.mapTemplateColumnResponseToFormValue(column)),
      );
    }
  }

  private loadRulesAndGoToStep2(): void {
    this.rulesLoading = true;
    this.rulesError = null;

    this.validationRulesService
      .getRules()
      .pipe(finalize(() => (this.rulesLoading = false)))
      .subscribe({
        next: (rules: RuleResponse[]) => {
          this.ruleOptions = rules.map((rule) => this.mapRuleResponseToOption(rule));
          this.populateColumnsForm(this.template?.columns ?? []);
          this.currentStep.set(2);
        },
        error: (error: unknown) => {
          this.ruleOptions = [];
          this.rulesError = this.validationRulesService.getErrorMessage(error);
          this.toast.error(this.rulesError);
        },
      });
  }

  protected submitStep1Form(): void {
    if (this.isSubmittingStep1()) {
      return;
    }

    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }

    const rawValue = this.step1Form.getRawValue();

    const payload: TemplateCreatePayload = {
      name: rawValue.name?.trim() ?? '',
      table_name: rawValue.tableName?.trim() ?? '',
      description: rawValue.description?.trim() ?? '',
    };

    this.isSubmittingStep1.set(true);

    if (this.isEditMode) {
      if (this.templateId) {
        this.templatesService
          .updateTemplate(this.templateId, payload)
          .pipe(finalize(() => this.isSubmittingStep1.set(false)))
          .subscribe({
            next: (payload) => {
              this.template = payload;
              this.templateId = this.template.id;
              this.loadRulesAndGoToStep2();
            },
            error: (error: unknown) => {
              const message = this.validationRulesService.getErrorMessage(error);
              this.toast.error(message);
            },
          });
      }
    } else {
      this.templatesService
        .saveTemplate(payload)
        .pipe(finalize(() => this.isSubmittingStep1.set(false)))
        .subscribe({
          next: (payload) => {
            this.template = payload;
            this.templateId = this.template.id;
            this.loadRulesAndGoToStep2();
          },
          error: (error: unknown) => {
            const message = this.validationRulesService.getErrorMessage(error);
            this.toast.error(message);
          },
        });
    }
  }

  protected submitStep2Form(): void {
    if (this.loading) {
      return;
    }

    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      return;
    }

    const payload = this.buildColumnsPayload();

    this.saveTemplate.emit({
      templateId: this.templateId,
      columns: payload,
    });
  }

  protected onDownloadColumnsTemplate(): void {
    const worksheet = utils.json_to_sheet([
      { Nombre: 'Ejemplo de Columna', Descripción: 'Descripción opcional' },
    ]);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Columnas');
    writeFileXLSX(workbook, 'plantilla-columnas.xlsx');
  }

  protected onImportColumnsExcel(file: File): void {
    this.isImportingColumns.set(true);

    file
      .arrayBuffer()
      .then((arrayBuffer) => {
        const workbook = read(arrayBuffer, { type: 'array' });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('El archivo no contiene hojas.');
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          throw new Error('La hoja seleccionada no contiene datos.');
        }

        const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        });

        if (rows.length) {
          const importedColumns = rows
            .map((row) => this.mapExcelRowToColumnPayload(row))
            .filter((column): column is TemplateColumnPayload => column !== null);

          if (!importedColumns.length) {
            this.toast.error('No se encontraron columnas válidas en el archivo seleccionado.');
            return;
          }

          this.replaceImportedColumns(importedColumns);

          this.toast.success('Se cargaron los datos correctamente.');
        } else {
          this.toast.warn('El archivo seleccionado no contiene datos.');
        }
      })
      .catch((error) => {
        console.error('Error al importar columnas:', error);
        this.toast.error('No fue posible importar el archivo seleccionado. Verifica el formato.');
      })
      .finally(() => {
        this.isImportingColumns.set(false);
      });
  }

  private replaceImportedColumns(columns: TemplateColumnPayload[]): void {
    this.columnsFormArray.clear();

    for (const column of columns) {
      this.columnsFormArray.push(this.createColumnRowForm(column));
    }
  }

  private mapExcelRowToColumnPayload(row: Record<string, unknown>): TemplateColumnPayload | null {
    const name = this.extractCellValue(row, ['Nombre', 'name', 'columna']);
    const description = this.extractCellValue(row, ['Descripción', 'description', 'descripcion']);

    if (!name) {
      return null;
    }

    return {
      name,
      description: description || undefined,
      rules: [],
    };
  }

  private extractCellValue(row: Record<string, unknown>, possibleKeys: string[]): string {
    for (const key of possibleKeys) {
      const match = Object.keys(row).find(
        (currentKey) => currentKey.trim().toLowerCase() === key.trim().toLowerCase(),
      );

      if (!match) {
        continue;
      }

      const rawValue = row[match];

      if (rawValue === null || rawValue === undefined) {
        continue;
      }

      const value = String(rawValue).trim();

      if (value) {
        return value;
      }
    }

    return '';
  }

  private createRuleForm(value?: Partial<TemplateColumnRulePayload>): ColumnRuleForm {
    return this.fb.group({
      id: this.fb.control<number | string | null>(value?.id ?? null),
      headerRule: this.fb.nonNullable.control<string[]>(value?.['header rule'] ?? []),
    });
  }

  private createColumnRowForm(value?: Partial<TemplateColumnPayload>): ColumnRowForm {
    return this.fb.group({
      rowId: this.fb.nonNullable.control<string>(crypto.randomUUID()),
      name: this.fb.control<string | null>(value?.name ?? null, [
        Validators.required,
        Validators.maxLength(100),
      ]),
      description: this.fb.control<string | null>(value?.description ?? null, [
        Validators.maxLength(200),
      ]),
      rules: this.fb.array<ColumnRuleForm>(
        value?.rules?.length
          ? value.rules.map((rule) => this.createRuleForm(rule))
          : [this.createRuleForm()],
      ),
    });
  }

  private ensureAtLeastOneColumnRow(): void {
    if (!this.columnsFormArray.length) {
      this.columnsFormArray.push(this.createColumnRowForm());
    }
  }

  private buildColumnsPayload(): TemplateColumnPayload[] {
    return this.columnsFormArray.getRawValue().map((column) => {
      const payload: TemplateColumnPayload = {
        name: column.name?.trim() ?? '',
        rules: column.rules
          .filter((rule) => rule.id !== null && rule.id !== '')
          .map((rule) => {
            const rulePayload: TemplateColumnRulePayload = {
              id: rule.id as number | string,
            };

            if (rule.headerRule?.length) {
              rulePayload['header rule'] = Array.isArray(rule.headerRule)
                ? rule.headerRule
                : [rule.headerRule];
            }

            return rulePayload;
          }),
      };

      if (column.description?.trim()) {
        payload.description = column.description.trim();
      }

      return payload;
    });
  }

  private clearColumnsForm(): void {
    this.columnsFormArray.clear();
  }

  private resetDialogState(): void {
    this.isEditMode = false;
    this.templateId = null;
    this.currentStep.set(1);

    this.title = 'Crear nueva plantilla';
    this.description =
      'Configura la estructura de la plantilla que los usuarios utilizarán para cargar y validar sus datos.';
    this.actionLabel = 'Crear plantilla';

    this.step1Form.reset({
      name: null,
      tableName: null,
      description: null,
    });

    this.clearColumnsForm();
  }

  protected cancel(): void {
    if (this.isSubmittingStep1() || this.loading) {
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
