import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import * as XLSX from 'xlsx';
import { ButtonComponent } from '../../ui/button/button';
import { ToastService } from '../../../services/toast.service';
import { ButtonModule } from 'primeng/button';

type RuleTableMode = 'standard' | 'unique-row' | 'dependency';

@Component({
  selector: 'app-rule-table-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonComponent, InputTextModule, ButtonModule],
  templateUrl: './rule-table-editor.html',
  styleUrl: './rule-table-editor.scss',
})
export class RuleTableEditorComponent implements OnChanges {
  @Input() columns: string[] = [];
  @Input() rows: Record<string, string>[] = [];
  @Input() mode: RuleTableMode = 'standard';

  @Output() rowsChange = new EventEmitter<Record<string, string>[]>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  isImporting = false;

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
    if (this.isImporting || !this.canAddRow) {
      return;
    }

    const newRow = this.buildNormalizedDraftRow();
    const nextRows = this.getRowsAfterInsert(this.rows, newRow);

    if (!this.areRowsCollectionsEqual(this.rows, nextRows)) {
      this.rowsChange.emit(nextRows);
    }

    this.resetDraftRow();
  }

  removeRow(index: number): void {
    console.log(this.isImporting);
    if (this.isImporting) {
      return;
    }

    this.rowsChange.emit(this.rows.filter((_, i) => i !== index));
  }

  downloadTemplate(): void {
    if (!this.columns.length) {
      return;
    }

    const exportRows = this.rows.map((row) =>
      this.columns.reduce(
        (acc, column) => {
          acc[column] = row[column] ?? '';
          return acc;
        },
        {} as Record<string, string>,
      ),
    );

    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: this.columns,
      skipHeader: false,
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla');

    const fileName = this.buildTemplateFileName();
    XLSX.writeFile(workbook, fileName);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.isImporting = true;

    try {
      const importedRows = await this.readExcelFile(file);

      if (!importedRows.length) {
        this.toast.error('El archivo seleccionado no contiene datos.');
        return;
      }

      let nextRows: Record<string, string>[] = [];

      for (const row of importedRows) {
        nextRows = this.getRowsAfterInsert(nextRows, row);
      }

      const hasChanges = !this.areRowsCollectionsEqual(this.rows, nextRows);

      if (hasChanges) {
        this.rowsChange.emit(nextRows);
        this.toast.success('Se cargaron los datos correctamente.');
      } else {
        this.toast.warn('El archivo seleccionado no contiene datos.');
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Ocurrió un error al procesar el archivo.');
    } finally {
      this.isImporting = false;

      if (input) {
        input.value = '';
      }
    }
  }

  private async readExcelFile(file: File): Promise<Record<string, string>[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });

    return rawRows
      .map((rawRow) => this.normalizeImportedRow(rawRow))
      .filter((row) => this.isRowComplete(row));
  }

  private normalizeImportedRow(rawRow: Record<string, unknown>): Record<string, string> {
    return this.columns.reduce(
      (acc, column) => {
        const value = rawRow[column];
        acc[column] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  private isRowComplete(row: Record<string, string>): boolean {
    return this.columns.every((column) => (row[column] ?? '').trim().length > 0);
  }

  private getRowsAfterInsert(
    currentRows: Record<string, string>[],
    newRow: Record<string, string>,
  ): Record<string, string>[] {
    if (this.mode === 'dependency') {
      return this.insertDependencyRow(currentRows, newRow);
    }

    if (this.mode === 'unique-row') {
      return this.insertUniqueRow(currentRows, newRow);
    }

    return [...currentRows, newRow];
  }

  private insertUniqueRow(
    currentRows: Record<string, string>[],
    newRow: Record<string, string>,
  ): Record<string, string>[] {
    const alreadyExists = currentRows.some((row) => this.areRowsEqual(row, newRow));
    if (alreadyExists) {
      if (!this.isImporting) {
        this.toast.warn('El elemento ya existe en la lista.');
      }
      return currentRows;
    }

    return [...currentRows, newRow];
  }

  private insertDependencyRow(
    currentRows: Record<string, string>[],
    newRow: Record<string, string>,
  ): Record<string, string>[] {
    const [sourceColumn, targetColumn] = this.columns;

    if (!sourceColumn || !targetColumn) {
      return currentRows;
    }

    const sourceValue = newRow[sourceColumn];
    const targetValue = newRow[targetColumn];

    const existingIndex = currentRows.findIndex(
      (row) => this.normalizeValue(row[sourceColumn]) === this.normalizeValue(sourceValue),
    );

    if (existingIndex === -1) {
      const normalizedNewTargets = this.splitDependencyValues(targetValue);

      if (!normalizedNewTargets.length) {
        return currentRows;
      }

      return [
        ...currentRows,
        {
          ...newRow,
          [targetColumn]: normalizedNewTargets.join(', '),
        },
      ];
    }

    const updatedRows = [...currentRows];
    const existingRow = { ...updatedRows[existingIndex] };

    const existingTargetValues = this.splitDependencyValues(existingRow[targetColumn]);
    const incomingTargetValues = this.splitDependencyValues(targetValue);

    const existingNormalizedSet = new Set(
      existingTargetValues.map((value) => this.normalizeValue(value)),
    );

    const valuesToAdd = incomingTargetValues.filter(
      (value) => !existingNormalizedSet.has(this.normalizeValue(value)),
    );

    if (!valuesToAdd.length) {
      if (!this.isImporting) {
        this.toast.warn('El elemento ya existe en la lista.');
      }
      return currentRows;
    }

    existingRow[targetColumn] = [...existingTargetValues, ...valuesToAdd].join(', ');
    updatedRows[existingIndex] = existingRow;

    return updatedRows;
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

  private areRowsCollectionsEqual(
    rowsA: Record<string, string>[],
    rowsB: Record<string, string>[],
  ): boolean {
    if (rowsA.length !== rowsB.length) {
      return false;
    }

    return rowsA.every((row, index) => this.areRowsEqual(row, rowsB[index] ?? {}));
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

  private buildTemplateFileName(): string {
    const base = this.columns.length ? this.columns.join('_') : 'plantilla';
    return `${base.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
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
