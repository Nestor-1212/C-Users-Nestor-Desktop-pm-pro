import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AppNotification, User } from '../models';

/**
 * Historial persistente de eventos ("te respondieron", "nuevo ticket", etc.),
 * distinto del NotificationService (toasts efímeros de confirmación de la
 * propia acción del usuario). Este sobrevive a recargas y se consulta desde
 * el centro de notificaciones del layout.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private storage = inject(StorageService);
  private _items = signal<AppNotification[]>([]);
  items = this._items.asReadonly();

  private static readonly MAX_ITEMS = 200;

  constructor() {
    this._items.set(this.storage.get<AppNotification[]>('notifications') || []);
  }

  private save(items: AppNotification[]) {
    this._items.set(items);
    this.storage.set('notifications', items);
  }

  notifyOwner(title: string, message: string, link: string): void {
    this.push({ recipientRole: 'owner', title, message, link });
  }

  notifyCompany(companyId: string, title: string, message: string, link: string): void {
    this.push({ recipientRole: 'client', recipientCompanyId: companyId, title, message, link });
  }

  private push(data: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): void {
    const notification: AppNotification = {
      ...data,
      id: 'n' + Date.now() + Math.random().toString(36).slice(2, 7),
      read: false,
      createdAt: new Date().toISOString()
    };
    this.save([notification, ...this._items()].slice(0, NotificationCenterService.MAX_ITEMS));
  }

  forUser(user: User): AppNotification[] {
    return this._items().filter(n =>
      n.recipientRole === user.role && (user.role === 'owner' || n.recipientCompanyId === user.companyId)
    );
  }

  unreadCount(user: User): number {
    return this.forUser(user).filter(n => !n.read).length;
  }

  markRead(id: string): void {
    this.save(this._items().map(n => n.id === id ? { ...n, read: true } : n));
  }

  markAllRead(user: User): void {
    const ids = new Set(this.forUser(user).map(n => n.id));
    this.save(this._items().map(n => ids.has(n.id) ? { ...n, read: true } : n));
  }
}
