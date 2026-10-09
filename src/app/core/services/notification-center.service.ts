import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppNotification } from '../models';
import { API_URL } from '../config/api.config';
import { toNotification } from '../http/mappers';

/**
 * Historial de eventos ("te respondieron", "nuevo ticket"...). Las genera el
 * servidor al ocurrir cada acción y ya llegan filtradas para el usuario actual.
 * Distinto de NotificationService (toasts de confirmación de la propia acción).
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private http = inject(HttpClient);
  private _items = signal<AppNotification[]>([]);
  items = this._items.asReadonly();

  async load(): Promise<void> {
    const res = await firstValueFrom(this.http.get<{ items: any[] }>(`${API_URL}/notifications`));
    this._items.set(res.items.map(toNotification));
  }

  unreadCount(): number {
    return this._items().filter(n => !n.read).length;
  }

  async markRead(id: string): Promise<void> {
    this._items.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
    await firstValueFrom(this.http.patch(`${API_URL}/notifications/${id}/read`, {}));
  }

  async markAllRead(): Promise<void> {
    this._items.update(list => list.map(n => ({ ...n, read: true })));
    await firstValueFrom(this.http.patch(`${API_URL}/notifications/read-all`, {}));
  }
}
