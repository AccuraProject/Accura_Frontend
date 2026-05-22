import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { ToastService } from '../../../../shared/services/toast.service';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { ButtonComponent } from '../../../../shared/components/ui/button/button';
import {
  TemplateAccessGrantPayload,
  TemplatesService,
} from '../../../templates/templates.service';
import { CarouselModule } from 'primeng/carousel';
import { DateFieldComponent } from '../../../../shared/components/ui/field/date-field/date-field';
import { ProgressSpinnerComponent } from '../../../../shared/components/ui/progress-spinner/progress-spinner';

export interface AssignedTemplateView {
  id: number;
  name: string;
  description: string;
  start_date: Date | null;
  end_date: Date | null;
  revoked_at: Date | null;
}

export interface AvailableTemplateView {
  id: number;
  name: string;
  description: string;
}

interface AssignedTemplateCarouselItem {
  template: AssignedTemplateView;
  form: TemplateAccessFormGroup;
}

interface AvailableTemplateCarouselItem {
  template: AvailableTemplateView;
  form: TemplateAccessFormGroup;
}

export const EMPTY_PERMISSION_USER_DATA: PermissionFormDialogData = {
  id: 0,
  name: '',
  email: '',
  availableTemplates: [],
  assignedTemplates: [],
};

export interface PermissionFormDialogData {
  id: number;
  name: string;
  email: string;
  availableTemplates: AvailableTemplateView[];
  assignedTemplates: AssignedTemplateView[];
}

type TemplateAccessFormGroup = FormGroup<{
  template_id: FormControl<number>;
  user_id: FormControl<number>;
  start_date: FormControl<Date | null>;
  end_date: FormControl<Date | null>;
}>;

@Component({
  selector: 'app-permission-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogShellComponent,
    CardModule,
    TagModule,
    ButtonComponent,
    ButtonModule,
    DividerModule,
    MessageModule,
    CarouselModule,
    DateFieldComponent,
    ProgressSpinnerComponent
  ],
  templateUrl: './permission-form-dialog.component.html',
  styleUrls: ['./permission-form-dialog.component.scss'],
})
export class PermissionFormDialogComponent {
  protected title = 'Gestión de permisos';
  protected description =
    'Administra las plantillas disponibles. Los cambios se aplican de forma inmediata.';

  protected detailDialogData: PermissionFormDialogData = EMPTY_PERMISSION_USER_DATA;

  protected isSubmittingAssignForm = signal(false);
  protected isSubmmittingRevokeForm = signal(false);

  protected availableTemplates: AvailableTemplateView[] = [];
  protected assignedTemplates: AssignedTemplateView[] = [];

  protected assignedTemplateItems: AssignedTemplateCarouselItem[] = [];
  protected availableTemplateItems: AvailableTemplateCarouselItem[] = [];

  private readonly fb = inject(FormBuilder);

  readonly forms = this.fb.group({
    availableTemplates: this.fb.array<TemplateAccessFormGroup>([]),
    assignedTemplates: this.fb.array<TemplateAccessFormGroup>([]),
  });

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() cancelDialog = new EventEmitter<void>();

  @Output() accessUpdated = new EventEmitter<void>();

  @Input() loading = false;
  @Input() set data(value: PermissionFormDialogData) {
    this.detailDialogData = value;
    this.availableTemplates = value.availableTemplates;
    this.assignedTemplates = value.assignedTemplates;

    this.buildAvailableTemplatesForms();
    this.buildAssignedTemplatesForms();
    this.buildCarouselItems();
  }

  constructor(
    private templatesService: TemplatesService,
    private toast: ToastService,
  ) {}

  protected get availableTemplatesArray(): FormArray<TemplateAccessFormGroup> {
    return this.forms.controls.availableTemplates;
  }

  protected get assignedTemplatesArray(): FormArray<TemplateAccessFormGroup> {
    return this.forms.controls.assignedTemplates;
  }

  protected get availableTemplateControls(): TemplateAccessFormGroup[] {
    return this.availableTemplatesArray.controls;
  }

  protected get assignedTemplateControls(): TemplateAccessFormGroup[] {
    return this.assignedTemplatesArray.controls;
  }

