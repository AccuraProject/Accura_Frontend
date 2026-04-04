import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonComponent } from '../button/button';
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'app-page-actions',
  standalone: true,
  imports: [ButtonComponent, ToolbarModule],
  templateUrl: './page-actions.html',
  styleUrl: './page-actions.scss'
})
export class PageActionsComponent {
  @Input() showCreate = false;
  @Input() showEdit = false;
  @Input() showDelete = false;
  @Input() showExport = false;
  @Input() showExtraAction = false;

  @Input() createLabel = 'Nuevo';
  @Input() editLabel = 'Editar';
  @Input() deleteLabel = 'Eliminar';
  @Input() exportLabel = 'Exportar';
  @Input() extraActionLabel = 'Acción extra';

  @Input() createIcon = 'pi pi-plus';
  @Input() editIcon = 'pi pi-pencil';
  @Input() deleteIcon = 'pi pi-trash';
  @Input() exportIcon = 'pi pi-upload';
  @Input() extraActionIcon = 'pi pi-star';

  @Input() disableCreate = false;
  @Input() disableEdit = false;
  @Input() disableDelete = false;
  @Input() disableExport = false;
  @Input() disableExtraAction = false;

  @Output() create = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() export = new EventEmitter<void>();
  @Output() extraAction = new EventEmitter<void>();

  protected onCreate(): void {
    if (!this.disableCreate) {
      this.create.emit();
    }
  }

  protected onEdit(): void {
    if (!this.disableEdit) {
      this.edit.emit();
    }
  }

  protected onDelete(): void {
    if (!this.disableDelete) {
      this.delete.emit();
    }
  }

  protected onExport(): void {
    if (!this.disableExport) {
      this.export.emit();
    }
  }

  protected onExtraAction(): void {
    if (!this.disableExtraAction) {
      this.extraAction.emit();
    }
  }
}