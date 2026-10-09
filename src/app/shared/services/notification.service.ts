import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

/**
 * Sistema de notificaciones (toast) centralizado.
 *
 * Antes, crear/editar/eliminar una empresa, proyecto o ticket cerraba el
 * modal en silencio, sin confirmar al usuario que la accion tuvo exito
 * (violaba el principio de "visibilidad del estado del sistema"). Este
 * servicio se inyecta desde cualquier componente y el <app-toast/> montado
 * una sola vez en app.html se encarga de mostrarlo.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();
  private nextId = 1;
  private readonly AUTO_DISMISS_MS = 4000;

  success(message: string) { this.push('success', message); }
  error(message: string) { this.push('error', message); }
  info(message: string) { this.push('info', message); }

  dismiss(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  private push(type: ToastType, message: string) {
    const id = this.nextId++;
    this._toasts.update(list => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), this.AUTO_DISMISS_MS);
  }
}
