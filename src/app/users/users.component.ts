import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

interface UserRow {
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  protected searchTerm = '';
  protected modalOpen = false;

  protected readonly roles = ['Administrador', 'Cliente', 'Analista'];
  protected readonly statuses = ['Activo', 'Inactivo', 'Suspendido'];

  protected users: UserRow[] = [
    {
      name: 'Juan Pérez',
      email: 'juan@example.com',
      role: 'Administrador',
      status: 'Activo',
      createdAt: '2025-01-12'
    },
    {
      name: 'María García',
      email: 'maria@example.com',
      role: 'Cliente',
      status: 'Activo',
      createdAt: '2025-01-08'
    },
    {
      name: 'Carlos López',
      email: 'carlos@example.com',
      role: 'Cliente',
      status: 'Inactivo',
      createdAt: '2024-12-28'
    },
    {
      name: 'Ana Martínez',
      email: 'ana@example.com',
      role: 'Analista',
      status: 'Activo',
      createdAt: '2024-12-18'
    }
  ];

  protected newUser = this.getEmptyUser();

  protected get filteredUsers(): UserRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.users;
    }

    return this.users.filter((user) => {
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
      );
    });
  }

  protected openModal(): void {
    this.newUser = this.getEmptyUser();
    this.modalOpen = true;
  }

  protected closeModal(form?: NgForm): void {
    this.modalOpen = false;
    this.newUser = this.getEmptyUser();
    form?.resetForm({
      name: this.newUser.name,
      email: this.newUser.email,
      role: this.newUser.role,
      status: this.newUser.status
    });
  }

  protected createUser(form: NgForm): void {
    if (form.invalid) {
      form.form.markAllAsTouched();
      return;
    }

    const entry: UserRow = {
      name: this.newUser.name.trim(),
      email: this.newUser.email.trim(),
      role: this.newUser.role,
      status: this.newUser.status,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    this.users = [entry, ...this.users];
    this.closeModal(form);
  }

  protected trackByEmail(_: number, user: UserRow): string {
    return user.email;
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected roleClass(role: string): string {
    switch (role) {
      case 'Administrador':
        return 'badge--admin';
      case 'Analista':
        return 'badge--analyst';
      default:
        return 'badge--client';
    }
  }

  protected statusClass(status: string): string {
    switch (status) {
      case 'Activo':
        return 'badge--active';
      case 'Suspendido':
        return 'badge--suspended';
      default:
        return 'badge--inactive';
    }
  }

  private getEmptyUser(): UserRow {
    return {
      name: '',
      email: '',
      role: '',
      status: '',
      createdAt: ''
    };
  }
}
