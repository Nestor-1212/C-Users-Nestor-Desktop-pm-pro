import { Component, inject } from '@angular/core';
import { ConfirmService } from '../services/confirm.service';
import { ModalFocusTrapDirective } from '../directives/modal-focus-trap.directive';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalFocusTrapDirective, IconComponent],
  template: `
    @if (confirm.request(); as req) {
      <div class="modal-overlay" (click)="resolve(false)">
        <div class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
          appModalFocusTrap (closeRequested)="resolve(false)" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="confirm-title">{{ req.title }}</h2>
            <button type="button" class="modal-close" (click)="resolve(false)" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <div class="modal-body">
            <p class="confirm-message">{{ req.message }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" (click)="resolve(false)">{{ req.cancelLabel }}</button>
            <button type="button" [class]="req.danger ? 'btn-danger' : 'btn-primary'" (click)="resolve(true)">
              {{ req.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-modal { max-width: 420px; }
    .confirm-message { margin: 0; font-size: 14px; color: var(--color-text-secondary, #475569); line-height: 1.6; }
  `]
})
export class ConfirmDialogComponent {
  confirm = inject(ConfirmService);

  resolve(value: boolean) {
    this.confirm.resolve(value);
  }
}
