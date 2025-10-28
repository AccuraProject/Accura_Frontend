import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

interface TemplateDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
}

interface PermissionDialogUser {
  name: string;
  email: string;
}

export interface PermissionManageDialogData {
  user: PermissionDialogUser;
  templates: TemplateDefinition[];
  assignedTemplateIds: string[];
}

export interface PermissionManageDialogResult {
  assignedTemplateIds: string[];
}

@Component({
  selector: 'app-permission-manage-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './permission-manage-dialog.component.html',
  styleUrl: './permission-manage-dialog.component.scss'
})
export class PermissionManageDialogComponent {
  protected selectedTemplates: Set<string>;
  private readonly originalSelection: Set<string>;

  constructor(
    private readonly dialogRef: MatDialogRef<
      PermissionManageDialogComponent,
      PermissionManageDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public readonly data: PermissionManageDialogData
  ) {
    this.selectedTemplates = new Set(data.assignedTemplateIds);
    this.originalSelection = new Set(data.assignedTemplateIds);
  }

  protected get activeTemplates(): TemplateDefinition[] {
    return this.data.templates.filter((template) => this.selectedTemplates.has(template.id));
  }

  protected get inactiveTemplates(): TemplateDefinition[] {
    return this.data.templates.filter((template) => !this.selectedTemplates.has(template.id));
  }

  protected toggleTemplate(templateId: string, checked: boolean): void {
    const next = new Set(this.selectedTemplates);

    if (checked) {
      next.add(templateId);
    } else {
      next.delete(templateId);
    }

    this.selectedTemplates = next;
  }

  protected isTemplateSelected(templateId: string): boolean {
    return this.selectedTemplates.has(templateId);
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected trackByTemplateId(_: number, template: TemplateDefinition): string {
    return template.id;
  }

  protected get selectedCount(): number {
    return this.selectedTemplates.size;
  }

  protected get hasChanges(): boolean {
    if (this.selectedTemplates.size !== this.originalSelection.size) {
      return true;
    }

    for (const templateId of this.selectedTemplates) {
      if (!this.originalSelection.has(templateId)) {
        return true;
      }
    }

    return false;
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  protected submit(): void {
    this.dialogRef.close({
      assignedTemplateIds: Array.from(this.selectedTemplates)
    });
  }
}
