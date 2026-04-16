import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { ButtonComponent } from '../../ui/button/button';
import { TextFieldComponent } from '../../ui/field/text-field/text-field';
import { TextAreaFieldComponent } from '../../ui/field/textarea-field/textarea-field';

import {
  ColumnRowForm,
  ColumnRuleForm,
  Step2Form,
  TemplateRuleOption,
} from '../../../../features/templates/models/template-columns-editor';
import { SelectFieldComponent } from '../../ui/field/select-field/select-field';
import { SelectModule } from 'primeng/select';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-template-columns-editor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    ButtonComponent,
    TextFieldComponent,
    TextAreaFieldComponent,
    SelectFieldComponent,
    SelectModule,
    FloatLabelModule,
  ],
  templateUrl: './template-columns-editor.html',
  styleUrl: './template-columns-editor.scss',
})
export class TemplateColumnsEditorComponent {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) form!: Step2Form;
  @Input() ruleOptions: TemplateRuleOption[] = [];
  @Input() loading = false;
  @Input() isImporting = false;

  @Output() downloadTemplate = new EventEmitter<void>();
  @Output() importExcel = new EventEmitter<File>();

  get columnsFormArray(): FormArray<ColumnRowForm> {
    return this.form.controls.columns;
  }

  get columnControls(): ColumnRowForm[] {
    return this.columnsFormArray.controls;
  }

  addRow(): void {
    this.columnsFormArray.push(this.createColumnRowForm());
  }

  removeRow(index: number): void {
    this.columnsFormArray.removeAt(index);
  }

  rulesAt(index: number): FormArray<ColumnRuleForm> {
    return this.columnsFormArray.at(index).controls.rules;
  }

  addRule(index: number): void {
    this.rulesAt(index).push(this.createRuleForm());
  }

  removeRule(columnIndex: number, ruleIndex: number): void {
    const rules = this.rulesAt(columnIndex);

    if (rules.length === 1) {
      rules.at(0).reset({
        id: null,
        headerRule: [],
      });
      return;
    }

    rules.removeAt(ruleIndex);
  }

  trackByColumn = (_: number, control: ColumnRowForm): string => control.controls.rowId.value;

  trackByRule = (_: number, control: ColumnRuleForm): string =>
    `${control.controls.id.value ?? 'new'}-${_}`;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.importExcel.emit(file);
    input.value = '';
  }

  private createColumnRowForm(): ColumnRowForm {
    return this.fb.group({
      rowId: this.fb.nonNullable.control<string>(crypto.randomUUID()),
      name: this.fb.control<string | null>(null, [Validators.required, Validators.maxLength(100)]),
      description: this.fb.control<string | null>(null, [Validators.maxLength(200)]),
      rules: this.fb.array<ColumnRuleForm>([this.createRuleForm()]),
    });
  }

  private createRuleForm(): ColumnRuleForm {
    return this.fb.group({
      id: this.fb.control<number | string | null>(null),
      headerRule: this.fb.nonNullable.control<string[]>([]),
    });
  }

  protected getRuleOptionById(ruleId: number | string | null): TemplateRuleOption | null {
    if (ruleId === null || ruleId === '') {
      return null;
    }

    return this.ruleOptions.find((option) => option.id === ruleId) ?? null;
  }

  protected shouldShowHeaderRuleSelect(ruleId: number | string | null): boolean {
    const option = this.getRuleOptionById(ruleId);

    if (!option) {
      return false;
    }

    const requiresByType =
      option.dataType === 'Lista compleja' || option.dataType === 'Dependencia';

    return requiresByType;
  }

  protected getHeaderRuleOptions(ruleId: number | string | null): string[] {
    return this.getRuleOptionById(ruleId)?.headerRule ?? [];
  }

  protected onRuleSelectionChange(rule: ColumnRuleForm): void {
    const selectedRuleId = rule.controls.id.value;
    const option = this.getRuleOptionById(selectedRuleId);

    if (!option || !this.shouldShowHeaderRuleSelect(selectedRuleId)) {
      rule.controls.headerRule.setValue([]);
      return;
    }

    const currentHeaderRule = rule.controls.headerRule.value ?? [];
    const validOptions = option.headerRule ?? [];

    const filtered = currentHeaderRule.filter((item) => validOptions.includes(item));

    if (filtered.length !== currentHeaderRule.length) {
      rule.controls.headerRule.setValue(filtered);
    }
  }
}
