import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivityFilters, ActivityLogService, ActivitySummary } from '../../core/services/activity-log.service';
import { NotificationService } from '../../shared/services/notification.service';
import { apiErrorMessage } from '../../core/http/api-error';
import { ActivityEntity, ActivityKind, ActivityLogEntry } from '../../core/models';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { ExportMenuComponent, ExportFormat } from '../../shared/export-menu/export-menu.component';
import { ReportService, ReportColumn, ReportTone } from '../../shared/services/report.service';

type Period = 'today' | '7d' | '30d' | '90d' | 'all';

const ENTITY: Record<string, { label: string; icon: IconName }> = {
  ticket: { label: 'Ticket', icon: 'ticket' },
  project: { label: 'Proyecto', icon: 'folder' },
  company: { label: 'Empresa', icon: 'building' },
  user: { label: 'Usuario', icon: 'user' },
  invoice: { label: 'Factura', icon: 'file-text' },
};

const KIND_LABEL: Record<ActivityKind, string> = {
  create: 'Creación', update: 'Cambio', delete: 'Eliminación', status: 'Estado',
  assign: 'Asignación', comment: 'Comentario', access: 'Acceso', security: 'Seguridad',
};

const ROLE_LABEL: Record<string, string> = { owner: 'Administrador', technician: 'Técnico', client: 'Cliente' };
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, IconComponent, ExportMenuComponent],
  template: `
    <div class="activity-page">
      <div class="page-header">
        <div>
          <h1>Bitácora</h1>
          <p>Quién hizo qué y cuándo: cada acción del sistema queda registrada y no se puede editar</p>
        </div>
        <app-export-menu (formatSelected)="export($event)" />
      </div>

      <div class="activity-layout">
      <aside class="side">
      <!-- Periodo -->
      <div class="periods" role="group" aria-label="Periodo">
        @for (p of periods; track p.value) {
          <button [class.active]="period() === p.value" (click)="setPeriod(p.value)">{{ p.label }}</button>
        }
      </div>

      <!-- Resumen -->
      @if (summary(); as s) {
        <div class="summary">
          <div class="sum"><strong>{{ s.total }}</strong><span>Eventos</span></div>
          <div class="sum"><strong>{{ activePeople() }}</strong><span>Personas activas</span></div>
          <div class="sum"><strong>{{ s.byKind.access ?? 0 }}</strong><span>Inicios de sesión</span></div>
          <button class="sum clickable" [class.alert]="(s.byKind.delete ?? 0) > 0" (click)="setKind('delete')">
            <strong>{{ s.byKind.delete ?? 0 }}</strong><span>Eliminaciones</span>
          </button>
          <button class="sum clickable" [class.alert]="(s.byKind.security ?? 0) > 0" (click)="setKind('security')">
            <strong>{{ s.byKind.security ?? 0 }}</strong><span>Eventos de seguridad</span>
          </button>
        </div>

        @if (chart().length > 1) {
          <div class="chart card">
            <div class="chart-head"><h3>Actividad por día</h3><span>{{ chartPeak() }}</span></div>
            <div class="bars">
              @for (b of chart(); track b.key) {
                <div class="bar-col" [title]="b.label + ': ' + b.value + ' evento(s)'">
                  <div class="bar" [style.height.%]="b.pct" [class.today]="b.isToday"></div>
                  <span class="bar-label">{{ b.short }}</span>
                </div>
              }
            </div>
          </div>
        }

        @if (topPeople().length) {
          <div class="people card">
            <h3>Más activos en el periodo</h3>
            @for (a of topPeople(); track a.id) {
              <button class="person" [class.active]="actorId() === a.id" (click)="setActor(actorId() === a.id ? null : a.id)">
                <span class="av sm" [class]="a.role ?? 'unknown'">{{ initialsOf(a.name) }}</span>
                <span class="person-name">{{ a.name }}<small>{{ roleLabel(a.role) }}</small></span>
                <span class="person-bar"><span [style.width.%]="a.pct"></span></span>
                <strong>{{ a.count }}</strong>
              </button>
            }
          </div>
        }
      }
      </aside>

      <div class="main">
      <!-- Filtros -->
      <div class="filters">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="activity-search" class="sr-only">Buscar en la bitácora</label>
          <input id="activity-search" type="text" class="search-input" placeholder="Buscar: nombre de ticket, proyecto, persona…"
            [value]="search()" (input)="onSearch($any($event.target).value)">
        </div>
        <div class="chips" role="group" aria-label="Tipo de registro">
          @for (e of entities; track e.value) {
            <button [class.active]="entity() === e.value" (click)="setEntity(e.value)">
              @if (e.icon) { <app-icon [name]="e.icon" [size]="13" /> } {{ e.label }}
            </button>
          }
        </div>
        <label for="activity-kind" class="sr-only">Tipo de acción</label>
        <select id="activity-kind" class="filter-select" (change)="setKind($any($event.target).value || null)">
          <option value="" [selected]="!kind()">Todas las acciones</option>
          @for (k of kinds; track k) { <option [value]="k" [selected]="kind() === k">{{ kindLabel(k) }}</option> }
        </select>
        <label for="activity-actor" class="sr-only">Persona</label>
        <select id="activity-actor" class="filter-select" (change)="setActor($any($event.target).value || null)">
          <option value="" [selected]="!actorId()">Todas las personas</option>
          @for (a of actors(); track a.id) { <option [value]="a.id" [selected]="actorId() === a.id">{{ a.name }} ({{ a.count }})</option> }
        </select>
        @if (hasFilters()) {
          <button class="clear" (click)="clearFilters()"><app-icon name="x" [size]="13" /> Limpiar filtros</button>
        }
      </div>

      <!-- Línea de tiempo -->
      <div class="timeline">
        @for (g of groups(); track g.key) {
          <section class="day">
            <h2 class="day-title">{{ g.label }} <span>{{ g.items.length }}</span></h2>
            <div class="day-card">
              @for (e of g.items; track e.id) {
                <div class="entry" [class]="'k-' + e.kind">
                  <span class="time">{{ e.createdAt | date:'HH:mm' }}</span>
                  <span class="av" [class]="e.actorRole ?? 'unknown'" [title]="roleLabel(e.actorRole)">{{ initialsOf(e.actorName) }}</span>
                  <div class="entry-main">
                    <p><strong>{{ e.actorName }}</strong> {{ e.description }}</p>
                    <span class="meta">
                      <span class="role">{{ roleLabel(e.actorRole) }}</span>
                      <span class="entity"><app-icon [name]="entityIcon(e.entityType)" [size]="11" /> {{ entityLabel(e.entityType) }}</span>
                      @if (e.ip) { <span class="ip">IP {{ e.ip }}</span> }
                    </span>
                  </div>
                  <span class="kind" [class]="e.kind">{{ kindLabel(e.kind) }}</span>
                  @if (linkFor(e); as link) {
                    <a class="go" [routerLink]="link" [attr.aria-label]="'Abrir ' + entityLabel(e.entityType)" title="Abrir"><app-icon name="chevron-right" [size]="16" /></a>
                  } @else {
                    <span class="go-placeholder"></span>
                  }
                </div>
              }
            </div>
          </section>
        } @empty {
          @if (!loading()) {
            <div class="empty-state">
              <div class="empty-icon"><app-icon name="clock" [size]="30" /></div>
              <h3>Sin eventos</h3>
              <p>No hay actividad que coincida con estos filtros.</p>
            </div>
          }
        }
        @if (nextCursor()) {
          <button class="more" [disabled]="loading()" (click)="loadMore()">
            {{ loading() ? 'Cargando…' : 'Cargar más eventos' }}
          </button>
        }
        @if (loading() && !entries().length) { <p class="loading">Cargando bitácora…</p> }
      </div>
      </div>
      </div>
    </div>
  `,
  styles: [`
    .activity-page { max-width: var(--page-max-width); margin: 0 auto; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; }

    /* Pantallas anchas: línea de tiempo a la izquierda y resumen fijo a la derecha. */
    .activity-layout { display: flex; flex-direction: column; }
    .main { min-width: 0; }
    @media (min-width: 1280px) {
      .activity-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 22px; align-items: start; }
      .side { order: 2; position: sticky; top: 16px; display: flex; flex-direction: column; }
      .side .summary { grid-template-columns: 1fr 1fr; }
      .side .summary .sum:first-child { grid-column: 1 / -1; }
    }
    .people { padding: 14px 16px; margin-bottom: 14px; }
    .people h3 { margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0f172a; }
    .person { width: 100%; display: flex; align-items: center; gap: 10px; padding: 7px 8px; border: none; background: none; border-radius: 10px; cursor: pointer; text-align: left; font-family: inherit; }
    .person:hover { background: #f8fafc; }
    .person.active { background: #eef4fc; }
    .person-name { display: flex; flex-direction: column; font-size: 13px; font-weight: 600; color: #0f172a; width: 150px; flex-shrink: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .person-name small { font-size: 11px; color: #94a3b8; font-weight: 500; }
    .person-bar { flex: 1; height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .person-bar span { display: block; height: 100%; background: #0f4b92; border-radius: 999px; }
    .person strong { font-size: 13px; color: #0f172a; min-width: 22px; text-align: right; }
    .av.sm { width: 28px; height: 28px; font-size: 10.5px; }
    .periods { display: inline-flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; margin-bottom: 14px; flex-wrap: wrap; }
    .periods button { border: none; background: none; padding: 7px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; }
    .periods button.active { background: #0f4b92; color: #fff; }

    .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
    .sum { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; text-align: left; font-family: inherit; }
    .sum strong { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.15; }
    .sum span { font-size: 12px; color: #64748b; }
    .sum.clickable { cursor: pointer; }
    .sum.clickable:hover { border-color: #0f4b92; }
    .sum.alert strong { color: #dc2626; }

    .chart { padding: 14px 18px; margin-bottom: 14px; }
    .chart-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .chart-head h3 { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    .chart-head span { font-size: 12px; color: #64748b; }
    .bars { display: flex; align-items: flex-end; gap: 3px; height: 90px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; justify-content: flex-end; }
    .bar { width: 100%; max-width: 22px; background: #93bdf0; border-radius: 3px 3px 0 0; min-height: 2px; }
    .bar.today { background: #0f4b92; }
    .bar-label { font-size: 9.5px; color: #94a3b8; margin-top: 4px; white-space: nowrap; }

    .filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 18px; }
    .filters .search-wrap { flex: 1 1 260px; }
    .chips { display: inline-flex; gap: 4px; flex-wrap: wrap; }
    .chips button { display: inline-flex; align-items: center; gap: 5px; border: 1.5px solid #e2e8f0; background: #fff; padding: 6px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; }
    .chips button.active { border-color: #0f4b92; background: #0f4b92; color: #fff; }
    .clear { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; color: #dc2626; font-weight: 700; font-size: 12.5px; cursor: pointer; }

    .day { margin-bottom: 18px; }
    .day-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; color: #334155; text-transform: capitalize; margin: 0 0 8px; }
    .day-title span { background: #e2e8f0; color: #475569; border-radius: 999px; padding: 0 8px; font-size: 11px; }
    .day-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    .entry { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; border-left: 3px solid transparent; }
    .entry:last-child { border-bottom: none; }
    .entry.k-delete { border-left-color: #ef4444; }
    .entry.k-security { border-left-color: #ef4444; background: #fffafa; }
    .time { font-size: 12px; font-weight: 700; color: #64748b; width: 40px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .av { width: 32px; height: 32px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #94a3b8; }
    .av.owner { background: #0f4b92; }
    .av.technician { background: #e99d34; }
    .av.client { background: #a9c238; }
    .entry-main { flex: 1; min-width: 0; }
    .entry-main p { margin: 0; font-size: 13.5px; color: #334155; line-height: 1.4; }
    .entry-main strong { color: #0f172a; }
    .meta { display: flex; gap: 10px; font-size: 11.5px; color: #94a3b8; margin-top: 2px; flex-wrap: wrap; }
    .meta span { display: inline-flex; align-items: center; gap: 3px; }
    .ip { font-family: ui-monospace, Consolas, monospace; }
    .kind { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 999px; flex-shrink: 0; background: #f1f5f9; color: #475569; }
    .kind.create { background: #f2f7e1; color: #5b6b12; }
    .kind.delete, .kind.security { background: #fee2e2; color: #dc2626; }
    .kind.status { background: #eef4fc; color: #0f4b92; }
    .kind.assign { background: #fdf3e6; color: #a8620a; }
    .kind.comment { background: #f5f3ff; color: #6d28d9; }
    .kind.access { background: #f1f5f9; color: #64748b; }
    .go { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; flex-shrink: 0; }
    .go:hover { background: #eef4fc; color: #0f4b92; }
    .go-placeholder { width: 28px; flex-shrink: 0; }

    .more { display: block; margin: 6px auto 0; border: 1.5px solid #e2e8f0; background: #fff; padding: 10px 22px; border-radius: 12px; font-weight: 700; color: #0f4b92; cursor: pointer; }
    .more:hover { border-color: #0f4b92; }
    .loading { text-align: center; color: #94a3b8; font-size: 13px; }

    @media (max-width: 800px) { .summary { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 560px) {
      .summary { grid-template-columns: 1fr 1fr; }
      .kind { display: none; }
      .time { width: 34px; }
    }
  `]
})
export class ActivityComponent {
  private activityLog = inject(ActivityLogService);
  private reports = inject(ReportService);
  private notify = inject(NotificationService);

