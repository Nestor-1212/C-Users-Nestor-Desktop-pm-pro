import { Component, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

export type ExportFormat = 'excel' | 'pdf';

/**
 * Botón "Exportar" reutilizable (Excel/PDF). La lógica de qué columnas y qué
 * filas exportar vive en cada pantalla (tickets, proyectos); este componente
 * solo resuelve el menú y emite el formato elegido.
 */
@Component({
  selector: 'app-export-menu',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="export-menu">
      <button type="button" class="btn-secondary" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <app-icon name="download" [size]="16" /> Exportar
      </button>
      @if (open()) {
        <div class="export-backdrop" (click)="open.set(false)"></div>
        <div class="export-dropdown" role="menu">
          <button type="button" role="menuitem" (click)="pick('excel')">
            <app-icon name="file-text" [size]="14" /> Excel (.xlsx)
          </button>
          <button type="button" role="menuitem" (click)="pick('pdf')">
            <app-icon name="file-text" [size]="14" /> PDF
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .export-menu { position: relative; }
    .export-backdrop { position: fixed; inset: 0; z-index: 110; }
    .export-dropdown {
      position: absolute; top: calc(100% + 6px); right: 0; z-index: 120; min-width: 170px;
      background: var(--color-surface, #fff); border-radius: var(--radius-md, 10px);
      box-shadow: var(--shadow-modal, 0 20px 60px rgba(0,0,0,0.2)); border: 1px solid var(--color-border, #e2e8f0);
      overflow: hidden; padding: 6px;
    }
    .export-dropdown button {
      display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px;
      border: none; background: none; border-radius: 6px; cursor: pointer;
      font-size: 13px; color: var(--color-text, #0f172a); text-align: left;
    }
    .export-dropdown button:hover { background: var(--color-neutral-bg, #f1f5f9); }
  `]
})
export class ExportMenuComponent {
  open = signal(false);
  formatSelected = output<ExportFormat>();

  pick(format: ExportFormat) {
    this.open.set(false);
    this.formatSelected.emit(format);
  }
}
