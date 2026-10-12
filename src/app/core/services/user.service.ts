import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StaffMember, User } from '../models';
import { API_URL } from '../config/api.config';
import { toUser, upsert } from '../http/mappers';

export interface UserInput {
  name: string;
  username: string;
  email: string;
  /** Solo para clientes; un técnico no pertenece a ninguna empresa. */
  companyId: string | null;
  role?: 'client' | 'technician';
}

/** Cuentas de clientes y técnicos (solo el owner las administra) y el equipo asignable. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private _users = signal<User[]>([]);
  users = this._users.asReadonly();
  private _staff = signal<StaffMember[]>([]);
  /** Administrador y técnicos: a quién se le puede asignar un ticket. */
  staff = this._staff.asReadonly();

  async loadStaff(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/users/staff`));
    this._staff.set(list.map(s => ({ id: s.id, name: s.name, role: s.role.toLowerCase() })));
  }

  async load(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/users`));
    this._users.set(list.map(toUser));
  }

  getAll(): User[] { return this._users(); }

  getByCompany(companyId: string): User[] {
    return this._users().filter(u => u.companyId === companyId);
  }

  getById(id: string): User | undefined {
    return this._users().find(u => u.id === id);
  }

  /** Validación rápida en el formulario; el servidor la vuelve a aplicar (409). */
  isUsernameTaken(username: string, excludeId?: string): boolean {
    return this._users().some(u => u.username === username && u.id !== excludeId);
  }

  async create(data: UserInput & { password: string }): Promise<User> {
    const body = { ...data, role: (data.role ?? 'client').toUpperCase() };
    const u = toUser(await firstValueFrom(this.http.post<any>(`${API_URL}/users`, body)));
    this._users.update(list => upsert(list, u));
    return u;
  }

  async update(id: string, data: Partial<UserInput>): Promise<User> {
    const u = toUser(await firstValueFrom(this.http.patch<any>(`${API_URL}/users/${id}`, data)));
    this._users.update(list => upsert(list, u));
    return u;
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/users/${id}/reset-password`, { newPassword }));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/users/${id}`));
    this._users.update(list => list.filter(u => u.id !== id));
  }
}
