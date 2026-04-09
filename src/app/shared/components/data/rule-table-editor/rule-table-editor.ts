import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../../ui/button/button';
import { TableModule } from 'primeng/table';
import { ToastService } from '../../../services/toast.service';

type RuleTableMode = 'standard' | 'unique-row' | 'dependency';

@Component({
  selector: 'app-rule-table-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonComponent, InputTextModule],
  templateUrl: './rule-table-editor.html',
  styleUrl: './rule-table-editor.scss',
})
export class RuleTableEditorComponent implements OnChanges {
  @Input() columns: string[] = [];
  @Input() rows: Record<string, string>[] = [];
  @Input() mode: RuleTableMode = 'standard';

  @Output() rowsChange = new EventEmitter<Record<string, string>[]>();

  draftRow: Record<string, string> = {};

  constructor(private toast: ToastService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.resetDraftRow();
    }
  }

  get canAddRow(): boolean {
    return this.columns.every((column) => (this.draftRow[column] ?? '').trim().length > 0);
  }

  addRow(): void {
    if (!this.canAddRow) {
      return;
    }

    const newRow = this.buildNormalizedDraftRow();

    if (this.mode === 'dependency') {
      this.addDependencyRow(newRow);
      return;
    }

    if (this.mode === 'unique-row') {
      this.addUniqueRow(newRow);
      return;
    }

    this.rowsChange.emit([...this.rows, newRow]);
    this.resetDraftRow();
  }

  removeRow(index: number): void {
    this.rowsChange.emit(this.rows.filter((_, i) => i !== index));
  }

  private addUniqueRow(newRow: Record<string, string>): void {
    const alreadyExists = this.rows.some((row) => this.areRowsEqual(row, newRow));

    if (alreadyExists) {
      this.toast.warn('Este elemento ya se encuentra en la lista.');
      return;
    }

    this.rowsChange.emit([...this.rows, newRow]);
    this.resetDraftRow();
  }

  private addDependencyRow(newRow: Record<string, string>): void {
    const [sourceColumn, targetColumn] = this.columns;

    if (!sourceColumn || !targetColumn) {
      return;
    }

    const sourceValue = newRow[sourceColumn];
    const targetValue = newRow[targetColumn];

    const existingIndex = this.rows.findIndex(
      (row) => this.normalizeValue(row[sourceColumn]) === this.normalizeValue(sourceValue),
    );

    if (existingIndex === -1) {
      const normalizedNewTargets = this.splitDependencyValues(targetValue);

      if (normalizedNewTargets.length === 0) {
        return;
      }

      const rowToInsert = {
        ...newRow,
        [targetColumn]: normalizedNewTargets.join(', '),
      };

      this.rowsChange.emit([...this.rows, rowToInsert]);
      this.resetDraftRow();
      return;
    }

    const updatedRows = [...this.rows];
    const existingRow = { ...updatedRows[existingIndex] };

    const existingTargetValues = this.splitDependencyValues(existingRow[targetColumn]);
    const incomingTargetValues = this.splitDependencyValues(targetValue);

    const existingNormalizedSet = new Set(
      existingTargetValues.map((value) => this.normalizeValue(value)),
    );

    const valuesToAdd = incomingTargetValues.filter(
      (value) => !existingNormalizedSet.has(this.normalizeValue(value)),
    );

    if (valuesToAdd.length === 0) {
      this.toast.warn('Este elemento ya se encuentra en la lista.');
      return;
    }

    existingRow[targetColumn] = [...existingTargetValues, ...valuesToAdd].join(', ');
    updatedRows[existingIndex] = existingRow;

    this.rowsChange.emit(updatedRows);
    this.resetDraftRow();
  }

  private buildNormalizedDraftRow(): Record<string, string> {
    return this.columns.reduce(
      (acc, column) => {
        acc[column] = (this.draftRow[column] ?? '').trim();
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  private areRowsEqual(rowA: Record<string, string>, rowB: Record<string, string>): boolean {
    return this.columns.every(
      (column) => this.normalizeValue(rowA[column]) === this.normalizeValue(rowB[column]),
    );
  }

  private splitDependencyValues(value: string | undefined): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of (value ?? '').split(',')) {
      const trimmed = item.trim();
      const normalized = this.normalizeValue(trimmed);

      if (!trimmed || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(trimmed);
    }

    return result;
  }

  private normalizeValue(value: string | undefined): string {
    return (value ?? '').trim();
  }

  private resetDraftRow(): void {
    this.draftRow = this.columns.reduce(
      (acc, column) => {
        acc[column] = '';
        return acc;
      },
      {} as Record<string, string>,
    );
  }
}
