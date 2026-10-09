import { Component, inject } from '@angular/core';
import { NotificationService } from '../services/notification.service';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class]="toast.type">
          <app-icon [name]="iconFor(toast.type)" [size]="16" />
          <span class="toast-msg">{{ toast.message }}</span>
          <button type="button" class="toast-close" (click)="notifications.dismiss(toast.id)" aria-label="Cerrar notificación">
            <app-icon name="x" [size]="13" />
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed; top: 20px; right: 20px; z-index: 2000;
      display: flex; flex-direction: column; gap: 10px;
      max-width: calc(100vw - 40px);
    }
    .toast {
      display: flex; align-items: center; gap: 10px;
      background: var(--color-surface, #fff); border-radius: var(--radius-md, 10px);
      padding: 12px 14px; min-width: 260px; max-width: 360px;
      box-shadow: var(--shadow-modal, 0 10px 30px rgba(0,0,0,0.15));
      border-left: 4px solid var(--color-text-muted, #64748b);
      font-size: 13px; font-weight: 500; color: var(--color-text, #0f172a);
      animation: toast-in 0.2s ease;
    }
    .toast.success { border-left-color: var(--color-success-text, #16a34a); }
    .toast.success app-icon { color: var(--color-success-text, #16a34a); }
    .toast.error { border-left-color: var(--color-danger-text, #dc2626); }
    .toast.error app-icon { color: var(--color-danger-text, #dc2626); }
    .toast.info { border-left-color: var(--color-info-text, #1d4ed8); }
    .toast.info app-icon { color: var(--color-info-text, #1d4ed8); }
    .toast-msg { flex: 1; line-height: 1.4; }
    .toast-close {
      background: none; border: none; cursor: pointer; color: var(--color-text-muted, #64748b);
      flex-shrink: 0; width: 22px; height: 22px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
    }
    .toast-close:hover { background: var(--color-neutral-bg, #f1f5f9); }
    @keyframes toast-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }

    @media (max-width: 480px) {
      .toast-stack { left: 16px; right: 16px; top: 16px; }
      .toast { min-width: 0; max-width: none; }
    }
  `]
})
export class ToastComponent {
  notifications = inject(NotificationService);

  iconFor(type: string): IconName {
    if (type === 'success') return 'check';
    if (type === 'error') return 'alert-triangle';
    return 'inbox';
  }
}
