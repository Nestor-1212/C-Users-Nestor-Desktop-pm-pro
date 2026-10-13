import { Component, DestroyRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { TicketService } from '../../core/services/ticket.service';
import { UserService } from '../../core/services/user.service';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { NotificationService } from '../../shared/services/notification.service';
import { TourService } from '../../shared/services/tour.service';
import { dashboardTour } from '../../shared/services/client-tours';
import { loadPageData } from '../../core/http/api-error';
import { Project, Ticket } from '../../core/models';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { TicketStatusLabelPipe } from '../../shared/pipes/labels.pipe';
import { expectedProgress, localDate, projectSchedule, ScheduleTone } from '../../shared/utils/project-health';
import { companyHealth } from '../../shared/utils/company-health';

type Severity = 'critical' | 'warning' | 'info';
interface AttentionItem { severity: Severity; icon: IconName; title: string; context: string; link: (string | undefined)[]; action: string }

const DAY = 864e5;
const HOUR = 36e5;
const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
const daysUntil = (iso: string) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((localDate(iso).getTime() - t.getTime()) / DAY);
};
/** "3 h", "2 d": cuánto tiempo pasó o falta. */
function span(ms: number): string {
  const h = Math.abs(ms) / HOUR;
  if (h < 1) return `${Math.max(1, Math.round(Math.abs(ms) / 60000))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} d`;
}
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, TicketStatusLabelPipe],
  template: `
    <div class="dashboard">
      @if (auth.isOwner()) {
        <!-- Encabezado: resumen del día -->
        <section class="hero">
          <div class="hero-text">
            <span class="hero-date">{{ today }}</span>
            <h1>{{ greeting() }}{{ firstName() ? ', ' + firstName() : '' }}</h1>
            <p>{{ summary() }}</p>
          </div>
          <div class="hero-stats">
            <a routerLink="/tickets" class="hero-stat">
              <strong>{{ pulse().attention }}</strong><span>Tickets por atender</span>
            </a>
            <a routerLink="/tickets" class="hero-stat" [class.alarm]="pulse().breached > 0">
              <strong>{{ pulse().breached }}</strong><span>Con SLA vencido</span>
            </a>
            <a routerLink="/projects" class="hero-stat" [class.alarm]="pulse().projectsAtRisk > 0">
              <strong>{{ pulse().projectsAtRisk }}</strong><span>Proyectos en riesgo</span>
            </a>
            <a routerLink="/projects" class="hero-stat">
              <strong>{{ pulse().deliveries }}</strong><span>Entregas en 30 días</span>
            </a>
          </div>
        </section>

        <div class="grid">
          <!-- Requiere tu atención -->
          <section class="card span-2">
            <div class="card-head">
              <h3><app-icon name="alert-triangle" [size]="17" /> Requiere tu atención</h3>
              <span class="count-pill">{{ attention().length }}</span>
            </div>
            <div class="attention">
              @for (a of attention(); track $index) {
                <a class="att-row" [class]="a.severity" [routerLink]="a.link">
                  <span class="att-icon"><app-icon [name]="a.icon" [size]="16" /></span>
                  <span class="att-body"><strong>{{ a.title }}</strong><small>{{ a.context }}</small></span>
                  <span class="att-action">{{ a.action }} <app-icon name="chevron-right" [size]="14" /></span>
                </a>
              } @empty {
                <div class="all-good"><app-icon name="check" [size]="22" /><div><strong>Todo bajo control</strong><span>No hay tickets vencidos ni proyectos en riesgo.</span></div></div>
              }
            </div>
          </section>

          <!-- Equipo hoy -->
          <section class="card">
            <div class="card-head">
              <h3><app-icon name="users" [size]="17" /> Equipo hoy</h3>
              <a routerLink="/analytics" class="see-all">Analíticas <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="team">
              @for (m of team(); track m.id) {
                <div class="member">
                  <span class="av" [class]="m.role">{{ m.initials }}</span>
                  <div class="member-info">
                    <strong>{{ m.name }}</strong>
                    <span>{{ m.open }} abierto{{ m.open === 1 ? '' : 's' }}@if (m.breached) { · <b class="red">{{ m.breached }} vencido{{ m.breached === 1 ? '' : 's' }}</b> }</span>
                  </div>
                  <div class="member-bar"><div [style.width.%]="m.pct" [class.busy]="m.pct >= 75"></div></div>
                </div>
              }
              @if (pulse().unassigned) {
                <a routerLink="/tickets" class="unassigned-note"><app-icon name="user" [size]="14" /> {{ pulse().unassigned }} ticket{{ pulse().unassigned === 1 ? '' : 's' }} sin responsable</a>
              }
            </div>
          </section>

          <!-- Próximas entregas -->
          <section class="card span-2">
            <div class="card-head">
              <h3><app-icon name="calendar" [size]="17" /> Próximas entregas</h3>
              <a routerLink="/projects" class="see-all">Proyectos <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="deliveries">
              @for (d of deliveries(); track d.id) {
                <a class="delivery" [routerLink]="['/projects', d.id]">
                  <div class="due" [class]="d.tone">
                    <strong>{{ d.daysLeft < 0 ? -d.daysLeft : d.daysLeft }}</strong>
                    <span>{{ d.daysLeft < 0 ? 'días tarde' : d.daysLeft === 1 ? 'día' : 'días' }}</span>
                  </div>
                  <div class="delivery-body">
                    <div class="delivery-top">
                      <span class="delivery-name">{{ d.name }}</span>
                      <span class="tone-chip" [class]="d.tone">{{ d.label }}</span>
                    </div>
                    <span class="delivery-company">{{ d.company }} · entrega {{ d.endDate | date:'d MMM' }}</span>
                    <div class="pbar">
                      <div class="pfill" [class]="d.tone" [style.width.%]="d.progress"></div>
                      @if (d.expected !== null) { <span class="pmark" [style.left.%]="d.expected" [title]="'Esperado hoy: ' + d.expected + '%'"></span> }
                    </div>
                  </div>
                  <span class="delivery-pct">{{ d.progress }}%</span>
                </a>
              } @empty {
                <p class="empty">No hay entregas pendientes en los próximos 30 días.</p>
              }
            </div>
          </section>

          <!-- Salud de clientes -->
          <section class="card">
            <div class="card-head">
              <h3><app-icon name="building" [size]="17" /> Salud de clientes</h3>
              <a routerLink="/companies" class="see-all">Empresas <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="clients">
              @for (c of clientHealth(); track c.id) {
                <div class="client" [title]="c.reasons || 'Sin alertas'">
                  <span class="logo">
                    @if (c.logo) { <img [src]="c.logo" alt=""> } @else { {{ c.name[0] }} }
                  </span>
                  <div class="client-info">
                    <strong>{{ c.name }}</strong>
                    <span>{{ c.reasons || 'Sin alertas' }}</span>
                  </div>
                  <span class="health-dot" [class]="c.level" [attr.aria-label]="c.levelLabel">{{ c.score }}</span>
                </div>
              }
            </div>
            <p class="legend-note"><span class="health-dot good sm"></span> 80+ sano · <span class="health-dot watch sm"></span> 50–79 vigilar · <span class="health-dot danger sm"></span> &lt;50 en riesgo</p>
          </section>

          <!-- Actividad -->
          <section class="card span-3">
            <div class="card-head">
              <h3><app-icon name="clock" [size]="17" /> Actividad reciente</h3>
              <a routerLink="/activity" class="see-all">Bitácora <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="feed">
              @for (e of recentActivity(); track e.id) {
                <div class="feed-row">
                  <span class="av sm owner">{{ initialsOf(e.actorName) }}</span>
                  <p><strong>{{ e.actorName }}</strong> {{ e.description }}</p>
                  <span class="feed-date">hace {{ ago(e.createdAt) }}</span>
                </div>
              } @empty {
                <p class="empty">Sin actividad reciente.</p>
              }
            </div>
          </section>
        </div>
      }

      <!-- ───────── Vista del cliente ───────── -->
      @if (auth.isClient()) {
        <section class="hero client-hero">
          <div class="hero-text with-logo">
            @if (myCompany()?.logo) { <img class="client-logo" [src]="myCompany()!.logo!" alt="Logo de tu empresa"> }
            <div>
              <span class="hero-date">{{ today }}</span>
              <h1>{{ greeting() }}{{ firstName() ? ', ' + firstName() : '' }}</h1>
              <p>{{ clientSummary() }}</p>
            </div>
          </div>
          <div class="hero-actions">
            <a routerLink="/tickets" class="hero-btn"><app-icon name="plus" [size]="16" /> Reportar un problema</a>
            <span class="plan-chip">Respuesta garantizada en {{ mySlaHours() }} h</span>
          </div>
        </section>

        @if (clientTickets().answered.length) {
          <a routerLink="/tickets" class="answered-banner">
            <app-icon name="message-circle" [size]="18" />
            <span><strong>Te respondimos en {{ clientTickets().answered.length }} ticket{{ clientTickets().answered.length === 1 ? '' : 's' }}.</strong> Revisa la respuesta y confírmanos si quedó resuelto.</span>
            <app-icon name="chevron-right" [size]="16" />
          </a>
        }

        <h2 class="section-title">Tus proyectos</h2>
        <div class="project-cards">
          @for (p of clientProjects(); track p.id) {
            <a class="project-card" [routerLink]="['/projects', p.id]">
              <div class="pc-top">
                <span class="tone-chip" [class]="p.tone">{{ p.label }}</span>
                <span class="pc-pct">{{ p.progress }}%</span>
              </div>
              <h3>{{ p.name }}</h3>
              <div class="pbar big">
                <div class="pfill" [class]="p.tone" [style.width.%]="p.progress"></div>
              </div>
              <div class="pc-meta">
                <span><app-icon name="calendar" [size]="13" /> Entrega {{ p.endDate | date:'d MMM y' }}</span>
                <span>{{ p.detail }}</span>
              </div>
              <span class="pc-link">Ver seguimiento y cronograma <app-icon name="chevron-right" [size]="14" /></span>
            </a>
          } @empty {
            <div class="card empty-card"><app-icon name="folder" [size]="26" /><p>Todavía no tienes proyectos con 3TECH.</p></div>
          }
        </div>

        <h2 class="section-title">Tu soporte</h2>
        <div class="support-grid">
          <div class="support-stat"><strong>{{ clientTickets().waiting.length }}</strong><span>En manos de 3TECH</span></div>
          <div class="support-stat orange"><strong>{{ clientTickets().answered.length }}</strong><span>Esperan tu respuesta</span></div>
          <div class="support-stat green"><strong>{{ clientTickets().resolvedMonth }}</strong><span>Resueltos este mes</span></div>
          <div class="support-stat"><strong>{{ clientTickets().csat ?? '—' }}</strong><span>Tu calificación promedio</span></div>
        </div>
        <section class="card">
          <div class="card-head">
            <h3>Tickets abiertos</h3>
            <a routerLink="/tickets" class="see-all">Ver todos <app-icon name="chevron-right" [size]="14" /></a>
          </div>
          @for (t of clientTickets().open; track t.id) {
            <a class="ticket-row" [routerLink]="['/tickets', t.id]">
              <span class="prio" [class]="t.priority"></span>
              <span class="ticket-main"><strong>{{ t.title }}</strong><small>#{{ t.id }} · hace {{ ago(t.createdAt) }}{{ t.assignedTo ? ' · lo atiende ' + t.assignedTo.name : '' }}</small></span>
              <span class="status-badge" [class]="t.status">{{ t.status | ticketStatusLabel }}</span>
            </a>
          } @empty {
            <p class="empty">No tienes tickets abiertos. ¡Todo funciona bien!</p>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .dashboard { max-width: var(--page-max-width); margin: 0 auto; }
    .empty { font-size: 13px; color: #94a3b8; text-align: center; padding: 18px 0; margin: 0; }

    /* Encabezado */
    .hero { background: #0f4b92; color: #fff; border-radius: 20px; padding: 26px 28px; display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px; }
    .hero-text { max-width: 520px; }
    .hero-text.with-logo { display: flex; align-items: center; gap: 16px; }
    .hero-date { font-size: 12.5px; font-weight: 600; text-transform: capitalize; color: #c9dcf4; }
    .hero h1 { font-size: 26px; font-weight: 800; margin: 4px 0 6px; letter-spacing: -0.4px; color: #fff; }
    .hero p { margin: 0; font-size: 14.5px; line-height: 1.5; color: #e2ecf9; }
    .hero-stats { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); gap: 10px; }
    .hero-stat { background: #1a5aa6; border-radius: 14px; padding: 12px 14px; text-decoration: none; color: #fff; display: flex; flex-direction: column; gap: 2px; transition: background 0.15s; }
    .hero-stat:hover { background: #2266b5; }
    .hero-stat strong { font-size: 26px; font-weight: 800; line-height: 1.1; }
    .hero-stat span { font-size: 12px; color: #d4e3f6; }
    .hero-stat.alarm { background: #e99d34; }
    .hero-stat.alarm span { color: #fff; }
    .hero-stat.alarm:hover { background: #d48a22; }

    /* Rejilla */
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .span-2 { grid-column: span 2; }
    .span-3 { grid-column: span 3; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 20px; min-width: 0; }
    .card-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 14px; }
    .card-head h3 { display: flex; align-items: center; gap: 8px; font-size: 15.5px; font-weight: 700; color: #0f172a; margin: 0; }
    .card-head h3 app-icon { color: #0f4b92; }
    .see-all { display: inline-flex; align-items: center; gap: 2px; font-size: 12.5px; color: #0f4b92; text-decoration: none; font-weight: 600; }
    .count-pill { background: #fee2e2; color: #dc2626; font-weight: 800; font-size: 12px; padding: 2px 10px; border-radius: 999px; }

    /* Atención */
    .attention { display: flex; flex-direction: column; gap: 8px; }
    .att-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; text-decoration: none; color: inherit; border: 1px solid #eef2f7; border-left: 4px solid #94a3b8; transition: background 0.15s; }
    .att-row:hover { background: #f8fafc; }
    .att-row.critical { border-left-color: #ef4444; }
    .att-row.warning { border-left-color: #e99d34; }
    .att-row.info { border-left-color: #0f4b92; }
    .att-icon { width: 32px; height: 32px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #eef4fc; color: #0f4b92; }
    .critical .att-icon { background: #fee2e2; color: #dc2626; }
    .warning .att-icon { background: #fdf3e6; color: #c47a14; }
    .att-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .att-body strong { font-size: 13.5px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .att-body small { font-size: 12px; color: #64748b; }
    .att-action { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 700; color: #0f4b92; flex-shrink: 0; }
    .all-good { display: flex; align-items: center; gap: 12px; background: #f2f7e1; color: #5b6b12; border-radius: 12px; padding: 16px; }
    .all-good div { display: flex; flex-direction: column; }
    .all-good span { font-size: 13px; }

    /* Equipo */
    .team { display: flex; flex-direction: column; gap: 12px; }
    .member { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 10px; row-gap: 5px; align-items: center; }
    .member .av { grid-row: span 2; }
    .member-info { display: flex; flex-direction: column; min-width: 0; }
    .member-info strong { font-size: 13.5px; color: #0f172a; }
    .member-info span { font-size: 12px; color: #64748b; }
    .red { color: #dc2626; }
    .member-bar { height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .member-bar div { height: 100%; background: #0f4b92; border-radius: 999px; }
    .member-bar div.busy { background: #e99d34; }
    .av { width: 34px; height: 34px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e99d34; }
    .av.owner { background: #0f4b92; }
    .av.sm { width: 28px; height: 28px; font-size: 10.5px; }
    .unassigned-note { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 12.5px; font-weight: 700; color: #c47a14; background: #fdf3e6; border-radius: 10px; padding: 8px 10px; text-decoration: none; }

    /* Entregas */
    .deliveries { display: flex; flex-direction: column; gap: 8px; }
    .delivery { display: flex; align-items: center; gap: 14px; padding: 10px; border-radius: 12px; text-decoration: none; color: inherit; transition: background 0.15s; }
    .delivery:hover { background: #f8fafc; }
    .due { width: 58px; height: 52px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; background: #eef4fc; color: #0f4b92; }
    .due strong { font-size: 19px; line-height: 1; }
    .due span { font-size: 10px; font-weight: 600; }
    .due.risk { background: #fdf3e6; color: #b06a0c; }
    .due.late { background: #fee2e2; color: #dc2626; }
    .delivery-body { flex: 1; min-width: 0; }
    .delivery-top { display: flex; align-items: center; gap: 8px; }
    .delivery-name { font-size: 14px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .delivery-company { font-size: 12px; color: #64748b; }
    .delivery-pct { font-size: 15px; font-weight: 800; color: #0f172a; width: 44px; text-align: right; }
    .tone-chip { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; flex-shrink: 0; background: #f2f7e1; color: #5b6b12; }
    .tone-chip.risk { background: #fdf3e6; color: #b06a0c; }
    .tone-chip.late { background: #fee2e2; color: #dc2626; }
    .tone-chip.done { background: #eef4fc; color: #0f4b92; }
    .tone-chip.paused, .tone-chip.upcoming { background: #f1f5f9; color: #64748b; }
    .pbar { position: relative; height: 7px; background: #f1f5f9; border-radius: 999px; margin-top: 7px; }
    .pbar.big { height: 10px; margin: 10px 0; }
    .pfill { height: 100%; border-radius: 999px; background: #a9c238; }
    .pfill.risk { background: #e99d34; }
    .pfill.late { background: #ef4444; }
    .pfill.done { background: #0f4b92; }
    .pfill.paused, .pfill.upcoming { background: #94a3b8; }
    .pmark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #0f172a; border-radius: 2px; }

    /* Salud de clientes */
    .clients { display: flex; flex-direction: column; gap: 10px; }
    .client { display: flex; align-items: center; gap: 10px; }
    .logo { width: 34px; height: 34px; border-radius: 9px; background: #0f4b92; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
    .client-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .client-info strong { font-size: 13.5px; color: #0f172a; }
    .client-info span { font-size: 11.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .health-dot { min-width: 34px; height: 24px; border-radius: 999px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; color: #fff; padding: 0 6px; }
    .health-dot.good { background: #a9c238; }
    .health-dot.watch { background: #e99d34; }
    .health-dot.danger { background: #ef4444; }
    .health-dot.sm { min-width: 10px; width: 10px; height: 10px; padding: 0; vertical-align: middle; }
    .legend-note { font-size: 11px; color: #94a3b8; margin: 12px 0 0; }

    /* Actividad */
    .feed { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 24px; }
    .feed-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f8fafc; min-width: 0; }
    .feed-row p { flex: 1; min-width: 0; margin: 0; font-size: 13px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .feed-row strong { color: #0f172a; }
    .feed-date { font-size: 11.5px; color: #94a3b8; white-space: nowrap; }

    /* Cliente */
    .client-logo { width: 56px; height: 56px; border-radius: 14px; object-fit: contain; background: #fff; padding: 6px; box-sizing: border-box; flex-shrink: 0; }
    .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .hero-btn { display: inline-flex; align-items: center; gap: 7px; background: #e99d34; color: #fff; padding: 11px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; }
    .hero-btn:hover { background: #d48a22; }
    .plan-chip { font-size: 12.5px; color: #d4e3f6; }
    .answered-banner { display: flex; align-items: center; gap: 12px; background: #fdf3e6; border: 1px solid #f5d3a3; color: #8a520a; border-radius: 14px; padding: 13px 16px; text-decoration: none; margin-bottom: 18px; font-size: 14px; }
    .answered-banner span { flex: 1; }
    .section-title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 6px 0 12px; }
    .project-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 22px; }
    .project-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; text-decoration: none; color: inherit; display: flex; flex-direction: column; transition: border-color 0.15s, box-shadow 0.15s; }
    .project-card:hover { border-color: #c7d7ee; box-shadow: 0 8px 22px rgba(15,75,146,0.08); }
    .pc-top { display: flex; justify-content: space-between; align-items: center; }
    .pc-pct { font-size: 22px; font-weight: 800; color: #0f172a; }
    .project-card h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 8px 0 0; }
    .pc-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: #64748b; flex-wrap: wrap; }
    .pc-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .pc-link { margin-top: 12px; font-size: 12.5px; font-weight: 700; color: #0f4b92; display: inline-flex; align-items: center; gap: 2px; }
    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #94a3b8; }
    .empty-card p { margin: 0; font-size: 13px; }
    .support-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
    .support-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; border-top: 4px solid #0f4b92; }
    .support-stat.orange { border-top-color: #e99d34; }
    .support-stat.green { border-top-color: #a9c238; }
    .support-stat strong { font-size: 24px; font-weight: 800; color: #0f172a; }
    .support-stat span { font-size: 12.5px; color: #64748b; }
    .ticket-row { display: flex; align-items: center; gap: 12px; padding: 10px 6px; border-bottom: 1px solid #f1f5f9; text-decoration: none; color: inherit; }
    .ticket-row:last-child { border-bottom: none; }
    .ticket-row:hover { background: #f8fafc; }
    .prio { width: 4px; align-self: stretch; border-radius: 4px; background: #94a3b8; }
    .prio.critical { background: #ef4444; }
    .prio.high { background: #f97316; }
    .prio.medium { background: #e99d34; }
    .prio.low { background: #a9c238; }
    .ticket-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ticket-main strong { font-size: 14px; color: #0f172a; }
    .ticket-main small { font-size: 12px; color: #64748b; }

    @media (max-width: 1100px) {
      .grid { grid-template-columns: 1fr 1fr; }
      .span-2, .span-3 { grid-column: span 2; }
      .hero-stats { grid-template-columns: repeat(2, 1fr); width: 100%; }
    }
    @media (max-width: 720px) {
      .grid { grid-template-columns: 1fr; }
      .span-2, .span-3 { grid-column: span 1; }
      .feed { grid-template-columns: minmax(0, 1fr); }
      .support-grid { grid-template-columns: 1fr 1fr; }
      .hero-actions { align-items: flex-start; }
    }
  `]
})
export class DashboardComponent {
  auth = inject(AuthService);
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private ticketService = inject(TicketService);
  private userService = inject(UserService);
  private activityLog = inject(ActivityLogService);
  private notify = inject(NotificationService);

