import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TagModule } from 'primeng/tag';
import { parseDateString } from '../../../utils/date-util';
import { SelectModule } from 'primeng/select';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  filter?: boolean;
  filterType?: 'text' | 'number' | 'date' | 'select';
  filterOptions?: any[];
  isBadge?: boolean;
  badgeSeverityMap?: Record<string, string>;
  align?: 'left' | 'center' | 'right';
  type?: 'string' | 'number' | 'date';
  dateFormat?: 'dd/MM/yyyy' | 'dd/MM/yyyy h:mm a';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    TableModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    SelectModule,
    CommonModule,
    FormsModule,
  ],
  templateUrl: './data-table.html',
  styleUrls: ['./data-table.scss'],
})
export class DataTableComponent<T> {
  @ViewChild('dt') dt!: Table;

  @Input() value: T[] = [];
  @Input() columns: DataTableColumn[] = [];
  @Input() selection: T | null = null;
  @Input() loading: boolean = false;
  @Input() rows: number = 10;

  @Output() rowSelect = new EventEmitter<T>();
  @Output() rowUnselect = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  searchTerm: string = '';
  originalValue: T[] = [];
  isSorted: boolean | null = null;
  columnFilters: Record<string, any> = {};

  ngOnChanges(): void {
    if (this.value && this.value.length > 0) {
      this.originalValue = [...this.value];
    }
  }

  clear(table: Table) {
    table.clear();
    this.searchTerm = '';
    this.value = [...this.originalValue];
  }

  onSearch(value: string) {
    this.searchTerm = value;
    this.dt.filterGlobal(value, 'contains');
  }

  onRowSelect(event: any): void {
    this.rowSelect.emit(event.data);
  }

  onRowUnselect(event: any): void {
    this.rowUnselect.emit();
  }

  customSort(event: { field: string; order: number; data: T[] }) {
    if (this.isSorted === null || this.isSorted === undefined) {
      this.isSorted = true;
      this.sortTableData(event);
    } else if (this.isSorted === true) {
      this.isSorted = false;
      this.sortTableData(event);
    } else if (this.isSorted === false) {
      this.isSorted = null;
      this.value = [...this.originalValue];

      if (this.dt) {
        this.dt.reset();
      }
    }
  }

  sortTableData(event: { field: string; order: number; data: T[] }) {
    const { field, data, order } = event;

    data.sort((a, b) => {
      const rowA = a as unknown as Record<string, unknown>;
      const rowB = b as unknown as Record<string, unknown>;

      let value1 = rowA[field];
      let value2 = rowB[field];

      let result = 0;

      // Detectar fecha
      const column = this.columns.find((c) => c.field === field);
      if (column?.type === 'date') {
        const date1 = parseDateString(value1 as string);
        const date2 = parseDateString(value2 as string);

        console.log(date1, date2);

        if (!date1 && date2) result = -1;
        else if (date1 && !date2) result = 1;
        else if (!date1 && !date2) result = 0;
        else {
          const time1 = date1?.getTime() ?? 0;
          const time2 = date2?.getTime() ?? 0;
          result = time1 - time2;
        }
      }
      // Detectar números
      else if (typeof value1 === 'number' && typeof value2 === 'number') {
        result = value1 - value2;
      }
      // Default: string
      else {
        const str1 = value1 != null ? String(value1) : '';
        const str2 = value2 != null ? String(value2) : '';
        result = str1.localeCompare(str2);
      }

      return order * result;
    });
  }
}
