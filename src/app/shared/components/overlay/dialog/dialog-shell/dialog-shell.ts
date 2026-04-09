import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-dialog-shell',
  standalone: true,
  imports: [Dialog, ButtonModule],
  templateUrl: './dialog-shell.html',
  styleUrls: ['./dialog-shell.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogShellComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Input() title = '';
  @Input() description = '';

  @Input() saveLabel = 'Guardar';
  @Input() cancelLabel = 'Cancelar';

  @Input() saveDisabled = false;
  @Input() loading = false;

  @Input() width = '40rem';
  @Input() modal = true;
  @Input() closable = false;
  @Input() draggable = false;
  @Input() resizable = false;
  @Input() dismissableMask = false;
  @Input() closeOnEscape = true;

  @Input() showFooter = true;

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  onHide(): void {
    if (this.loading) {
      return;
    }

    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
  }

  onCancel(): void {
    if (this.loading) {
      return;
    }

    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
  }

  onSave(): void {
    if (this.saveDisabled || this.loading) {
      return;
    }

    this.save.emit();
  }
}
