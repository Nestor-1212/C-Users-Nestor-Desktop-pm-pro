import { Component, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export type StatCardColor = 'blue' | 'indigo' | 'green' | 'yellow' | 'red' | 'orange' | 'gray';

/**
 * Tarjeta KPI unica para toda la app.
 *
 * Antes existian tres implementaciones visuales distintas del mismo concepto
 * (una metrica con numero + etiqueta): `.stat-card` en el dashboard,
 * `.qs-card` en Empresas y `.ts-card` en Tickets. Este componente reemplaza
 * las tres con un unico patron (icono + valor + etiqueta), parametrizado por
 * color semantico.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="stat-card" [class]="color()">
      <div class="stat-icon"><app-icon [name]="icon()" [size]="20" /></div>
      <div class="stat-info">
        <span class="stat-value">{{ value() }}</span>
        <span class="stat-label">{{ label() }}</span>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      background: var(--color-surface, #fff); border-radius: var(--radius-xl, 16px); padding: 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
      border: 1px solid var(--color-border, #f1f5f9);
      height: 100%; box-sizing: border-box;
      transition: box-shadow 0.2s, transform 0.2s;
    }
    .stat-card:hover { box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0,0,0,0.08)); transform: translateY(-2px); }
    .stat-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .stat-info { min-width: 0; }
    .stat-value { font-size: 28px; font-weight: 800; display: block; line-height: 1; }
    .stat-label { font-size: 12px; color: var(--color-text-muted, #64748b); font-weight: 500; display: block; margin-top: 4px; }

    .stat-card.blue .stat-value { color: var(--color-primary-700, #0f4b92); }
    .stat-card.blue .stat-icon { background: var(--color-primary-50, #e8f1fd); color: var(--color-primary-700, #0f4b92); }
    .stat-card.indigo .stat-value { color: #4338ca; }
    .stat-card.indigo .stat-icon { background: #e0e7ff; color: #4338ca; }
    .stat-card.green .stat-value { color: #059669; }
    .stat-card.green .stat-icon { background: #f0fdf4; color: #059669; }
    .stat-card.yellow .stat-value { color: #d97706; }
    .stat-card.yellow .stat-icon { background: #fef3c7; color: #d97706; }
    .stat-card.red .stat-value { color: #dc2626; }
    .stat-card.red .stat-icon { background: #fee2e2; color: #dc2626; }
    .stat-card.orange .stat-value { color: #ea580c; }
    .stat-card.orange .stat-icon { background: #fed7aa; color: #ea580c; }
    .stat-card.gray .stat-value { color: #64748b; }
    .stat-card.gray .stat-icon { background: #f1f5f9; color: #64748b; }
  `]
})
export class StatCardComponent {
  value = input.required<number | string>();
  label = input.required<string>();
  icon = input.required<IconName>();
  color = input<StatCardColor>('blue');
}
