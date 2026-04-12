import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RuleFormDialogData } from './components/rule-form-dialog/rule-form-dialog.component';

import { ValidationRulesService } from './validation-rules.service';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { ConfirmService } from '../../shared/services/confirm.service';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table';
import { RuleExample, RulePayload, RuleResponse } from './models/rule.model';
import {
  RuleFormDialogComponent,
  SaveRuleFormEvent,
} from './components/rule-form-dialog/rule-form-dialog.component';
import { finalize } from 'rxjs';
import { ToastService } from '../../shared/services/toast.service';

interface AiRuleOption {
  id: string;
  payload: RulePayload;
}

interface RuleRow {
  id: number;
  name: string;
  dataType: string;
  mandatory: string;
  status: string;
  description: string;
  header: string[];
  headerRule: string[];
  example: RuleExample;
  ruleConfig: Record<string, unknown>;
  payload: RulePayload;
}

@Component({
  selector: 'app-validation-rules',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageActionsComponent,
    DataTableComponent,
    RuleFormDialogComponent,
  ],
  templateUrl: './validation-rules.component.html',
  styleUrl: './validation-rules.component.scss',
})
export class ValidationRulesComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  protected searchTerm = '';

  protected rules: RuleRow[] = [];
  protected rulesLoading = false;
  protected rulesError: string | null = null;

  protected aiRuleOptions: AiRuleOption[] = [];
  protected selectedAiRuleId: string | null = null;
  protected aiIsLoading = false;
  protected aiError: string | null = null;
  protected hasAiFetched = false;
  protected assistantPanelOpen = false;

  protected ruleSyncError: string | null = null;

  protected readonly pageSize = 10;
  protected currentPage = 1;

  columns = [
    { field: 'name', header: 'Nombre' },
    { field: 'dataType', header: 'Tipo de dato' },
    { field: 'mandatory', header: 'Obligatoria' },
    { field: 'status', header: 'Estado' },
  ];

  protected ruleDialogVisible = false;
  protected ruleDialogLoading = false;

  ruleDialogData: RuleFormDialogData = {
    mode: 'create',
    isActive: true,
  };

  protected selectedRule: RuleRow | null = null;

  protected isEditing = false;

  constructor(
    private readonly validationRulesService: ValidationRulesService,
    private readonly toast: ToastService,
    private readonly confirm: ConfirmService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadRules();
  }

  onRowSelect(rule: RuleRow) {
    this.selectedRule = rule;
  }

  onRowUnselect() {
    this.selectedRule = null;
  }

  onCreateRule(): void {
    this.isEditing = false;
    this.openCreateDialog();
  }

  onEditRule(): void {
    this.isEditing = true;
    if (!this.selectedRule) return;

    const rule = this.selectedRule;

    this.openEditDialog(rule);
  }

  onDeleteRule(): void {
    if (!this.selectedRule) return;

    const rule = this.selectedRule;

    this.confirm.confirmDelete(() => {
      this.handleDeleteRule(rule.id);
    });
  }

  handleSaveRule(event: SaveRuleFormEvent): void {
    this.ruleDialogLoading = true;
    this.cdr.markForCheck();

    if (!this.isEditing) {
      this.validationRulesService
        .saveRule(event.rule, event.isActive)
        .pipe(
          finalize(() => {
            this.ruleDialogLoading = false;
            this.cdr.markForCheck();
          }),
        )
        .subscribe({
          next: () => {
            this.loadRules();
            this.toast.success('Regla creada exitosamente.');
            this.closeRuleDialog();
          },
          error: (error: unknown) => {
            const message = this.validationRulesService.getErrorMessage(error);
            this.toast.error(message);
          },
        });
    } else {
      if (this.selectedRule) {
        this.validationRulesService
          .updateRule(this.selectedRule.id, event.rule, event.isActive)
          .pipe(
            finalize(() => {
              this.ruleDialogLoading = false;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: (updatedRule: RuleResponse) => {
              const updatedRow = this.mapToRuleRow(updatedRule);
              this.rules = this.rules.map((current) =>
                current.id === updatedRow.id ? updatedRow : current,
              );

              this.toast.success('Regla actualizada exitosamente.');
              this.closeRuleDialog();
            },
            error: (error: unknown) => {
              const message = this.validationRulesService.getErrorMessage(error);
              this.toast.error(message);
            },
          });
      } else {
        this.ruleDialogLoading = false;
        this.cdr.markForCheck();
      }
    }
  }

  handleDeleteRule(ruleId: number): void {
    this.rulesLoading = true;

    this.validationRulesService
      .deleteRule(ruleId)
      .pipe(
        finalize(() => {
          this.selectedRule = null;
          this.rulesLoading = false;
        }),
      )
      .subscribe({
        next: () => {
          this.removeRuleEntry(ruleId);
          this.toast.success('Regla eliminada exitosamente.');
        },
        error: (error: unknown) => {
          const message = this.validationRulesService.getErrorMessage(error);
          this.toast.error(message);
        },
      });
  }

  private removeRuleEntry(ruleId: number): void {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId);
  }

  private loadRules(): void {
    if (this.rulesLoading) {
      return;
    }

    this.rulesLoading = true;
    this.rulesError = null;

    this.validationRulesService.getRules().subscribe({
      next: (rules: RuleResponse[]) => {
        this.rules = rules.map((rule) => this.mapToRuleRow(rule));
        this.rulesLoading = false;
      },
      error: (error: unknown) => {
        this.rules = [];
        this.rulesError = this.validationRulesService.getErrorMessage(error);
        this.rulesLoading = false;
        console.error(this.rulesError);
      },
    });
  }

  protected closeRuleDialog(): void {
    this.ruleDialogVisible = false;
    this.ruleDialogLoading = false;
    this.ruleDialogData = {
      mode: 'create',
      isActive: true,
    };
  }

  private mapToRuleRow(ruleResponse: RuleResponse): RuleRow {
    const payload = ruleResponse.rule;

    return this.createRuleRow(
      ruleResponse.id,
      payload['Nombre de la regla'],
      payload['Tipo de dato'],
      payload['Campo obligatorio'],
      ruleResponse.is_active,
      payload['Descripción'],
      payload.Header,
      payload['Header rule'],
      payload['Ejemplo'],
      payload['Regla'],
      payload,
    );
  }

  private createRuleRow(
    id: number,
    name: string,
    dataType: string,
    mandatory: boolean,
    isActive: boolean,
    description: string,
    header: string[],
    headerRule: string[],
    example: RuleExample,
    ruleConfig: Record<string, unknown>,
    payload: RulePayload,
  ): RuleRow {
    return {
      id,
      name,
      dataType,
      mandatory: this.getMandatoryLabel(mandatory),
      status: this.getStatusLabel(isActive),
      description,
      header,
      headerRule,
      example,
      ruleConfig,
      payload,
    };
  }

  private getMandatoryLabel(mandatory: boolean): string {
    return mandatory ? 'Sí' : 'No';
  }

  private getStatusLabel(isActive: boolean): string {
    return isActive ? 'Activo' : 'Inactivo';
  }

  private getStatusValue(status: string): boolean {
    return status == 'Activo' ? true : false;
  }

  protected get totalRules(): number {
    return this.rules.length;
  }

  protected get activeRules(): number {
    return this.rules.filter((rule) => rule.status === 'Activo').length;
  }

  protected get dataTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.dataType)).size;
  }

  protected openCreateDialog(): void {
    this.ruleDialogData = {
      mode: 'create',
      isActive: true,
    };

    this.ruleDialogVisible = true;
  }

  protected openEditDialog(rule: RuleRow): void {
    this.ruleDialogData = {
      mode: 'edit',
      payload: structuredClone(rule.payload),
      isActive: this.getStatusValue(rule.status),
    };

    this.ruleDialogVisible = true;
  }
}
