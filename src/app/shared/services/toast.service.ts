import { Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast';

export interface ToastOptions {
  key?: string;
  severity?: ToastSeverity;
  summary?: string;
  detail?: string;
  life?: number;
  sticky?: boolean;
  closable?: boolean;
  data?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  constructor(private readonly messageService: MessageService) {}

  show(options: ToastOptions): void {
    this.messageService.add({
      key: options.key ?? 'global',
      severity: options.severity ?? 'info',
      summary: options.summary ?? '',
      detail: options.detail ?? '',
      life: options.life ?? 3000,
      sticky: options.sticky ?? false,
      closable: options.closable ?? true,
      data: options.data,
    });
  }

  success(detail: string, summary = 'Éxito', life = 3000, key = 'global'): void {
    this.show({
      key,
      severity: 'success',
      summary,
      detail,
      life,
    });
  }

  error(detail: string, summary = 'Error', life = 4000, key = 'global'): void {
    console.log('TOAST ERROR');
    this.show({
      key,
      severity: 'error',
      summary,
      detail,
      life,
    });
  }

  info(detail: string, summary = 'Información', life = 3000, key = 'global'): void {
    this.show({
      key,
      severity: 'info',
      summary,
      detail,
      life,
    });
  }

  warn(detail: string, summary = 'Advertencia', life = 3500, key = 'global'): void {
    this.show({
      key,
      severity: 'warn',
      summary,
      detail,
      life,
    });
  }

  clear(key?: string): void {
    this.messageService.clear(key);
  }
}
