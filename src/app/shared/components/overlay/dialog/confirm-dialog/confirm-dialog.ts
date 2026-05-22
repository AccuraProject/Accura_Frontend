import { Component, Input } from '@angular/core';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ConfirmDialogModule],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialogComponent {
  @Input() key = 'global-confirm';
  @Input() header = 'Confirmación';
  @Input() icon = 'pi pi-exclamation-triangle';
  @Input() position:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'topleft'
    | 'topright'
    | 'bottomleft'
    | 'bottomright' = 'center';

  @Input() closable = true;
  @Input() closeOnEscape = true;
  @Input() dismissableMask = true;
  @Input() styleClass = '';
}