  private tour = inject(TourService);

  constructor() {
    this.tour.attach(inject(DestroyRef), 'inicio', () => this.tour.run(dashboardTour()));
    const loads: Promise<unknown>[] = [this.projectService.load(), this.ticketService.load(), this.companyService.load()];
    if (this.auth.isOwner()) loads.push(this.activityLog.load(), this.userService.loadStaff());
    loadPageData(this.notify, ...loads);
  }

  today = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });
  firstName = computed(() => this.auth.currentUser()?.name?.split(' ')[0] ?? '');

  ago(iso: string) { return span(Date.now() - new Date(iso).getTime()); }
  initialsOf = initials;

  // ───────── Owner ─────────

  private openTickets = computed(() => this.ticketService.getAll().filter(t => !isClosed(t)));

  private projectRows = computed(() => this.projectService.getAll().map(p => {
    const s = projectSchedule(p);
    return {
      id: p.id, name: p.name, companyId: p.companyId, progress: p.progress, endDate: p.endDate,
      expected: expectedProgress(p), tone: s.tone as ScheduleTone, label: s.label, detail: s.detail,
      daysLeft: daysUntil(p.endDate),
      company: this.companyService.getById(p.companyId)?.name ?? '',
    };
  }));

  pulse = computed(() => {
    const open = this.openTickets();
    const needsUs = open.filter(t => t.status === 'open' || t.status === 'escalated' || t.lastResponse?.authorRole === 'client' || this.ticketService.isSlaBreached(t));
    const active = this.projectRows().filter(p => p.tone !== 'done');
    return {
      attention: needsUs.length,
      breached: open.filter(t => this.ticketService.isSlaBreached(t)).length,
      unassigned: open.filter(t => !t.assignedTo).length,
      projectsAtRisk: active.filter(p => p.tone === 'risk' || p.tone === 'late').length,
      deliveries: active.filter(p => p.daysLeft >= 0 && p.daysLeft <= 30).length,
    };
  });

  summary = computed(() => {
    const p = this.pulse();
    const parts: string[] = [];
    if (p.breached) parts.push(`${p.breached} ticket${p.breached === 1 ? '' : 's'} con el SLA vencido`);
    if (p.unassigned) parts.push(`${p.unassigned} sin responsable`);
    if (p.projectsAtRisk) parts.push(`${p.projectsAtRisk} proyecto${p.projectsAtRisk === 1 ? '' : 's'} en riesgo`);
    if (!parts.length) return 'Todo está al día: sin tickets vencidos ni proyectos en riesgo.';
    const last = parts.pop()!;
    return `Hoy tienes ${parts.length ? parts.join(', ') + ' y ' : ''}${last}.`;
  });

  /** Lista única priorizada: lo vencido primero, luego lo que está por romperse. */
  attention = computed<AttentionItem[]>(() => {
    const now = Date.now();
    const items: (AttentionItem & { rank: number })[] = [];
    for (const t of this.openTickets()) {
      const left = new Date(t.slaDeadline).getTime() - now;
      // El SLA mide la primera respuesta: un ticket ya respondido no tiene reloj corriendo.
      const unanswered = !t.firstResponseAt;
      if (unanswered && left < 0) {
        items.push({ rank: 0 + left / 1e12, severity: 'critical', icon: 'alert-triangle', title: t.title,
          context: `${t.companyName} · sin respuesta, SLA vencido hace ${span(left)}${t.assignedTo ? ' · ' + t.assignedTo.name : ' · sin responsable'}`,
          link: ['/tickets', t.id], action: 'Responder' });
      } else if (!t.assignedTo && (t.priority === 'critical' || t.priority === 'high')) {
        items.push({ rank: 2, severity: 'warning', icon: 'user', title: t.title,
          context: `${t.companyName} · prioridad ${t.priority === 'critical' ? 'crítica' : 'alta'} sin responsable${unanswered ? ' · responder en ' + span(left) : ''}`,
          link: ['/tickets', t.id], action: 'Asignar' });
      } else if (unanswered && left < 4 * HOUR) {
        items.push({ rank: 1, severity: 'warning', icon: 'clock', title: t.title,
          context: `${t.companyName} · hay que responder en ${span(left)}`, link: ['/tickets', t.id], action: 'Responder' });
      }
    }
    for (const p of this.projectRows()) {
      if (p.tone === 'late') {
        items.push({ rank: 1.5, severity: 'critical', icon: 'folder', title: p.name,
          context: `${p.company} · ${p.detail} · avance ${p.progress}% (esperado ${p.expected ?? '—'}%)`, link: ['/projects', p.id], action: 'Revisar' });
      } else if (p.tone === 'risk') {
        items.push({ rank: 3, severity: 'warning', icon: 'folder', title: p.name,
          context: `${p.company} · en riesgo · avance ${p.progress}% (esperado ${p.expected ?? '—'}%)`, link: ['/projects', p.id], action: 'Revisar' });
      }
    }
    return items.sort((a, b) => a.rank - b.rank).slice(0, 8);
  });

  team = computed(() => {
    const open = this.openTickets();
    const rows = this.userService.staff().map(m => {
      const mine = open.filter(t => t.assignedTo?.id === m.id);
      return { id: m.id, name: m.name, role: m.role, initials: initials(m.name), open: mine.length,
        breached: mine.filter(t => this.ticketService.isSlaBreached(t)).length };
    });
    const max = Math.max(1, ...rows.map(r => r.open));
    return rows.map(r => ({ ...r, pct: (r.open / max) * 100 })).sort((a, b) => b.open - a.open);
  });

  deliveries = computed(() => this.projectRows()
    .filter(p => p.tone !== 'done' && p.daysLeft <= 30 && p.tone !== 'paused')
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5));

  /** Clientes activos con su puntaje de salud; los peores primero. */
  clientHealth = computed(() => {
    const tickets = this.ticketService.getAll();
    const projects = this.projectService.getAll();
    return this.companyService.getAll().filter(c => c.status === 'active').map(c => ({
      id: c.id, name: c.name, logo: c.logo,
      ...companyHealth(
        tickets.filter(t => t.companyId === c.id),
        projects.filter(p => p.companyId === c.id),
        t => this.ticketService.isSlaBreached(t),
      ),
    })).sort((a, b) => a.score - b.score).slice(0, 6);
  });

  recentActivity = computed(() => this.activityLog.getRecent(8));

  // ───────── Cliente ─────────

  myCompany = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    return id ? this.companyService.getById(id) : undefined;
  });
  mySlaHours = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    return id ? this.ticketService.getSlaHoursForCompany(id) : 24;
  });

  clientProjects = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    if (!id) return [];
    const order: Record<string, number> = { late: 0, risk: 1, ok: 2, upcoming: 3, paused: 4, done: 5 };
    return this.projectService.getByCompany(id).map((p: Project) => {
      const s = projectSchedule(p);
      return { id: p.id, name: p.name, progress: p.progress, endDate: p.endDate, tone: s.tone, label: s.label, detail: s.detail };
    }).sort((a, b) => order[a.tone] - order[b.tone]);
  });

  clientTickets = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    const mine = id ? this.ticketService.getByCompany(id) : [];
    const open = mine.filter(t => !isClosed(t)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    return {
      open: open.slice(0, 6),
      answered: open.filter(t => t.lastResponse?.authorRole === 'owner'),
      waiting: open.filter(t => t.lastResponse?.authorRole !== 'owner'),
      resolvedMonth: mine.filter(t => t.resolvedAt && new Date(t.resolvedAt) >= monthStart).length,
      csat: this.ticketService.getAverageSatisfaction(mine),
    };
  });

  clientSummary = computed(() => {
    const projects = this.clientProjects().filter(p => p.tone !== 'done');
    const t = this.clientTickets();
    const openCount = t.waiting.length + t.answered.length;
    const parts = [
      projects.length ? `${projects.length} proyecto${projects.length === 1 ? '' : 's'} en curso` : 'Sin proyectos en curso',
      `${openCount} ticket${openCount === 1 ? '' : 's'} abierto${openCount === 1 ? '' : 's'}`,
    ];
    return `${parts.join(' · ')}. Aquí ves el avance de todo lo que hacemos para tu empresa.`;
  });
}
