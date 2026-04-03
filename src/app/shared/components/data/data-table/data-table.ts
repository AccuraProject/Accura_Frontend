import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectItem } from 'primeng/api';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';

interface DataTableColumn {
  field: string;
  header: string;
  sortable?: boolean;
  filter?: boolean;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [TableModule, IconFieldModule, InputIconModule,  ButtonModule, InputTextModule],
  templateUrl: './data-table.html',
  styleUrls: ['./data-table.scss']
})
export class DataTableComponent<T> {
  @Input() value: T[] = [];
  @Input() columns: DataTableColumn[] = [];
  @Input() selection: T | null = null;
  @Input() loading: boolean = false;
  @Input() rows: number = 10;

  @Output() rowSelect = new EventEmitter<T>();
  @Output() rowUnselect = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  searchTerm: string = '';

  onSearchChange(event: any): void {
    this.searchChange.emit(this.searchTerm);
  }

  onRowSelect(event: any): void {
    this.rowSelect.emit(event.data);
  }

  onRowUnselect(event: any): void {
    this.rowUnselect.emit();
  }
}