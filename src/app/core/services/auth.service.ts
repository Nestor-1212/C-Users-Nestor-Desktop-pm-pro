import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { User } from '../models';
import { API_URL } from '../config/api.config';
import { toUser } from '../http/mappers';

interface Session { token: string; user: User; }

const SESSION_KEY = 'session';
/** Datos que la versión anterior (sin backend) guardaba en el navegador, incluida la contraseña en texto plano. */
const LEGACY_KEYS = ['current_user', 'users', 'companies', 'projects', 'tickets', 'invoices', 'notifications', 'activity_log'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storage = inject(StorageService);
  private http = inject(HttpClient);

  private _session = signal<Session | null>(null);
  currentUser = computed(() => this._session()?.user ?? null);
  isLoggedIn = computed(() => !!this._session());
  isOwner = computed(() => this.currentUser()?.role === 'owner');
  isClient = computed(() => this.currentUser()?.role === 'client');
  isTechnician = computed(() => this.currentUser()?.role === 'technician');
  /** Equipo de 3TECH (administrador o técnico): trabaja tickets y proyectos. */
  isStaff = computed(() => this.isOwner() || this.isTechnician());

  constructor() {
    LEGACY_KEYS.forEach(k => { this.storage.remove(k); this.storage.removeSession(k); });
    // La sesión de esta pestaña (sin "recordar") tiene prioridad sobre la persistente.
    const saved = this.storage.getSession<Session>(SESSION_KEY) ?? this.storage.get<Session>(SESSION_KEY);
    if (saved?.token) this._session.set(saved);
  }

  token(): string | null {
    return this._session()?.token ?? null;
  }

  /** Lanza el error HTTP si falla; el mensaje de la API ya viene en español. */
  async login(username: string, password: string, remember = true): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ token: string; user: any }>(
      `${API_URL}/auth/login`, { username, password, remember },
    ));
    const session: Session = { token: res.token, user: toUser(res.user) };
    this._session.set(session);
    if (remember) {
      this.storage.set(SESSION_KEY, session);
      this.storage.removeSession(SESSION_KEY);
    } else {
      // No se toca localStorage: otra pestaña puede tener una sesión recordada.
      this.storage.setSession(SESSION_KEY, session);
    }
  }

  /** El servidor revoca las sesiones anteriores y entrega un token nuevo para esta. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const remembered = !!this.storage.get<Session>(SESSION_KEY) && !this.storage.getSession<Session>(SESSION_KEY);
    const res = await firstValueFrom(this.http.post<{ token: string }>(
      `${API_URL}/auth/change-password`, { currentPassword, newPassword, remember: remembered },
    ));
    const current = this._session();
    if (!current) return;
    const session: Session = { ...current, token: res.token };
    this._session.set(session);
    if (remembered) this.storage.set(SESSION_KEY, session);
    else this.storage.setSession(SESSION_KEY, session);
  }

  logout(): void {
    this._session.set(null);
    this.storage.remove(SESSION_KEY);
    this.storage.removeSession(SESSION_KEY);
    // Recarga completa: descarta de memoria todos los datos cacheados del usuario anterior.
    window.location.assign('/login');
  }
}
