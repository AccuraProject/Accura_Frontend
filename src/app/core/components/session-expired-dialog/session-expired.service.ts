import { Injectable } from '@angular/core';
import { DialogService } from 'primeng/dynamicdialog';
import { SessionExpiredDialogComponent } from './session-expired-dialog.component';
import { DynamicDialogRef  } from 'primeng/dynamicdialog';

@Injectable({
  providedIn: 'root',
})
export class SessionExpiredService {
  private dialogRef: DynamicDialogRef  | null = null;

  constructor(private dialogService: DialogService) {}

  // Método para abrir el modal y almacenar la referencia
  openSessionExpiredDialog() {
    this.dialogRef = this.dialogService.open(SessionExpiredDialogComponent, {
      width: '35vw',
      closable: false,
      modal: true,
    });
  }

  closeSessionExpiredDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
  }
}