  protected getAvailableTemplateForm(index: number): TemplateAccessFormGroup {
    return this.availableTemplatesArray.at(index);
  }

  protected getAssignedTemplateForm(index: number): TemplateAccessFormGroup {
    return this.assignedTemplatesArray.at(index);
  }

  protected assignTemplateById(templateId: number): void {
    const index = this.availableTemplates.findIndex((template) => template.id === templateId);

    if (index === -1) {
      this.toast.error('No fue posible identificar la plantilla seleccionada.');
      return;
    }

    const form = this.getAvailableTemplateForm(index);

    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const rawValue = form.getRawValue();

    if (!rawValue.start_date || !rawValue.end_date) {
      this.toast.error('Las fechas de inicio y fin son requeridas.');
      return;
    }

    const payload: TemplateAccessGrantPayload[] = [
      {
        template_id: rawValue.template_id,
        user_id: rawValue.user_id,
        start_date: this.formatDateOnly(rawValue.start_date) ?? '',
        end_date: this.formatDateOnly(rawValue.end_date) ?? '',
      },
    ];

    this.isSubmittingAssignForm.set(true);

    this.templatesService.grantTemplateAccess(payload).subscribe({
      next: () => {
        this.toast.success('Acceso asignado exitosamente.');
        this.accessUpdated.emit();
      },
      error: (error: unknown) => {
        const message = this.templatesService.getErrorMessage(error);
        this.toast.error(message);
      },
      complete: () => {
        this.isSubmittingAssignForm.set(false);
      },
    });
  }

  protected revokeTemplateAccess(template: AssignedTemplateView): void {
    const payload = [
      {
        template_id: template.id,
        user_id: this.detailDialogData.id,
      },
    ];

    this.isSubmmittingRevokeForm.set(true);

    this.templatesService.revokeTemplateAccess(payload).subscribe({
      next: () => {
        this.toast.success('Acceso anulado exitosamente.');
        this.accessUpdated.emit();
      },
      error: (error: unknown) => {
        const message = this.templatesService.getErrorMessage(error);
        this.toast.error(message);
      },
      complete: () => {
        this.isSubmmittingRevokeForm.set(false);
      },
    });
  }

  protected cancel(): void {
    if (this.loading || this.isSubmittingAssignForm() || this.isSubmmittingRevokeForm()) {
      return;
    }

    this.cancelDialog.emit();
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private buildCarouselItems(): void {
    this.availableTemplateItems = this.availableTemplates
      .map((template, index) => {
        const form = this.availableTemplatesArray.at(index);

        if (!form) {
          return null;
        }

        return {
          template,
          form,
        };
      })
      .filter((item): item is AvailableTemplateCarouselItem => item !== null);

    this.assignedTemplateItems = this.assignedTemplates
      .map((template, index) => {
        const form = this.assignedTemplatesArray.at(index);

        if (!form) {
          return null;
        }

        return {
          template,
          form,
        };
      })
      .filter((item): item is AssignedTemplateCarouselItem => item !== null);
  }

  private buildAvailableTemplatesForms(): void {
    this.availableTemplatesArray.clear();

    for (const template of this.availableTemplates) {
      this.availableTemplatesArray.push(
        this.fb.group({
          template_id: this.fb.nonNullable.control(template.id),
          user_id: this.fb.nonNullable.control(this.detailDialogData.id),
          start_date: this.fb.control<Date | null>(null, Validators.required),
          end_date: this.fb.control<Date | null>(null, Validators.required),
        }),
      );
    }
  }

  private buildAssignedTemplatesForms(): void {
    this.assignedTemplatesArray.clear();

    for (const template of this.assignedTemplates) {
      const form = this.fb.group({
        template_id: this.fb.nonNullable.control(template.id),
        user_id: this.fb.nonNullable.control(this.detailDialogData.id),
        start_date: this.fb.control<Date | null>(template.start_date),
        end_date: this.fb.control<Date | null>(template.end_date),
      });

      form.disable();
      this.assignedTemplatesArray.push(form);
    }
  }

  private formatDateOnly(date: Date | null): string | null {
    if (!date) {
      return null;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
