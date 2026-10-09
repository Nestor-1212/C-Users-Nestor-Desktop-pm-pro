import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ActivityLogService } from './activity-log.service';
import { User } from '../models';
import { MOCK_USERS } from './mock-data';

/**
 * Gestión de cuentas de usuario (antes solo existían los 4 usuarios semilla,
 * uno por empresa, hardcodeados en mock-data y sin forma de administrarlos).
 * Comparte la misma clave de storage ('users') que ya leía AuthService.login(),
 * así que cualquier alta/edición/reseteo de contraseña hecho aquí se refleja
 * de inmediato en el siguiente inicio de sesión.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private activityLog = inject(ActivityLogService);
  private _users = signal<User[]>([]);
  users = this._users.asReadonly();

  constructor() {
    if (!this.storage.get('users')) {
      this.storage.set('users', MOCK_USERS);
    }
    this._users.set(this.storage.get<User[]>('users') || []);
  }

  private save(users: User[]) {
    this._users.set(users);
    this.storage.set('users', users);
  }

  getAll(): User[] { return this._users(); }

  getByCompany(companyId: string): User[] {
    return this._users().filter(u => u.companyId === companyId);
  }

  getById(id: string): User | undefined {
    return this._users().find(u => u.id === id);
  }

  isUsernameTaken(username: string, excludeId?: string): boolean {
    return this._users().some(u => u.username === username && u.id !== excludeId);
  }

  create(data: Omit<User, 'id'>): User {
    const user: User = { ...data, id: 'u' + Date.now() };
    this.save([...this._users(), user]);
    this.logActivity(user.id, `creó el usuario "${user.name}" (@${user.username})`);
    return user;
  }

  update(id: string, data: Partial<Omit<User, 'id' | 'password'>>): void {
    this.save(this._users().map(u => u.id === id ? { ...u, ...data } : u));
    const user = this.getById(id);
    if (user) this.logActivity(id, `editó el usuario "${user.name}" (@${user.username})`);
  }

  resetPassword(id: string, newPassword: string): void {
    const target = this.getById(id);
    this.save(this._users().map(u => u.id === id ? { ...u, password: newPassword } : u));
    if (!target) return;
    const actor = this.auth.currentUser();
    const description = actor?.id === id
      ? 'cambió su propia contraseña'
      : `restableció la contraseña de "${target.name}" (@${target.username})`;
    this.logActivity(id, description);
  }

  /** Cambia la contraseña del propio usuario, verificando la actual. Devuelve false si no coincide. */
  changeOwnPassword(id: string, currentPassword: string, newPassword: string): boolean {
    const user = this.getById(id);
    if (!user || user.password !== currentPassword) return false;
    this.resetPassword(id, newPassword);
    return true;
  }

  delete(id: string): void {
    const user = this.getById(id);
    this.save(this._users().filter(u => u.id !== id));
    if (user) this.logActivity(id, `eliminó el usuario "${user.name}" (@${user.username})`);
  }

  private logActivity(entityId: string, description: string) {
    const actor = this.auth.currentUser();
    if (actor) this.activityLog.log(actor, 'user', entityId, description);
  }
}
