import { FormArray, FormControl, FormGroup } from '@angular/forms';

export interface TemplateRuleOption {
  id: number | string;
  name: string;
  dataType: string;
  headerRule: string[];
}

export interface TemplateColumnRulePayload {
  id: number | string;
  'header rule'?: string[];
}

export interface TemplateColumnPayload {
  name: string;
  description?: string;
  rules: TemplateColumnRulePayload[];
  is_active?: boolean;
}

export type ColumnRuleForm = FormGroup<{
  id: FormControl<number | string | null>;
  headerRule: FormControl<string[]>;
}>;

export type ColumnRowForm = FormGroup<{
  rowId: FormControl<string>;
  name: FormControl<string | null>;
  description: FormControl<string | null>;
  rules: FormArray<ColumnRuleForm>;
}>;

export type Step2Form = FormGroup<{
  columns: FormArray<ColumnRowForm>;
}>;