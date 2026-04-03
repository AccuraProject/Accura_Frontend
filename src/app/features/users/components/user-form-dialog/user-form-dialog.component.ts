import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogShellComponent } from '../../../../shared/components/overlay/dialog/dialog-shell/dialog-shell';
import { TextFieldComponent } from '../../../../shared/components/ui/field/text-field/text-field';
import { SelectFieldComponent } from '../../../../shared/components/ui/field/select-field/select-field';

export interface UserRoleOption {
  id: number;
  label: string;
}

export interface UserFormDialogData {
  roles: UserRoleOption[];
  mode?: 'create' | 'edit';
  user?: UserFormDialogInitialValue;
}

export interface UserFormDialogValue {
  name: string;
  email: string;
  roleId: number;
  status: boolean;
}

export interface UserFormDialogInitialValue {
  name: string;
  email: string;
  roleId: number | null;
  status: boolean | null;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    SelectModule,
    DialogShellComponent,
    TextFieldComponent,
    SelectFieldComponent
  ],
  templateUrl: './user-form-dialog.component.html',
  styleUrls: ['./user-form-dialog.component.scss'],
})
export class UserFormDialogComponent {
  protected roles: UserRoleOption[] = [];
  protected isEditMode = false;
  protected title = 'Crear Nuevo Usuario';
  protected description = 'Completa los datos del nuevo usuario para agregarlo a la plataforma.';
  protected actionLabel = 'Crear Usuario';

  protected readonly statusOptions = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  private readonly fb = inject(FormBuilder);

  readonly userForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    roleId: this.fb.control<number | null>(null, [Validators.required]),
    status: this.fb.control<boolean | null>(true),
  });

  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  @Output() saveUser = new EventEmitter<UserFormDialogValue>();
  @Output() cancelDialog = new EventEmitter<void>();

  @Input() set data(value: UserFormDialogData | null) {
    if (!value) {
      this.roles = [];
      this.isEditMode = false;
      this.title = 'Crear nuevo usuario';
      this.description = 'Completa los datos del nuevo usuario para agregarlo a la plataforma.';
      this.actionLabel = 'Crear usuario';
      this.userForm.reset(this.getEmptyForm());
      this.userForm.controls.email.enable({ emitEvent: false });
      return;
    }

    this.roles = value.roles ?? [];
    this.isEditMode = value.mode === 'edit';

    this.title = this.isEditMode ? 'Editar usuario' : 'Crear nuevo usuario';
    this.description = this.isEditMode
      ? 'Actualiza los datos del usuario seleccionado.'
      : 'Completa los datos del nuevo usuario para agregarlo a la plataforma.';
    this.actionLabel = this.isEditMode ? 'Guardar cambios' : 'Crear usuario';

    const initialValue = value.user ?? this.getEmptyForm();

    this.userForm.reset({
      name: initialValue.name,
      email: initialValue.email,
      roleId: initialValue.roleId,
      status: initialValue.status ?? true,
    });

    if (this.isEditMode) {
      this.userForm.controls.email.disable({ emitEvent: false });
      this.userForm.controls.status.addValidators([Validators.required]);
    } else {
      this.userForm.controls.email.enable({ emitEvent: false });
      this.userForm.controls.status.clearValidators();
    }

    this.userForm.controls.status.updateValueAndValidity({ emitEvent: false });
  }

  protected submit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const rawValue = this.userForm.getRawValue();

    if (rawValue.roleId === null) {
      this.userForm.markAllAsTouched();
      return;
    }

    if (this.isEditMode && rawValue.status === null) {
      this.userForm.markAllAsTouched();
      return;
    }

    const payload: UserFormDialogValue = {
      name: rawValue.name.trim(),
      email: rawValue.email.trim(),
      roleId: rawValue.roleId,
      status: rawValue.status ?? true,
    };

    this.saveUser.emit(payload);
    this.close();
  }

  protected cancel(): void {
    this.cancelDialog.emit();
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private getEmptyForm(): UserFormDialogInitialValue {
    return {
      name: '',
      email: '',
      roleId: 2,
      status: true,
    };
  }
}
