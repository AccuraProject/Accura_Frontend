import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface ManagedUser {
  name: string;
  username: string;
  email: string;
  role: 'Administrador' | 'Cliente';
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  protected readonly personalInfoForm: FormGroup;
  protected readonly changePasswordForm: FormGroup;
  protected readonly userPasswordForm: FormGroup;
  protected readonly userEmailForm: FormGroup;

  protected readonly users: ManagedUser[] = [
    { name: 'Administrador', username: 'admin', email: 'deviyadsegh@gmail.com', role: 'Administrador' },
    { name: 'Gwyneth', username: 'gwyneth', email: 'gwyneth@gmail.com', role: 'Administrador' },
    { name: 'Cliente 1', username: 'cliente1', email: 'cliente1@gmail.com', role: 'Cliente' },
    { name: 'Cliente 2', username: 'cliente2', email: 'cliente2@gmail.com', role: 'Cliente' }
  ];

  protected searchTerm = '';
  protected readonly selectedUser = signal<ManagedUser | null>(null);
  protected readonly manageModalOpen = signal(false);

  constructor(private readonly formBuilder: FormBuilder) {
    this.personalInfoForm = this.formBuilder.group({
      fullName: ['Administrador', [Validators.required]],
      username: ['admin', [Validators.required]],
      email: ['deviyadsegh@gmail.com', [Validators.required, Validators.email]]
    });

    this.changePasswordForm = this.formBuilder.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.userPasswordForm = this.formBuilder.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    });

    this.userEmailForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  protected get filteredUsers(): ManagedUser[] {
    const query = this.searchTerm.toLowerCase().trim();

    if (!query) {
      return this.users;
    }

    return this.users.filter((user) =>
      [user.name, user.username, user.email, user.role].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }

  protected submitPersonalInfo(): void {
    if (this.personalInfoForm.invalid) {
      this.personalInfoForm.markAllAsTouched();
      return;
    }

    // Placeholder for future integration
    console.info('Actualizar información personal', this.personalInfoForm.value);
  }

  protected submitChangePassword(): void {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    console.info('Actualizar contraseña', this.changePasswordForm.value);
    this.changePasswordForm.reset();
  }

  protected openManageModal(user: ManagedUser): void {
    this.selectedUser.set(user);
    this.manageModalOpen.set(true);
    this.userPasswordForm.reset();
    this.userEmailForm.reset({ email: user.email });
  }

  protected closeManageModal(): void {
    this.manageModalOpen.set(false);
    this.selectedUser.set(null);
  }

  protected submitUserPassword(): void {
    if (this.userPasswordForm.invalid || !this.selectedUser()) {
      this.userPasswordForm.markAllAsTouched();
      return;
    }

    console.info('Actualizar contraseña de usuario', {
      user: this.selectedUser(),
      ...this.userPasswordForm.value
    });
    this.userPasswordForm.reset();
    this.closeManageModal();
  }

  protected submitUserEmail(): void {
    if (this.userEmailForm.invalid || !this.selectedUser()) {
      this.userEmailForm.markAllAsTouched();
      return;
    }

    console.info('Actualizar correo de usuario', {
      user: this.selectedUser(),
      ...this.userEmailForm.value
    });
    this.userEmailForm.markAsPristine();
    this.closeManageModal();
  }
}
