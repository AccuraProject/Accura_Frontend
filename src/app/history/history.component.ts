import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { HistoryDetailDialogComponent, HistoryDetailDialogData } from './history-detail-dialog.component';

type HistoryStatus = 'Éxito' | 'Con Errores' | 'En Proceso';

type HistoryFilter = 'Todos los estados' | HistoryStatus;

type TemplateFilter = 'Todas las plantillas' | string;

interface HistoryRecord {
  id: string;
  fileName: string;
  templateName: string;
  uploadedBy: string;
  uploadedAt: string;
  status: HistoryStatus;
  totalRows: number;
  validatedRows: number;
  errorRows: number;
  successRate: number;
  processingTime: string;
  validationStartedAt: string;
}

interface MetricSummary {
  label: string;
  value: string;
  description: string;
  trend: string;
  isPositive: boolean;
  icon: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent {
  protected searchTerm = '';
  protected statusFilter: HistoryFilter = 'Todos los estados';
  protected templateFilter: TemplateFilter = 'Todas las plantillas';

  protected readonly statusOptions: HistoryFilter[] = ['Todos los estados', 'Éxito', 'Con Errores', 'En Proceso'];

  protected readonly templateOptions: TemplateFilter[] = [
    'Todas las plantillas',
    'Plantilla de Pólizas Emitidas',
    'Plantilla de Siniestros Reportados',
    'Plantilla de Clientes Activos'
  ];

  protected readonly metrics: MetricSummary[] = [
    {
      label: 'Total de Cargas',
      value: '5',
      description: 'Archivos procesados este mes',
      trend: '+15% este mes',
      isPositive: true,
      icon: 'upload_file'
    },
    {
      label: 'Usuarios Activos',
      value: '3',
      description: 'Usuarios cargando archivos',
      trend: '+2% este mes',
      isPositive: true,
      icon: 'group'
    },
    {
      label: 'Filas Procesadas',
      value: '835',
      description: 'Volumen de filas validadas',
      trend: '+22% este mes',
      isPositive: true,
      icon: 'table_rows'
    }
  ];

  protected historyRecords: HistoryRecord[] = [
    {
      id: 'HX-2045',
      fileName: 'polizas_enero_2025.xlsx',
      templateName: 'Plantilla de Pólizas Emitidas',
      uploadedBy: 'María García',
      uploadedAt: '2025-01-16T10:45:00Z',
      status: 'Éxito',
      totalRows: 150,
      validatedRows: 150,
      errorRows: 0,
      successRate: 1,
      processingTime: '2m 15s',
      validationStartedAt: '2025-01-16T10:46:30Z'
    },
    {
      id: 'HX-2044',
      fileName: 'sinestros_q4.csv',
      templateName: 'Plantilla de Siniestros Reportados',
      uploadedBy: 'Carlos López',
      uploadedAt: '2025-01-14T14:20:00Z',
      status: 'Con Errores',
      totalRows: 210,
      validatedRows: 198,
      errorRows: 12,
      successRate: 0.94,
      processingTime: '3m 40s',
      validationStartedAt: '2025-01-14T14:21:10Z'
    },
    {
      id: 'HX-2043',
      fileName: 'clientes_activos.json',
      templateName: 'Plantilla de Clientes Activos',
      uploadedBy: 'Ana Gómez',
      uploadedAt: '2025-01-12T08:15:00Z',
      status: 'Éxito',
      totalRows: 320,
      validatedRows: 320,
      errorRows: 0,
      successRate: 1,
      processingTime: '4m 05s',
      validationStartedAt: '2025-01-12T08:16:20Z'
    },
    {
      id: 'HX-2042',
      fileName: 'polizas_diciembre_2024.xlsx',
      templateName: 'Plantilla de Pólizas Emitidas',
      uploadedBy: 'María García',
      uploadedAt: '2025-01-08T17:05:00Z',
      status: 'Éxito',
      totalRows: 155,
      validatedRows: 155,
      errorRows: 0,
      successRate: 1,
      processingTime: '2m 05s',
      validationStartedAt: '2025-01-08T17:06:10Z'
    },
    {
      id: 'HX-2041',
      fileName: 'sinestros_octubre.csv',
      templateName: 'Plantilla de Siniestros Reportados',
      uploadedBy: 'Carlos López',
      uploadedAt: '2025-01-04T11:32:00Z',
      status: 'En Proceso',
      totalRows: 180,
      validatedRows: 0,
      errorRows: 0,
      successRate: 0,
      processingTime: '-',
      validationStartedAt: '2025-01-04T11:33:10Z'
    }
  ];

  constructor(private readonly dialog: MatDialog) {}

  protected get filteredRecords(): HistoryRecord[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.historyRecords.filter((record) => {
      const matchesSearch = !term
        || record.fileName.toLowerCase().includes(term)
        || record.templateName.toLowerCase().includes(term)
        || record.uploadedBy.toLowerCase().includes(term);

      const matchesStatus =
        this.statusFilter === 'Todos los estados' || record.status === this.statusFilter;

      const matchesTemplate =
        this.templateFilter === 'Todas las plantillas' || record.templateName === this.templateFilter;

      return matchesSearch && matchesStatus && matchesTemplate;
    });
  }

  protected trackByRecordId(_: number, record: HistoryRecord): string {
    return record.id;
  }

  protected statusBadgeClass(status: HistoryStatus): string {
    switch (status) {
      case 'Éxito':
        return 'badge badge--success';
      case 'Con Errores':
        return 'badge badge--warning';
      case 'En Proceso':
        return 'badge badge--info';
      default:
        return 'badge';
    }
  }

  protected openRecordDetail(record: HistoryRecord): void {
    const dialogData: HistoryDetailDialogData = {
      fileName: record.fileName,
      templateName: record.templateName,
      status: record.status,
      uploadedAt: record.uploadedAt,
      processedBy: record.uploadedBy,
      totalRows: record.totalRows,
      validatedRows: record.validatedRows,
      errorRows: record.errorRows,
      successRate: record.successRate,
      processingTime: record.processingTime,
      validationStartedAt: record.validationStartedAt
    };

    this.dialog.open<HistoryDetailDialogComponent, HistoryDetailDialogData, void>(
      HistoryDetailDialogComponent,
      {
        data: dialogData,
        panelClass: 'history-detail-dialog'
      }
    );
  }
}
