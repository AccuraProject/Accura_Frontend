import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
  RuleFormDialogData,
  ValidationRuleFormDialogComponent,
  ValidationRuleFormDialogData,
  ValidationRuleFormDialogResult,
  ValidationRuleFormDialogSubmitResult,
} from './validation-rule-form-dialog.component';
import {
  ValidationRuleDeleteDialogComponent,
  ValidationRuleDeleteDialogData,
} from './validation-rule-delete-dialog.component';
import {
  VALIDATION_RULE_AI_SCHEMA,
  describeRuleConfig as describeRuleConfigUtil,
  getExampleEntries as getExampleEntriesUtil,
  DEFAULT_RULE_ERROR_MESSAGE,
} from './validation-rule-ai.utils';
import { ValidationRulesService } from './validation-rules.service';
import { PageActionsComponent } from '../../shared/components/ui/page-actions/page-actions';
import { ConfirmService } from '../../shared/services/confirm.service';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table';
import { RuleExample, RulePayload, RuleResponse } from './models/rule.model';
import { RuleFormDialogComponent } from './components/rule-form-dialog/rule-form-dialog.component';

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

interface ValidationRule {
  id: string;
  name: string;
  dataType: string;
  mandatory: boolean;
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
    MatDialogModule,
    PageActionsComponent,
    DataTableComponent,
    RuleFormDialogComponent,
  ],
  templateUrl: './validation-rules.component.html',
  styleUrl: './validation-rules.component.scss',
})
export class ValidationRulesComponent implements OnInit {
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
  };

  protected selectedRule: RuleRow | null = null;

  protected isEditing = false;

  private readonly aiRuleSchema = VALIDATION_RULE_AI_SCHEMA;

  constructor(
    private readonly dialog: MatDialog,
    private readonly validationRulesService: ValidationRulesService,
    private readonly confirm: ConfirmService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loadRules();
  }

  onCreateRule(): void {
    this.isEditing = false;
    this.openCreateDialog();
  }

  onEditRule(): void {
    this.isEditing = true;
    if (!this.selectedRule) return;

    const user = this.selectedRule;

    this.openEditDialog(user);
  }

  onDeleteRule(): void {
    if (!this.selectedRule) return;

    const user = this.selectedRule;

    this.confirm.confirmDelete(() => {
      // this.handleDeleteUser(user.id);
    });
  }

  onRowSelect(rule: RuleRow) {
    this.selectedRule = rule;
  }

  onRowUnselect() {
    this.selectedRule = null;
  }

  handleSaveUser(rule: unknown): void {
    // this.userDialogLoading = true;
    // this.cdr.markForCheck();
    // if (!this.isEditing) {
    //   this.userService
    //     .createUser({
    //       name: user.name,
    //       email: user.email,
    //       role_id: user.roleId,
    //     })
    //     .pipe(
    //       finalize(() => {
    //         this.userDialogLoading = false;
    //         this.cdr.markForCheck();
    //       }),
    //     )
    //     .subscribe({
    //       next: () => {
    //         this.loadUsers();
    //         this.toast.success('Usuario creado exitosamente.');
    //         this.closeUserDialog();
    //       },
    //       error: (error: unknown) => {
    //         const message = this.userService.getErrorMessage(error);
    //         this.toast.error(message);
    //       },
    //     });
    // } else {
    //   if (this.selectedUser) {
    //     const payload: UpdateUserPayload = {
    //       name: user.name,
    //       role_id: user.roleId,
    //       email: user.email,
    //       is_active: user.status,
    //     };
    //     this.userService
    //       .updateUser(this.selectedUser.id, payload)
    //       .pipe(
    //         finalize(() => {
    //           this.selectedUser = null;
    //           this.userDialogLoading = false;
    //           this.cdr.markForCheck();
    //         }),
    //       )
    //       .subscribe({
    //         next: (updatedUser: UserResponse) => {
    //           const updatedRow = this.mapToUserRow(updatedUser);
    //           this.users = this.users.map((current) =>
    //             current.id === updatedRow.id ? updatedRow : current,
    //           );
    //           this.toast.success('Usuario actualizado exitosamente.');
    //           this.closeUserDialog();
    //         },
    //         error: (error: unknown) => {
    //           const message = this.userService.getErrorMessage(error);
    //           this.toast.error(message);
    //         },
    //       });
    //   } else {
    //     this.userDialogLoading = false;
    //     this.cdr.markForCheck();
    //   }
    // }
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

  protected get totalRules(): number {
    return this.rules.length;
  }

  protected get activeRules(): number {
    return this.rules.filter((rule) => rule.status === 'Activo').length;
  }

  protected get dataTypesCount(): number {
    return new Set(this.rules.map((rule) => rule.dataType)).size;
  }

  protected get selectedAiRule(): AiRuleOption | undefined {
    if (this.selectedAiRuleId) {
      return this.aiRuleOptions.find((option) => option.id === this.selectedAiRuleId);
    }

    return this.aiRuleOptions[0];
  }

  protected openCreateDialog(): void {
    this.ruleDialogData = {
      mode: 'create',
    };
    
    this.ruleDialogVisible = true;
    // const dialogRef = this.dialog.open<
    //   ValidationRuleFormDialogComponent,
    //   ValidationRuleFormDialogData,
    //   ValidationRuleFormDialogSubmitResult
    // >(ValidationRuleFormDialogComponent, {
    //   disableClose: true,
    //   width: '92vw',
    //   maxWidth: '1240px',
    //   maxHeight: '95vh',
    //   panelClass: 'validation-rule-dialog',
    //   data: {
    //     mode: 'create',
    //   },
    // });

    // dialogRef
    //   .afterClosed()
    //   .subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
    //     if (!result) {
    //       return;
    //     }

    //     this.addRule(result);
    //   });
  }

  protected openEditDialog(rule: RuleRow): void {
    //   const dialogRef = this.dialog.open<
    //     ValidationRuleFormDialogComponent,
    //     ValidationRuleFormDialogData,
    //     ValidationRuleFormDialogSubmitResult
    //   >(ValidationRuleFormDialogComponent, {
    //     disableClose: true,
    //     width: '92vw',
    //     maxWidth: '1240px',
    //     maxHeight: '95vh',
    //     panelClass: 'validation-rule-dialog',
    //     data: {
    //       mode: 'edit',
    //       rule: this.toDialogResult(rule),
    //       payload: rule.payload,
    //     },
    //   });
    //   dialogRef
    //     .afterClosed()
    //     .subscribe((result: ValidationRuleFormDialogSubmitResult | undefined) => {
    //       if (!result) {
    //         return;
    //       }
    //       this.updateRule(rule.id, result);
    //     });
    // }
    // protected openDeleteDialog(rule: ValidationRule): void {
    //   const dialogRef = this.dialog.open<
    //     ValidationRuleDeleteDialogComponent,
    //     ValidationRuleDeleteDialogData,
    //     boolean
    //   >(ValidationRuleDeleteDialogComponent, {
    //     disableClose: true,
    //     data: {
    //       name: rule.name,
    //     },
    //   });
    //   dialogRef.afterClosed().subscribe((shouldDelete: boolean | undefined) => {
    //     if (!shouldDelete) {
    //       return;
    //     }
    //     this.removeRule(rule.id);
    //   });
  }

  protected trackByAiOptionId(_: number, option: AiRuleOption): string {
    return option.id;
  }

  protected applyAiRule(option: AiRuleOption): void {
    // console.log('[ValidationRules] Payload listo para enviar (IA):', option.payload);
    // const payloadClone = JSON.parse(JSON.stringify(option.payload)) as RulePayload;
    // const rule = this.buildRuleFromPayload(payloadClone, 'Inactiva', 'ia');
    // this.rules = [rule, ...this.rules];
    // this.persistRule(payloadClone, false).catch(() => undefined);
  }

  protected describeRuleConfig(payload: RulePayload): string[] {
    return describeRuleConfigUtil(payload);
  }

  protected getExampleEntries(payload: RulePayload): Array<{ key: string; value: string }> {
    return getExampleEntriesUtil(payload);
  }

  private addRule(result: ValidationRuleFormDialogSubmitResult): void {
    // const payload = JSON.parse(JSON.stringify(result.payload)) as RulePayload;
    // console.log('[ValidationRules] Payload listo para enviar (manual):', payload);
    // const entry = this.buildRuleFromPayload(payload, result.status, 'manual');
    // this.rules = [entry, ...this.rules];
    // this.persistRule(payload, result.status === 'Activa')
    //   .then(() => this.loadRules())
    //   .catch(() => undefined);
  }

  private updateRule(ruleId: string, result: ValidationRuleFormDialogSubmitResult): void {
    // const payloadClone = JSON.parse(JSON.stringify(result.payload)) as RulePayload;
    // this.rules = this.rules.map((rule) => {
    //   if (rule.id !== ruleId) {
    //     return rule;
    //   }
    //   return this.buildRuleFromPayload(payloadClone, result.status, rule.source, rule.id);
    // });
    // this.persistRule(payloadClone, result.status === 'Activa', ruleId).catch(() => undefined);
  }

  private removeRule(ruleId: string): void {
    // const previousRules = [...this.rules];
    // this.rules = this.rules.filter((rule) => rule.id !== ruleId);
    // this.ruleSyncError = null;
    // void this.validationRulesService.deleteRule(ruleId).catch((error) => {
    //   this.rules = previousRules;
    //   this.handleRuleSyncError(error);
    // });
  }

  private generateId(): string {
    return `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildRuleFromPayload(
    payload: RulePayload,
    status: ValidationRule['status'],
    source: 'manual' | 'ia',
    currentId?: string,
  ) {
    // const clone = JSON.parse(JSON.stringify(payload)) as RulePayload;
    // const header = this.sanitizeStringArray(clone.Header);
    // if (header.length === 0) {
    //   header.push('Plantilla Global');
    // }
    // const headerRule = this.sanitizeStringArray(clone['Header rule']);
    // const example =
    //   clone['Ejemplo'] && typeof clone['Ejemplo'] === 'object' && !Array.isArray(clone['Ejemplo'])
    //     ? (clone['Ejemplo'] as RuleExample)
    //     : {};
    // const ruleConfig =
    //   clone['Regla'] && typeof clone['Regla'] === 'object' && !Array.isArray(clone['Regla'])
    //     ? (clone['Regla'] as Record<string, unknown>)
    //     : {};
    // return {
    //   id: currentId ?? this.generateId(),
    //   name: clone['Nombre de la regla'],
    //   dataType: clone['Tipo de dato'],
    //   mandatory: clone['Campo obligatorio'],
    //   status,
    //   description: clone['Descripción'],
    //   header,
    //   headerRule,
    //   example,
    //   ruleConfig,
    //   source,
    //   payload: clone,
    // };
  }

  private async persistRule(
    payload: RulePayload,
    isActive: boolean,
    ruleId?: string,
  ): Promise<void> {
    try {
      if (ruleId) {
        await this.validationRulesService.updateRule(ruleId, payload, isActive);
      } else {
        await this.validationRulesService.saveRule(payload, isActive);
      }
    } catch (error) {
      this.handleRuleSyncError(error);
      throw error;
    }
  }

  private handleRuleSyncError(error: unknown): void {
    console.error('[ValidationRules] Error al sincronizar la regla:', error);
    // this.ruleSyncError = this.getErrorMessage(error);
  }

  private toDialogResult(rule: ValidationRule) {
    // return {
    //   name: rule.name,
    //   dataType: rule.dataType,
    //   mandatory: rule.mandatory,
    //   status: rule.status,
    //   description: rule.description,
    //   primaryHeader: rule.header[0] ?? 'Plantilla Global',
    //   secondaryHeaders: rule.header.slice(1),
    //   headerRule: [...rule.headerRule],
    //   exampleEntries: this.buildDialogExamples(rule.payload),
    //   ruleConfig: JSON.parse(JSON.stringify(rule.ruleConfig)) as Record<string, unknown>,
    // };
  }

  private buildDialogExamples(payload: RulePayload): Array<{ key: string; value: string }> {
    const defaults: Array<{ key: string; value: string }> = [
      { key: 'Ejemplo válido', value: '' },
      { key: 'Ejemplo inválido', value: '' },
    ];

    const entries = this.getExampleEntries(payload)
      .map(({ key, value }) => ({ key: key.trim(), value: value.trim() }))
      .filter((entry) => entry.value.length > 0);

    const normalizeKey = (text: string): string =>
      text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const validEntry = entries.find((entry) => normalizeKey(entry.key).includes('valido'));
    const invalidEntry = entries.find((entry) => normalizeKey(entry.key).includes('invalido'));

    const fallback = entries.filter((entry) => entry !== validEntry && entry !== invalidEntry);

    return [
      {
        key: defaults[0].key,
        value: validEntry?.value ?? entries[0]?.value ?? '',
      },
      {
        key: defaults[1].key,
        value: invalidEntry?.value ?? fallback[0]?.value ?? entries[1]?.value ?? '',
      },
    ];
  }
}