  readonly periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Hoy' }, { value: '7d', label: '7 días' }, { value: '30d', label: '30 días' },
    { value: '90d', label: '90 días' }, { value: 'all', label: 'Todo' },
  ];
  readonly entities: { value: ActivityEntity | null; label: string; icon?: IconName }[] = [
    { value: null, label: 'Todo' },
    { value: 'ticket', label: 'Tickets', icon: 'ticket' },
    { value: 'project', label: 'Proyectos', icon: 'folder' },
    { value: 'company', label: 'Empresas', icon: 'building' },
    { value: 'user', label: 'Usuarios y accesos', icon: 'user' },
  ];
  readonly kinds = Object.keys(KIND_LABEL) as ActivityKind[];

  period = signal<Period>('7d');
  entity = signal<ActivityEntity | null>(null);
  kind = signal<ActivityKind | null>(null);
  actorId = signal<string | null>(null);
  search = signal('');

  entries = signal<ActivityLogEntry[]>([]);
  nextCursor = signal<string | null>(null);
  summary = signal<ActivitySummary | null>(null);
  /** Personas del periodo (sin filtrar por persona, para que el selector no se vacíe al elegir una). */
  actors = signal<ActivitySummary['actors']>([]);
  loading = signal(false);
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Evita que una respuesta lenta de una búsqueda anterior pise la actual. */
  private requestId = 0;

  constructor() {
    this.refresh();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  private from(): string | undefined {
    const p = this.period();
    if (p === 'all') return undefined;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (p === '7d') d.setDate(d.getDate() - 6);
    if (p === '30d') d.setDate(d.getDate() - 29);
    if (p === '90d') d.setDate(d.getDate() - 89);
    return d.toISOString();
  }

  private filters(): ActivityFilters {
    return {
      from: this.from(), entityType: this.entity() ?? undefined, kind: this.kind() ?? undefined,
      actorId: this.actorId() ?? undefined, search: this.search(),
    };
  }

  async refresh() {
    const id = ++this.requestId;
    this.loading.set(true);
    try {
      const f = this.filters();
      const [page, summary, people] = await Promise.all([
        this.activityLog.page(f),
        this.activityLog.summary(f),
        f.actorId ? this.activityLog.summary({ ...f, actorId: undefined }) : Promise.resolve(null),
      ]);
      if (id !== this.requestId) return;
      this.entries.set(page.items);
      this.nextCursor.set(page.nextCursor);
      this.summary.set(summary);
      this.actors.set((people ?? summary).actors);
    } catch (err) {
      if (id === this.requestId) this.notify.error(apiErrorMessage(err));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  async loadMore() {
    const cursor = this.nextCursor();
    if (!cursor) return;
    const id = this.requestId;
    this.loading.set(true);
    try {
      const page = await this.activityLog.page(this.filters(), cursor);
      if (id !== this.requestId) return; // cambiaron los filtros mientras cargaba
      this.entries.update(list => [...list, ...page.items]);
      this.nextCursor.set(page.nextCursor);
    } catch (err) {
      if (id === this.requestId) this.notify.error(apiErrorMessage(err));
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }

  setPeriod(p: Period) { this.period.set(p); this.refresh(); }
  setEntity(e: ActivityEntity | null) { this.entity.set(e); this.refresh(); }
  setKind(k: ActivityKind | null) { this.kind.set(this.kind() === k ? null : k); this.refresh(); }
  setActor(id: string | null) { this.actorId.set(id); this.refresh(); }
  onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh(), 350);
  }

  hasFilters = computed(() => !!(this.entity() || this.kind() || this.actorId() || this.search().trim()));
  clearFilters() {
    this.entity.set(null); this.kind.set(null); this.actorId.set(null); this.search.set('');
    this.refresh();
  }

  activePeople = computed(() => this.actors().filter(a => a.role).length);

  /** Las 6 personas con más eventos del periodo (sin intentos anónimos). */
  topPeople = computed(() => {
    const people = this.actors().filter(a => a.role).slice(0, 6);
    const max = Math.max(1, ...people.map(p => p.count));
    return people.map(p => ({ ...p, pct: (p.count / max) * 100 }));
  });

  /** Eventos agrupados por día local: "Hoy", "Ayer", "lunes 6 de octubre". */
  groups = computed(() => {
    const today = dayKey(new Date());
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = dayKey(y);
    const map = new Map<string, ActivityLogEntry[]>();
    for (const e of this.entries()) {
      const k = dayKey(new Date(e.createdAt));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()].map(([key, items]) => {
      const d = new Date(items[0].createdAt);
      const label = key === today ? 'Hoy' : key === yesterday ? 'Ayer'
        : d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }) });
      return { key, label, items };
    });
  });

  /** Barras por día del periodo (hasta 30 días; para periodos largos no aporta). */
  chart = computed(() => {
    const s = this.summary();
    const p = this.period();
    if (!s || p === 'today' || p === 'all' || p === '90d') return [];
    const days = p === '7d' ? 7 : 30;
    const out: { key: string; label: string; short: string; value: number; pct: number; isToday: boolean }[] = [];
    // El servidor agrupa por día en la zona horaria del negocio, igual que el navegador.
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = dayKey(d);
      out.push({
        key, value: s.byDay[key] ?? 0, pct: 0, isToday: i === 0,
        label: d.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'short' }),
        short: days === 7 ? d.toLocaleDateString('es-GT', { weekday: 'short' }) : String(d.getDate()),
      });
    }
    const max = Math.max(1, ...out.map(o => o.value));
    return out.map(o => ({ ...o, pct: (o.value / max) * 100 }));
  });

  chartPeak = computed(() => {
    const c = this.chart();
    if (!c.length) return '';
    const top = c.reduce((a, b) => (b.value > a.value ? b : a));
    return top.value ? `Día más activo: ${top.label} (${top.value})` : '';
  });

  initialsOf = initials;
  kindLabel(k: ActivityKind) { return KIND_LABEL[k] ?? k; }
  roleLabel(r?: string) { return r ? ROLE_LABEL[r] ?? r : 'Desconocido'; }
  entityIcon(t: string): IconName { return ENTITY[t]?.icon ?? 'clock'; }
  entityLabel(t: string) { return ENTITY[t]?.label ?? t; }

  /** Enlace al registro afectado, salvo que ya no exista (eliminado) o no tenga página propia. */
  linkFor(e: ActivityLogEntry): string[] | null {
    if (e.kind === 'delete' || !e.entityId) return null;
    if (e.entityType === 'ticket') return ['/tickets', e.entityId];
    if (e.entityType === 'project') return ['/projects', e.entityId];
    if (e.entityType === 'company') return ['/companies'];
    return null;
  }

  export(format: ExportFormat) {
    const rows = this.entries();
    const kindTone: Partial<Record<ActivityKind, ReportTone>> = { create: 'ok', delete: 'bad', security: 'bad', status: 'info', assign: 'warn', access: 'muted' };
    const columns: ReportColumn<ActivityLogEntry>[] = [
      { header: 'Fecha y hora', value: e => new Date(e.createdAt).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), width: 1.3 },
      { header: 'Persona', value: e => e.actorName, width: 1.3 },
      { header: 'Rol', value: e => this.roleLabel(e.actorRole), width: 0.9 },
      { header: 'Acción', value: e => e.description, width: 3.2 },
      { header: 'Tipo', value: e => this.kindLabel(e.kind), width: 0.9, align: 'center', tone: e => kindTone[e.kind] ?? null },
      { header: 'Registro', value: e => this.entityLabel(e.entityType), width: 0.9 },
      { header: 'IP', value: e => e.ip ?? '', width: 1 },
    ];
    const period = this.periods.find(p => p.value === this.period())?.label ?? '';
    const actor = this.actors().find(a => a.id === this.actorId())?.name;
    const entity = this.entities.find(e => e.value === this.entity())?.label;
    const s = this.summary();
    this.reports.export(format, {
      title: 'Bitácora de actividad',
      subtitle: [`Periodo: ${period}`, this.entity() && entity, this.kind() && `Acción: ${this.kindLabel(this.kind()!)}`, actor && `Persona: ${actor}`, this.search().trim() && `Búsqueda: "${this.search().trim()}"`].filter(Boolean).join(' · '),
      filename: 'bitacora',
      columns, rows,
      summary: s ? [
        { label: 'Eventos en el periodo', value: s.total },
        { label: 'Personas activas', value: this.activePeople() },
        { label: 'Eliminaciones', value: s.byKind.delete ?? 0, tone: s.byKind.delete ? 'bad' : 'ok' },
        { label: 'Eventos de seguridad', value: s.byKind.security ?? 0, tone: s.byKind.security ? 'bad' : 'ok' },
      ] : undefined,
    });
    if (this.nextCursor()) this.notify.success(`Se exportaron los ${rows.length} eventos cargados. Usa "Cargar más" para incluir más.`);
  }
}
