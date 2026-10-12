import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TicketService } from '../../core/services/ticket.service';
import { ProjectService } from '../../core/services/project.service';
import { CompanyService } from '../../core/services/company.service';
import { UserService } from '../../core/services/user.service';
import { NotificationService } from '../../shared/services/notification.service';
import { loadPageData } from '../../core/http/api-error';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '../../shared/pipes/labels.pipe';
import { expectedProgress, projectSchedule, ScheduleTone } from '../../shared/utils/project-health';
import { Ticket } from '../../core/models';

type Period = '30d' | '90d' | '12m';
interface Bucket { start: Date; end: Date; label: string }
interface Kpi {
  key: string; label: string; icon: IconName; value: string; hint: string;
  delta: string | null; trend: 'up' | 'down' | 'flat'; good: boolean | null; spark: number[];
}

const DAY = 864e5;
const HOUR = 36e5;
const PERIOD_DAYS: Record<Period, number> = { '30d': 30, '90d': 90, '12m': 365 };
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOUR_BLOCKS = ['0–4 h', '4–8 h', '8–12 h', '12–16 h', '16–20 h', '20–24 h'];
const HEAT_COLORS = ['#f1f5f9', '#d1e4fa', '#93bdf0', '#3d82d6', '#0f4b92'];
const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
const within = (iso: string | undefined, a: Date, b: Date) => !!iso && new Date(iso) >= a && new Date(iso) < b;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="analytics-page">
      <div class="page-header">
        <div>
          <h1>Analíticas</h1>
          <p>Cómo va el soporte, el equipo y los proyectos · comparado con el periodo anterior</p>
        </div>
        <div class="period" role="group" aria-label="Periodo">
          @for (p of periods; track p.value) {
            <button [class.active]="period() === p.value" (click)="period.set(p.value)">{{ p.label }}</button>
          }
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpis">
        @for (k of kpis(); track k.key) {
          <div class="kpi">
            <div class="kpi-top">
              <span class="kpi-icon" [class]="k.key"><app-icon [name]="k.icon" [size]="16" /></span>
              <span class="kpi-label">{{ k.label }}</span>
            </div>
            <div class="kpi-value">{{ k.value }}</div>
            <div class="kpi-foot">
              @if (k.delta) {
                <span class="delta" [class.good]="k.good === true" [class.bad]="k.good === false">
                  {{ k.trend === 'up' ? '▲' : k.trend === 'down' ? '▼' : '■' }} {{ k.delta }}
                </span>
              }
              <span class="kpi-hint">{{ k.hint }}</span>
            </div>
            <div class="spark" aria-hidden="true">
              @for (v of k.spark; track $index) {
                <span [style.height.%]="sparkHeight(v, k.spark)"></span>
              }
            </div>
          </div>
        }
      </div>

      <div class="grid">
        <!-- Recibidos vs resueltos -->
        <section class="card span-2">
          <div class="card-head">
            <h3>Tickets recibidos vs resueltos</h3>
            <div class="legend"><span><i class="sq navy"></i> Recibidos</span><span><i class="sq green"></i> Resueltos</span></div>
          </div>
          <div class="bars">
            @for (b of flow(); track b.label) {
              <div class="bar-group" [title]="b.label + ': ' + b.received + ' recibidos, ' + b.resolved + ' resueltos'">
                <div class="pair">
                  <div class="bar navy" [style.height.%]="b.receivedPct"><span>{{ b.received || '' }}</span></div>
                  <div class="bar green" [style.height.%]="b.resolvedPct"><span>{{ b.resolved || '' }}</span></div>
                </div>
                <span class="bar-label">{{ b.label }}</span>
              </div>
            }
          </div>
          <p class="insight">
            <app-icon name="trending-up" [size]="14" />
            @if (flowBalance() > 0) { <span>Se resolvieron <strong>{{ flowBalance() }} más</strong> de los que llegaron: la cola está bajando.</span> }
            @else if (flowBalance() < 0) { <span>Llegaron <strong>{{ -flowBalance() }} más</strong> de los que se resolvieron: la cola está creciendo.</span> }
            @else { <span>Se resolvieron tantos tickets como llegaron.</span> }
          </p>
        </section>

        <!-- Estado actual -->
        <section class="card">
          <div class="card-head"><h3>Cola de soporte hoy</h3></div>
          <div class="donut-wrap">
            <div class="donut" [style.background]="backlog().chart">
              <div class="donut-hole"><strong>{{ backlog().total }}</strong><span>abiertos</span></div>
            </div>
            <ul class="donut-legend">
              @for (s of backlog().slices; track s.label) {
                <li><i class="dot" [style.background]="s.color"></i>{{ s.label }}<strong>{{ s.value }}</strong></li>
              }
            </ul>
          </div>
          <div class="alerts">
            <a routerLink="/tickets" class="alert red"><app-icon name="alert-triangle" [size]="14" /> {{ backlog().breached }} con SLA vencido</a>
            <a routerLink="/tickets" class="alert orange"><app-icon name="user" [size]="14" /> {{ backlog().unassigned }} sin asignar</a>
          </div>
        </section>

        <!-- Equipo -->
        <section class="card span-2">
          <div class="card-head"><h3>Carga del equipo</h3><span class="muted">Abiertos ahora · resueltos en el periodo</span></div>
          <table class="team">
            <thead><tr><th>Integrante</th><th class="w-bar">Tickets abiertos</th><th>Resueltos</th><th>Resolución prom.</th><th>Satisfacción</th></tr></thead>
            <tbody>
              @for (m of team(); track m.id) {
                <tr [class.unassigned-row]="m.id === 'none'">
                  <td>
                    <span class="member">
                      <span class="av" [class]="m.role">{{ m.initials }}</span>
                      <span><strong>{{ m.name }}</strong><small>{{ m.roleLabel }}</small></span>
                    </span>
                  </td>
                  <td class="w-bar">
                    <div class="load"><div class="load-fill" [class.warn]="m.id === 'none'" [style.width.%]="m.openPct"></div><span>{{ m.open }}</span></div>
                  </td>
                  <td>{{ m.id === 'none' ? '—' : m.resolved }}</td>
                  <td>{{ m.avgHours !== null ? m.avgHours + ' h' : '—' }}</td>
                  <td>{{ m.csat !== null ? '★ ' + m.csat : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <!-- Empresas -->
        <section class="card">
          <div class="card-head"><h3>Empresas que más soporte piden</h3></div>
          <div class="hbars">
            @for (c of topCompanies(); track c.name) {
              <div class="hbar-row">
                <div class="hbar-top"><span class="hbar-name">{{ c.name }}</span><span class="hbar-val">{{ c.count }}</span></div>
                <div class="hbar-track"><div class="hbar-fill" [style.width.%]="c.pct"></div></div>
                @if (c.breached) { <span class="mini-alert">{{ c.breached }} con SLA vencido</span> }
              </div>
            } @empty {
              <p class="empty">Sin tickets en este periodo.</p>
            }
          </div>
        </section>

        <!-- Mapa de calor -->
        <section class="card span-2">
          <div class="card-head">
            <h3>¿Cuándo llegan los tickets?</h3>
            @if (heatmap().peak) { <span class="peak">Pico: <strong>{{ heatmap().peak }}</strong></span> }
          </div>
          <div class="heat">
            <span></span>
            @for (h of hourBlocks; track h) { <span class="heat-col">{{ h }}</span> }
            @for (row of heatmap().rows; track row.day) {
              <span class="heat-day">{{ row.day }}</span>
              @for (cell of row.cells; track $index) {
                <span class="heat-cell" [style.background]="cell.color" [class.dark]="cell.level >= 3" [title]="row.day + ' ' + hourBlocks[$index] + ': ' + cell.value + ' ticket(s)'">{{ cell.value || '' }}</span>
              }
            }
          </div>
          <div class="heat-scale"><span>Menos</span>@for (c of heatColors; track c) { <i [style.background]="c"></i> }<span>Más</span></div>
        </section>

        <!-- Proyectos -->
        <section class="card">
          <div class="card-head"><h3>Salud de los proyectos</h3></div>
          <div class="health">
            @for (h of projectHealth().counts; track h.tone) {
              <div class="health-box" [class]="h.tone"><strong>{{ h.value }}</strong><span>{{ h.label }}</span></div>
            }
          </div>
          <div class="watch">
            @for (p of projectHealth().watch; track p.id) {
              <a class="watch-row" [routerLink]="['/projects', p.id]">
                <div class="watch-top"><span class="watch-name">{{ p.name }}</span><span class="tone-chip" [class]="p.tone">{{ p.label }}</span></div>
                <div class="watch-bar">
                  <div class="watch-fill" [class]="p.tone" [style.width.%]="p.progress"></div>
                  @if (p.expected !== null) { <span class="watch-mark" [style.left.%]="p.expected" [title]="'Esperado hoy: ' + p.expected + '%'"></span> }
                </div>
                <span class="watch-meta">{{ p.progress }}% · esperado {{ p.expected ?? '—' }}% · {{ p.detail }}</span>
              </a>
            } @empty {
              <p class="empty ok-msg"><app-icon name="check" [size]="15" /> Todos los proyectos activos van a tiempo.</p>
            }
          </div>
        </section>

        <!-- Categorías y prioridades -->
        <section class="card span-3">
          <div class="split">
            <div>
              <div class="card-head"><h3>Por categoría</h3></div>
              <div class="hbars">
                @for (c of byCategory(); track c.label) {
                  <div class="hbar-row inline">
                    <span class="hbar-name">{{ c.label }}</span>
                    <div class="hbar-track"><div class="hbar-fill" [style.width.%]="c.pct"></div></div>
                    <span class="hbar-val">{{ c.value }}</span>
                  </div>
                } @empty { <p class="empty">Sin datos.</p> }
              </div>
            </div>
            <div>
              <div class="card-head"><h3>Por prioridad</h3></div>
              <div class="hbars">
                @for (c of byPriority(); track c.label) {
                  <div class="hbar-row inline">
                    <span class="hbar-name">{{ c.label }}</span>
                    <div class="hbar-track"><div class="hbar-fill" [style.width.%]="c.pct" [style.background]="c.color"></div></div>
                    <span class="hbar-val">{{ c.value }}</span>
                  </div>
                } @empty { <p class="empty">Sin datos.</p> }
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .analytics-page { max-width: var(--page-max-width); margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .period { display: inline-flex; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; }
    .period button { border: none; background: none; padding: 8px 14px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; }
    .period button.active { background: #0f4b92; color: #fff; }
    .muted { font-size: 12px; color: #94a3b8; }
    .empty { font-size: 13px; color: #94a3b8; text-align: center; padding: 16px 0; margin: 0; }

    /* KPIs */
    .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
    .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .kpi-top { display: flex; align-items: center; gap: 8px; }
    .kpi-icon { width: 30px; height: 30px; border-radius: 9px; display: flex; align-items: center; justify-content: center; background: #eef4fc; color: #0f4b92; flex-shrink: 0; }
    .kpi-icon.resolved, .kpi-icon.sla { background: #f2f7e1; color: #6b7d1c; }
    .kpi-icon.time { background: #fdf3e6; color: #c47a14; }
    .kpi-icon.csat { background: #fef9c3; color: #a16207; }
    .kpi-label { font-size: 12.5px; font-weight: 600; color: #64748b; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; line-height: 1.1; }
    .kpi-foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 18px; }
    .delta { font-size: 11.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: #f1f5f9; color: #64748b; }
    .delta.good { background: #f2f7e1; color: #5b6b12; }
    .delta.bad { background: #fee2e2; color: #dc2626; }
    .kpi-hint { font-size: 11.5px; color: #94a3b8; }
    .spark { display: flex; align-items: flex-end; gap: 2px; height: 26px; margin-top: 4px; }
    .spark span { flex: 1; background: #d1e4fa; border-radius: 2px 2px 0 0; min-height: 2px; }
    .spark span:last-child { background: #0f4b92; }

    /* Rejilla */
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .span-2 { grid-column: span 2; }
    .span-3 { grid-column: span 3; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; min-width: 0; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
    .card-head h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }
    .legend { display: flex; gap: 12px; font-size: 12px; color: #64748b; }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .sq { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .sq.navy { background: #0f4b92; }
    .sq.green { background: #a9c238; }

    /* Recibidos vs resueltos */
    .bars { display: flex; align-items: flex-end; gap: 6px; height: 190px; padding-top: 16px; }
    .bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; }
    .pair { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
    .bar { width: 42%; max-width: 18px; border-radius: 4px 4px 0 0; min-height: 2px; position: relative; transition: height 0.4s ease; }
    .bar span { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 700; color: #334155; }
    .bar.navy { background: #0f4b92; }
    .bar.green { background: #a9c238; }
    .bar-label { font-size: 10.5px; color: #94a3b8; margin-top: 6px; white-space: nowrap; }
    .insight { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; background: #f8fafc; border-radius: 10px; padding: 9px 12px; margin: 14px 0 0; }
    .insight app-icon { color: #0f4b92; }

    /* Dona */
    .donut-wrap { display: flex; align-items: center; gap: 18px; }
    .donut { width: 130px; height: 130px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .donut-hole { width: 86px; height: 86px; border-radius: 50%; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .donut-hole strong { font-size: 26px; color: #0f172a; line-height: 1; }
    .donut-hole span { font-size: 11px; color: #64748b; }
    .donut-legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .donut-legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; }
    .donut-legend strong { margin-left: auto; color: #0f172a; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
    .alerts { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
    .alert { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; padding: 9px 12px; border-radius: 10px; text-decoration: none; }
    .alert.red { background: #fee2e2; color: #dc2626; }
    .alert.orange { background: #fdf3e6; color: #c47a14; }

    /* Equipo */
    .team { width: 100%; border-collapse: collapse; font-size: 13px; }
    .team th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #94a3b8; font-weight: 700; padding: 0 8px 8px; }
    .team td { padding: 9px 8px; border-top: 1px solid #f1f5f9; color: #334155; white-space: nowrap; }
    .w-bar { width: 34%; }
    .member { display: flex; align-items: center; gap: 9px; }
    .member strong { display: block; font-size: 13px; color: #0f172a; }
    .member small { display: block; font-size: 11px; color: #94a3b8; }
    .av { width: 30px; height: 30px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e99d34; }
    .av.owner { background: #0f4b92; }
    .av.none { background: #e2e8f0; color: #64748b; }
    .load { display: flex; align-items: center; gap: 8px; }
    .load-fill { height: 10px; border-radius: 999px; background: #0f4b92; min-width: 3px; }
    .load-fill.warn { background: #e99d34; }
    .load span { font-weight: 700; color: #0f172a; }
    .unassigned-row td { background: #fffaf3; }

    /* Barras horizontales */
    .hbars { display: flex; flex-direction: column; gap: 12px; }
    .hbar-top { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
    .hbar-name { color: #334155; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hbar-val { font-weight: 800; color: #0f172a; }
    .hbar-track { height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; flex: 1; }
    .hbar-fill { height: 100%; background: #0f4b92; border-radius: 999px; transition: width 0.4s ease; }
    .mini-alert { font-size: 11px; color: #dc2626; font-weight: 600; margin-top: 3px; display: inline-block; }
    .hbar-row.inline { display: flex; align-items: center; gap: 10px; }
    .hbar-row.inline .hbar-name { width: 110px; flex-shrink: 0; font-size: 12.5px; }
    .hbar-row.inline .hbar-val { width: 24px; text-align: right; font-size: 12.5px; }
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }

    /* Mapa de calor */
    .peak { font-size: 12.5px; color: #64748b; }
    .peak strong { color: #0f4b92; }
    .heat { display: grid; grid-template-columns: 40px repeat(6, 1fr); gap: 4px; }
    .heat-col { font-size: 10.5px; color: #94a3b8; text-align: center; padding-bottom: 2px; }
    .heat-day { font-size: 12px; color: #64748b; font-weight: 600; display: flex; align-items: center; }
    .heat-cell { height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #0f4b92; }
    .heat-cell.dark { color: #fff; }
    .heat-scale { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 10px; font-size: 11px; color: #94a3b8; }
    .heat-scale i { width: 16px; height: 10px; border-radius: 3px; display: inline-block; }

    /* Proyectos */
    .health { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 14px; }
    .health-box { border-radius: 10px; padding: 8px 4px; text-align: center; display: flex; flex-direction: column; }
    .health-box strong { font-size: 20px; line-height: 1.1; }
    .health-box span { font-size: 10.5px; font-weight: 600; }
    .health-box.ok { background: #f2f7e1; color: #5b6b12; }
    .health-box.risk { background: #fdf3e6; color: #b06a0c; }
    .health-box.late { background: #fee2e2; color: #dc2626; }
    .health-box.done { background: #eef4fc; color: #0f4b92; }
    .watch { display: flex; flex-direction: column; gap: 10px; }
    .watch-row { text-decoration: none; color: inherit; padding: 8px; border-radius: 10px; margin: 0 -8px; }
    .watch-row:hover { background: #f8fafc; }
    .watch-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .watch-name { font-size: 13px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tone-chip { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; flex-shrink: 0; }
    .tone-chip.risk { background: #fdf3e6; color: #b06a0c; }
    .tone-chip.late { background: #fee2e2; color: #dc2626; }
    .tone-chip.paused { background: #f1f5f9; color: #64748b; }
    .watch-bar { position: relative; height: 8px; background: #f1f5f9; border-radius: 999px; margin: 6px 0 4px; }
    .watch-fill { height: 100%; border-radius: 999px; background: #0f4b92; }
    .watch-fill.risk { background: #e99d34; }
    .watch-fill.late { background: #ef4444; }
    .watch-fill.paused { background: #94a3b8; }
    .watch-mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #0f172a; border-radius: 2px; }
    .watch-meta { font-size: 11.5px; color: #64748b; }
    .ok-msg { display: flex; align-items: center; justify-content: center; gap: 6px; color: #5b6b12; }

    @media (max-width: 1100px) {
      .kpis { grid-template-columns: repeat(3, 1fr); }
      .grid { grid-template-columns: 1fr 1fr; }
      .span-2, .span-3 { grid-column: span 2; }
    }
    @media (max-width: 720px) {
      .kpis { grid-template-columns: 1fr 1fr; }
      .grid { grid-template-columns: 1fr; }
      .span-2, .span-3 { grid-column: span 1; }
      .split { grid-template-columns: 1fr; gap: 20px; }
      .team th:nth-child(4), .team td:nth-child(4), .team th:nth-child(5), .team td:nth-child(5) { display: none; }
    }
  `]
})
export class AnalyticsComponent {
  private ticketService = inject(TicketService);
  private projectService = inject(ProjectService);
  private companyService = inject(CompanyService);
  private userService = inject(UserService);
  private notify = inject(NotificationService);

  readonly periods: { value: Period; label: string }[] = [
    { value: '30d', label: '30 días' },
    { value: '90d', label: '90 días' },
    { value: '12m', label: '12 meses' },
  ];
  readonly hourBlocks = HOUR_BLOCKS;
  readonly heatColors = HEAT_COLORS;
  period = signal<Period>('90d');

  constructor() {
    loadPageData(this.notify, this.ticketService.load(), this.projectService.load(), this.companyService.load(), this.userService.loadStaff());
  }

  // ── Rango y cubetas ──

  private range = computed(() => {
    const end = new Date();
    const days = PERIOD_DAYS[this.period()];
    const start = new Date(end.getTime() - days * DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    return { start, end, prevStart };
  });

  /** Semanas (30/90 días) o meses (12 meses) del periodo, para gráficos y mini tendencias. */
  private buckets = computed<Bucket[]>(() => {
    const { start, end } = this.range();
    const out: Bucket[] = [];
    if (this.period() === '12m') {
      for (let i = 11; i >= 0; i--) {
        const s = new Date(end.getFullYear(), end.getMonth() - i, 1);
        const e = new Date(end.getFullYear(), end.getMonth() - i + 1, 1);
        out.push({ start: s, end: e, label: MONTHS[s.getMonth()] });
      }
      return out;
    }
    const monday = new Date(start);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let s = monday; s < end; s = new Date(s.getTime() + 7 * DAY)) {
      out.push({ start: s, end: new Date(s.getTime() + 7 * DAY), label: `${s.getDate()}/${s.getMonth() + 1}` });
    }
    return out;
  });

  private tickets = computed(() => this.ticketService.getAll());

  // ── Métricas por intervalo ──

  private metrics(a: Date, b: Date) {
    const all = this.tickets();
    const received = all.filter(t => within(t.createdAt, a, b));
    const resolved = all.filter(t => within(t.resolvedAt, a, b));
    const rated = all.filter(t => typeof t.satisfactionRating === 'number' && within(t.ratedAt, a, b));
    const hours = avg(resolved.map(t => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / HOUR));
    // SLA = primera respuesta: se mide sobre los tickets respondidos en el intervalo.
    const answered = all.filter(t => within(t.firstResponseAt, a, b));
    const onTime = answered.filter(t => new Date(t.firstResponseAt!) <= new Date(t.slaDeadline)).length;
    return {
      received: received.length,
      resolved: resolved.length,
      hours: hours === null ? null : round1(hours),
      sla: answered.length ? Math.round((onTime / answered.length) * 100) : null,
      csat: rated.length ? round1(avg(rated.map(t => t.satisfactionRating!))!) : null,
    };
  }

  kpis = computed<Kpi[]>(() => {
    const { start, end, prevStart } = this.range();
    const cur = this.metrics(start, end);
    const prev = this.metrics(prevStart, start);
    const series = this.buckets().map(bk => this.metrics(bk.start, bk.end));

    /** Cambio contra el periodo anterior; higherIsBetter define si subir es bueno. */
    const change = (c: number | null, p: number | null, higherIsBetter: boolean, unit: 'pct' | 'pts' | 'abs') => {
      if (c === null || p === null) return { delta: null, trend: 'flat' as const, good: null };
      const diff = c - p;
      const trend = diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'flat' as const;
      const good = diff === 0 ? null : (diff > 0) === higherIsBetter;
      if (unit === 'pct') {
        if (p === 0) return { delta: c ? 'nuevo' : null, trend, good: c ? good : null };
        return { delta: `${Math.abs(Math.round((diff / p) * 100))}%`, trend, good };
      }
      return { delta: `${Math.abs(round1(diff))}${unit === 'pts' ? ' pts' : ''}`, trend, good };
    };

    return [
      { key: 'received', label: 'Tickets recibidos', icon: 'inbox', value: String(cur.received), hint: 'vs periodo anterior',
        ...change(cur.received, prev.received, false, 'pct'), spark: series.map(s => s.received) },
      { key: 'resolved', label: 'Tickets resueltos', icon: 'check', value: String(cur.resolved), hint: 'vs periodo anterior',
        ...change(cur.resolved, prev.resolved, true, 'pct'), spark: series.map(s => s.resolved) },
      { key: 'time', label: 'Resolución promedio', icon: 'clock', value: cur.hours !== null ? `${cur.hours} h` : '—', hint: 'menos es mejor',
        ...change(cur.hours, prev.hours, false, 'abs'), spark: series.map(s => s.hours ?? 0) },
      { key: 'sla', label: 'SLA cumplido', icon: 'alert-triangle', value: cur.sla !== null ? `${cur.sla}%` : '—', hint: 'respondidos a tiempo',
        ...change(cur.sla, prev.sla, true, 'pts'), spark: series.map(s => s.sla ?? 0) },
      { key: 'csat', label: 'Satisfacción', icon: 'star', value: cur.csat !== null ? `${cur.csat}/5` : '—', hint: 'calificación de clientes',
        ...change(cur.csat, prev.csat, true, 'abs'), spark: series.map(s => s.csat ?? 0) },
    ];
  });

  sparkHeight(v: number, all: number[]): number {
    const max = Math.max(...all, 0);
    return max ? Math.max(6, (v / max) * 100) : 6;
  }

  // ── Recibidos vs resueltos ──

  flow = computed(() => {
    const rows = this.buckets().map(bk => {
      const m = this.metrics(bk.start, bk.end);
      return { label: bk.label, received: m.received, resolved: m.resolved };
    });
    const max = Math.max(1, ...rows.flatMap(r => [r.received, r.resolved]));
    return rows.map(r => ({ ...r, receivedPct: (r.received / max) * 100, resolvedPct: (r.resolved / max) * 100 }));
  });

  flowBalance = computed(() => this.flow().reduce((s, r) => s + r.resolved - r.received, 0));

  // ── Cola actual ──

  backlog = computed(() => {
    const open = this.tickets().filter(t => !isClosed(t));
    const slices = [
      { label: 'Abiertos', value: open.filter(t => t.status === 'open').length, color: '#e99d34' },
      { label: 'En revisión', value: open.filter(t => t.status === 'in_review').length, color: '#0f4b92' },
      { label: 'Escalados', value: open.filter(t => t.status === 'escalated').length, color: '#ef4444' },
    ];
    let acc = 0;
    const total = open.length;
    // Segmentos de color sólido (no degradado): cada tramo empieza donde termina el anterior.
    const segs = slices.filter(s => s.value).map(s => {
      const from = (acc / total) * 100;
      acc += s.value;
      return `${s.color} ${from}% ${(acc / total) * 100}%`;
    });
    return {
      total, slices,
      chart: total ? `conic-gradient(${segs.join(', ')})` : 'conic-gradient(#e2e8f0 0 100%)',
      breached: open.filter(t => this.ticketService.isSlaBreached(t)).length,
      unassigned: open.filter(t => !t.assignedTo).length,
    };
  });

  // ── Equipo ──

  team = computed(() => {
    const { start, end } = this.range();
    const all = this.tickets();
    const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const rows = this.userService.staff().map(m => {
      const mine = all.filter(t => t.assignedTo?.id === m.id);
      const resolved = mine.filter(t => within(t.resolvedAt, start, end));
      const rated = mine.filter(t => typeof t.satisfactionRating === 'number');
      const hours = avg(resolved.map(t => (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / HOUR));
      return {
        id: m.id, name: m.name, role: m.role as string, initials: initials(m.name),
        roleLabel: m.role === 'owner' ? 'Administrador' : 'Técnico',
        open: mine.filter(t => !isClosed(t)).length,
        resolved: resolved.length,
        avgHours: hours === null ? null : round1(hours),
        csat: rated.length ? round1(avg(rated.map(t => t.satisfactionRating!))!) : null,
      };
    }).sort((a, b) => b.open - a.open);
    const unassigned = all.filter(t => !isClosed(t) && !t.assignedTo).length;
    const withNone = [...rows, {
      id: 'none', name: 'Sin asignar', role: 'none', initials: '?', roleLabel: 'Esperando responsable',
      open: unassigned, resolved: 0, avgHours: null, csat: null,
    }];
    const max = Math.max(1, ...withNone.map(r => r.open));
    return withNone.map(r => ({ ...r, openPct: (r.open / max) * 100 }));
  });

  // ── Empresas ──

  topCompanies = computed(() => {
    const { start, end } = this.range();
    const groups = new Map<string, Ticket[]>();
    for (const t of this.tickets().filter(x => within(x.createdAt, start, end))) {
      groups.set(t.companyId, [...(groups.get(t.companyId) ?? []), t]);
    }
    const rows = [...groups.entries()].map(([id, ts]) => ({
      name: this.companyService.getById(id)?.name ?? ts[0].companyName,
      count: ts.length,
      breached: ts.filter(t => this.ticketService.isSlaBreached(t)).length,
    })).sort((a, b) => b.count - a.count).slice(0, 6);
    const max = Math.max(1, ...rows.map(r => r.count));
    return rows.map(r => ({ ...r, pct: (r.count / max) * 100 }));
  });

  // ── Mapa de calor ──

  heatmap = computed(() => {
    const { start, end } = this.range();
    const grid = WEEKDAYS.map(() => HOUR_BLOCKS.map(() => 0));
    for (const t of this.tickets().filter(x => within(x.createdAt, start, end))) {
      const d = new Date(t.createdAt);
      grid[(d.getDay() + 6) % 7][Math.floor(d.getHours() / 4)]++;
    }
    const max = Math.max(...grid.flat());
    let peak = '';
    if (max > 0) {
      const di = grid.findIndex(r => r.includes(max));
      peak = `${WEEKDAYS[di]} ${HOUR_BLOCKS[grid[di].indexOf(max)]}`;
    }
    const rows = WEEKDAYS.map((day, i) => ({
      day,
      cells: grid[i].map(value => {
        const level = value === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((value / max) * 4));
        return { value, level, color: HEAT_COLORS[level] };
      }),
    }));
    return { rows, peak };
  });

  // ── Proyectos ──

  projectHealth = computed(() => {
    const projects = this.projectService.getAll().map(p => {
      const s = projectSchedule(p);
      return { id: p.id, name: p.name, progress: p.progress, expected: expectedProgress(p), tone: s.tone, label: s.label, detail: s.detail };
    });
    const count = (tones: ScheduleTone[]) => projects.filter(p => tones.includes(p.tone)).length;
    const order: Partial<Record<ScheduleTone, number>> = { late: 0, risk: 1, paused: 2 };
    return {
      counts: [
        { tone: 'ok', label: 'A tiempo', value: count(['ok', 'upcoming']) },
        { tone: 'risk', label: 'En riesgo', value: count(['risk']) },
        { tone: 'late', label: 'Atrasados', value: count(['late']) },
        { tone: 'done', label: 'Completados', value: count(['done']) },
      ],
      watch: projects.filter(p => p.tone in order).sort((a, b) => order[a.tone]! - order[b.tone]!).slice(0, 4),
    };
  });

  // ── Categorías y prioridades ──

  private distribution(key: 'category' | 'priority') {
    const { start, end } = this.range();
    const counts: Record<string, number> = {};
    for (const t of this.tickets().filter(x => within(x.createdAt, start, end))) counts[t[key]] = (counts[t[key]] ?? 0) + 1;
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts).map(([k, value]) => ({ key: k, value, pct: (value / max) * 100 }));
  }

  byCategory = computed(() => this.distribution('category')
    .map(c => ({ ...c, label: CATEGORY_LABELS[c.key] ?? c.key }))
    .sort((a, b) => b.value - a.value));

  byPriority = computed(() => {
    const colors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#e99d34', low: '#a9c238' };
    const order = ['critical', 'high', 'medium', 'low'];
    return this.distribution('priority')
      .map(c => ({ ...c, label: PRIORITY_LABELS[c.key] ?? c.key, color: colors[c.key] ?? '#0f4b92' }))
      .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  });
}
