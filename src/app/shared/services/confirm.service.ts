import { Injectable } from '@angular/core';
import { ConfirmationService, Confirmation } from 'primeng/api';

export interface ConfirmOptions {
  key?: string;
  header?: string;
  message: string;
  icon?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptIcon?: string;
  rejectIcon?: string;
  acceptButtonStyleClass?: string;
  rejectButtonStyleClass?: string;
  defaultFocus?: 'accept' | 'reject' | 'none';
  closable?: boolean;
  closeOnEscape?: boolean;
  dismissableMask?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  constructor(private readonly confirmationService: ConfirmationService) {}

  show(options: ConfirmOptions): void {
    const confirmation: Confirmation = {
      key: options.key ?? 'global-confirm',
      header: options.header ?? 'Confirmación',
      message: options.message,
      icon: options.icon ?? 'pi pi-exclamation-triangle',
      acceptLabel: options.acceptLabel ?? 'Aceptar',
      rejectLabel: options.rejectLabel ?? 'Cancelar',
      acceptIcon: options.acceptIcon,
      rejectIcon: options.rejectIcon,
      acceptButtonStyleClass: options.acceptButtonStyleClass,
      rejectButtonStyleClass: options.rejectButtonStyleClass,
      defaultFocus: options.defaultFocus ?? 'reject',
      closable: options.closable ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
      dismissableMask: options.dismissableMask ?? true,
      accept: () => options.onAccept?.(),
      reject: () => options.onReject?.(),
    };

    this.confirmationService.confirm(confirmation);
  }

  confirmDelete(
    onAccept: () => void,
    message = '¿Estás seguro de que deseas eliminar este registro?',
    header = 'Confirmar eliminación',
  ): void {
    this.show({
      header,
      message,
      icon: 'pi pi-exclamation-circle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      defaultFocus: 'reject',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-outlined p-button-secondary',
      onAccept,
    });
  }

  confirmAction(
    onAccept: () => void,
    message = '¿Deseas continuar con esta acción?',
    header = 'Confirmación',
  ): void {
    this.show({
      header,
      message,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Continuar',
      rejectLabel: 'Cancelar',
      defaultFocus: 'reject',
      rejectButtonStyleClass: 'p-button-text',
      onAccept,
    });
  }

  alert(
    message: string,
    header = 'Información',
    onAccept?: () => void,
  ): void {
    this.show({
      header,
      message,
      icon: 'pi pi-info-circle',
      acceptLabel: 'Aceptar',
      rejectLabel: '',
      defaultFocus: 'accept',
      dismissableMask: false,
      onAccept,
      onReject: undefined,
    });
  }
}