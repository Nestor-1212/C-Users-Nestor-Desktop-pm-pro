import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { NotificationService } from '../../shared/services/notification.service';
import { loadPageData } from '../../core/http/api-error';
import { IconComponent, IconName } from '../../shared/icon/icon.component';

const ENTITY_ICON: Record<string, IconName> = {
  company: 'building',
  user: 'users',
  project: 'folder',
  ticket: 'ticket',
  invoice: 'dollar-sign'
};

const ENTITY_LABEL: Record<string, string> = {
  company: 'Empresa',
  user: 'Usuario',
  project: 'Proyecto',
  ticket: 'Ticket',
  invoice: 'Factura'
};

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, DatePipe, IconComponent],
  template: `
    <div class="activity-page">
      <div class="page-header">
        <div>
          <h1>Bitácora de Actividad</h1>
          <p>Historial de acciones realizadas en el sistema</p>
        </div>
      </div>

      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="activity-search" class="sr-only">Buscar en la bitácora</label>
          <input id="activity-search" type="text" placeholder="Buscar por persona o acción..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="activity-type-filter" class="sr-only">Filtrar por tipo</label>
        <select id="activity-type-filter" class="filter-select" (change)="typeFilter.set($any($event.target).value)">
          <option value="">Todos los tipos</option>
          <option value="company">Empresas</option>
          <option value="user">Usuarios</option>
          <option value="project">Proyectos</option>
          <option value="ticket">Tickets</option>
          <option value="invoice">Facturas</option>
        </select>
      </div>

      <div class="activity-list">
        @for (e of filteredEntries(); track e.id) {
          <div class="activity-row">
            <div class="activity-icon" [class]="e.entityType">
              <app-icon [name]="entityIcon(e.entityType)" [size]="16" />
            </div>
            <div class="activity-main">
              <p class="activity-desc"><strong>{{ e.actorName }}</strong> {{ e.description }}</p>
              <span class="activity-date">{{ e.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <span class="activity-type-chip">{{ entityLabel(e.entityType) }}</span>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon"><app-icon name="clock" [size]="32" /></div>
            <h3>Sin actividad</h3>
            <p>No hay eventos que coincidan con tu búsqueda.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .activity-page { max-width: 900px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .activity-list { display: flex; flex-direction: column; gap: 8px; }
    .activity-row {
      display: flex; align-items: center; gap: 14px; background: white; border-radius: 12px;
      border: 1px solid #e2e8f0; padding: 14px 16px;
    }
    .activity-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .activity-icon.company { background: var(--color-primary-50, #e8f1fd); color: var(--color-primary-700, #0f4b92); }
    .activity-icon.user { background: #f3f7e3; color: #718320; }
    .activity-icon.project { background: #e0e7ff; color: #4338ca; }
    .activity-icon.ticket { background: #fcefdf; color: #9a5d09; }
    .activity-icon.invoice { background: #dcfce7; color: #16a34a; }
    .activity-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .activity-desc { font-size: 13.5px; color: #374151; margin: 0; line-height: 1.4; }
    .activity-desc strong { color: #0f172a; }
    .activity-date { font-size: 11.5px; color: #94a3b8; }
    .activity-type-chip {
      background: var(--color-neutral-bg, #f1f5f9); color: #64748b; padding: 4px 10px;
      border-radius: 20px; font-size: 11px; font-weight: 600; flex-shrink: 0;
    }

    @media (max-width: 560px) {
      .activity-type-chip { display: none; }
    }
  `]
})
export class ActivityComponent {
  private activityLog = inject(ActivityLogService);
  private notify = inject(NotificationService);

  constructor() {
    loadPageData(this.notify, this.activityLog.load());
  }

  search = signal('');
  typeFilter = signal('');

  entries = this.activityLog.entries;

  filteredEntries = computed(() => {
    let list = this.entries();
    const s = this.search().toLowerCase();
    const tf = this.typeFilter();
    if (s) list = list.filter(e => e.actorName.toLowerCase().includes(s) || e.description.toLowerCase().includes(s));
    if (tf) list = list.filter(e => e.entityType === tf);
    return list;
  });

  entityIcon(type: string): IconName { return ENTITY_ICON[type] || 'clock'; }
  entityLabel(type: string): string { return ENTITY_LABEL[type] || type; }
}
