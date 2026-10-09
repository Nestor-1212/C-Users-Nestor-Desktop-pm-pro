import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, 'danger'>> {
  danger: boolean;
  resolve: (value: boolean) => void;
}

/**
 * Reemplazo del `window.confirm()` nativo (sin estilo propio, sin indicar
 * consecuencias) por un modal propio, consistente con el resto de la UI.
 * Uso: `const ok = await this.confirm.ask({ message: '¿Eliminar...?' });`
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private _request = signal<ConfirmRequest | null>(null);
  request = this._request.asReadonly();

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this._request.set({
        title: options.title ?? 'Confirmar acción',
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        resolve,
      });
    });
  }

  resolve(value: boolean) {
    this._request()?.resolve(value);
    this._request.set(null);
  }
}
