import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { TicketService } from '../../core/services/ticket.service';
import { ActivityLogService } from '../../core/services/activity-log.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { Project, Ticket } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { ProjectStatusLabelPipe, TicketStatusLabelPipe, PriorityLabelPipe } from '../../shared/pipes/labels.pipe';
import { projectStatusColor } from '../../shared/utils/status-colors';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, StatCardComponent, ProjectStatusLabelPipe, TicketStatusLabelPipe, PriorityLabelPipe],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <div class="page-header dash-header">
        <div class="dash-header-main">
          @if (auth.isClient() && myCompanyLogo()) {
            <img class="company-logo-badge" [src]="myCompanyLogo()!" alt="Logo de tu empresa">
          }
          <div>
            <span class="eyebrow">{{ greeting() }}{{ firstName() ? ', ' + firstName() : '' }}</span>
            <h1>Dashboard</h1>
            <p>{{ auth.isOwner() ? 'Panel de administración del sistema' : 'Panel de tu empresa' }}</p>
          </div>
        </div>
        <span class="date-badge"><app-icon name="calendar" [size]="14" /> {{ today }}</span>
      </div>

      <!-- Owner Stats -->
      @if (auth.isOwner()) {
        <div class="stats-grid">
          <app-stat-card [value]="stats().totalCompanies" label="Empresas Activas" icon="building" color="blue" />
          <app-stat-card [value]="stats().totalProjects" label="Total Proyectos" icon="folder" color="indigo" />
          <app-stat-card [value]="stats().completedProjects" label="Completados" icon="check" color="green" />
          <app-stat-card [value]="stats().inProgressProjects" label="En Progreso" icon="settings" color="yellow" />
          <app-stat-card [value]="stats().openTickets" label="Tickets Abiertos" icon="ticket" color="red" />
          <app-stat-card [value]="stats().slaBreached" label="SLA Vencidos" icon="alert-triangle" color="orange" />
          <app-stat-card [value]="stats().avgSatisfaction !== null ? (stats().avgSatisfaction + '/5') : 'Sin datos'" label="Satisfacción" icon="star" color="yellow" />
          <app-stat-card [value]="'Q' + stats().pendingBilling.toLocaleString('es-GT')" label="Facturación Pendiente" icon="dollar-sign" color="red" />
        </div>

        <!-- Charts + Recent -->
        <div class="content-grid">
          <!-- Projects by Status -->
          <div class="card">
            <div class="card-header">
              <h3>Proyectos por Estado</h3>
            </div>
            <div class="donut-layout">
              <div class="donut-chart" [style.background]="projectsByStatusChart().gradient">
                <div class="donut-hole">
                  <span class="donut-total">{{ projectsByStatusChart().total }}</span>
                  <span class="donut-label">Proyectos</span>
                </div>
              </div>
              <div class="donut-legend">
                @for (item of projectsByStatus(); track item.label) {
                  <div class="legend-row">
                    <span class="dot" [style.background]="item.color"></span>
                    <span class="legend-label">{{ item.label }}</span>
                    <span class="legend-count">{{ item.count }}</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Companies Summary -->
          <div class="card">
            <div class="card-header">
              <h3>Resumen por Empresa</h3>
              <a routerLink="/companies" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="company-list">
              @for (item of companySummary(); track item.id) {
                <div class="company-row">
                  <div class="company-avatar">{{ item.name[0] }}</div>
                  <div class="company-meta">
                    <span class="company-name">{{ item.name }}</span>
                    <span class="company-sub">{{ item.projectCount }} proyectos · {{ item.plan }}</span>
                  </div>
                  <span class="status-badge" [class]="item.status">{{ item.status === 'active' ? 'Activa' : 'Inactiva' }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Recent Projects & Tickets -->
        <div class="content-grid">
          <div class="card">
            <div class="card-header">
              <h3>Proyectos Recientes</h3>
              <a routerLink="/projects" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="project-list">
              @for (p of recentProjects(); track p.id) {
                <a [routerLink]="['/projects', p.id]" class="project-row">
                  <div class="project-info">
                    <span class="project-name">{{ p.name }}</span>
                    <span class="project-company">{{ getCompanyName(p.companyId) }}</span>
                  </div>
                  <div class="project-right">
                    <div class="progress-mini">
                      <div class="progress-fill" [style.width.%]="p.progress"></div>
                    </div>
                    <span class="progress-pct">{{ p.progress }}%</span>
                    <span class="status-badge" [class]="p.status">{{ p.status | projectStatusLabel }}</span>
                  </div>
                </a>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Tickets Recientes</h3>
              <a routerLink="/tickets" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="ticket-list">
              @for (t of recentTickets(); track t.id) {
                <a [routerLink]="['/tickets', t.id]" class="ticket-row">
                  <span class="priority-dot" [class]="t.priority" [title]="t.priority | priorityLabel:true"></span>
                  <div class="ticket-info">
                    <span class="ticket-title">{{ t.title }}</span>
                    <span class="ticket-company">{{ t.companyName }}</span>
                  </div>
                  <span class="status-badge" [class]="t.status">{{ t.status | ticketStatusLabel }}</span>
                </a>
              }
            </div>
          </div>
        </div>

        <!-- Recent Activity -->
        <div class="card">
          <div class="card-header">
            <h3>Actividad Reciente</h3>
            <a routerLink="/activity" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
          </div>
          <div class="activity-feed">
            @for (e of recentActivity(); track e.id) {
              <div class="activity-feed-row">
                <span class="activity-dot"></span>
                <p class="activity-feed-text"><strong>{{ e.actorName }}</strong> {{ e.description }}</p>
                <span class="activity-feed-date">{{ e.createdAt | date:'dd/MM HH:mm' }}</span>
              </div>
            } @empty {
              <p class="activity-feed-empty">Sin actividad reciente.</p>
            }
          </div>
        </div>
      }

      <!-- Client Dashboard -->
      @if (auth.isClient()) {
        <div class="stats-grid">
          <app-stat-card [value]="clientStats().totalProjects" label="Mis Proyectos" icon="folder" color="blue" />
          <app-stat-card [value]="clientStats().completed" label="Completados" icon="check" color="green" />
          <app-stat-card [value]="clientStats().inProgress" label="En Progreso" icon="settings" color="yellow" />
          <app-stat-card [value]="clientStats().openTickets" label="Tickets Abiertos" icon="ticket" color="red" />
        </div>

        <div class="content-grid">
          <div class="card full-width">
            <div class="card-header">
              <h3>Mis Proyectos</h3>
              <a routerLink="/projects" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="project-list">
              @for (p of clientProjects(); track p.id) {
                <a [routerLink]="['/projects', p.id]" class="project-row">
                  <div class="project-info">
                    <span class="project-name">{{ p.name }}</span>
                    <span class="project-company">{{ p.startDate }} → {{ p.endDate }}</span>
                  </div>
                  <div class="project-right">
                    <div class="progress-mini">
                      <div class="progress-fill" [style.width.%]="p.progress"></div>
                    </div>
                    <span class="progress-pct">{{ p.progress }}%</span>
                    <span class="status-badge" [class]="p.status">{{ p.status | projectStatusLabel }}</span>
                  </div>
                </a>
              } @empty {
                <div class="empty-state">
                  <div class="empty-icon"><app-icon name="folder" [size]="32" /></div>
                  <h3>Sin proyectos</h3>
                  <p>No tienes proyectos asignados todavía.</p>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="content-grid">
          <div class="card full-width">
            <div class="card-header">
              <h3>Mis Tickets Recientes</h3>
              <a routerLink="/tickets" class="see-all">Ver todo <app-icon name="chevron-right" [size]="14" /></a>
            </div>
            <div class="ticket-list">
              @for (t of clientTickets(); track t.id) {
                <a [routerLink]="['/tickets', t.id]" class="ticket-row">
                  <span class="priority-dot" [class]="t.priority" [title]="t.priority | priorityLabel:true"></span>
                  <div class="ticket-info">
                    <span class="ticket-title">{{ t.title }}</span>
                    <span class="ticket-company">{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <span class="status-badge" [class]="t.status">{{ t.status | ticketStatusLabel }}</span>
                </a>
              } @empty {
                <div class="empty-state">
                  <div class="empty-icon"><app-icon name="ticket" [size]="32" /></div>
                  <h3>Sin tickets</h3>
                  <p>No tienes tickets. <a routerLink="/tickets">Crear uno</a></p>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; margin: 0 auto; }

    .dash-header-main { display: flex; align-items: center; gap: 14px; }
    .company-logo-badge {
      width: 48px; height: 48px; border-radius: 12px; object-fit: contain;
      background: #fff; border: 1px solid var(--color-border, #e2e8f0); padding: 5px; box-sizing: border-box;
      box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); flex-shrink: 0;
    }
    .dash-header .eyebrow {
      display: inline-flex; align-items: center; font-size: 13px; font-weight: 600;
      color: var(--color-primary-700, #0f4b92); background: var(--color-primary-50, #e8f1fd);
      padding: 4px 12px; border-radius: 20px; margin-bottom: 10px;
    }
    .date-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fff; color: #334155; padding: 8px 16px; border-radius: 20px;
      font-size: 13px; font-weight: 600; white-space: nowrap; text-transform: capitalize;
      border: 1px solid var(--color-border, #e2e8f0); box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06));
    }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; align-items: stretch; }
    .stats-grid app-stat-card { display: block; animation: fade-up 0.4s ease both; }
    .stats-grid app-stat-card:nth-child(1) { animation-delay: 0s; }
    .stats-grid app-stat-card:nth-child(2) { animation-delay: .04s; }
    .stats-grid app-stat-card:nth-child(3) { animation-delay: .08s; }
    .stats-grid app-stat-card:nth-child(4) { animation-delay: .12s; }
    .stats-grid app-stat-card:nth-child(5) { animation-delay: .16s; }
    .stats-grid app-stat-card:nth-child(6) { animation-delay: .2s; }
    @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) {
      .stats-grid app-stat-card { animation: none; }
    }

    .content-grid { display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; margin-bottom: 20px; }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f1f5f9; transition: box-shadow 0.25s; }
    .card:hover { box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0,0,0,0.08)); }
    .card.full-width { grid-column: 1 / -1; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .see-all { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; color: var(--color-primary-700, #0f4b92); text-decoration: none; font-weight: 500; }
    .see-all:hover { text-decoration: underline; }

    /* Donut chart (distribución de proyectos por estado) */
    .donut-layout { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .donut-chart {
      position: relative; width: 148px; height: 148px; border-radius: 50%; flex-shrink: 0;
      transition: background 0.4s;
    }
    .donut-hole {
      position: absolute; inset: 18px; border-radius: 50%; background: var(--color-surface, #fff);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      box-shadow: inset 0 0 0 1px rgba(15,23,42,0.05);
    }
    .donut-total { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1; }
    .donut-label { font-size: 11px; color: #64748b; margin-top: 2px; }
    .donut-legend { flex: 1; min-width: 160px; display: flex; flex-direction: column; gap: 10px; }
    .legend-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; }
    .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { flex: 1; }
    .legend-count { font-weight: 700; color: #0f172a; }
    @media (max-width: 480px) { .donut-layout { justify-content: center; } }

    /* Company list */
    .company-list { display: flex; flex-direction: column; gap: 10px; }
    .company-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f8fafc; }
    .company-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--gradient-primary, linear-gradient(135deg, #0f4b92, #1465c5));
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 10px -4px rgba(30,64,175,0.55);
    }
    .company-meta { flex: 1; }
    .company-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .company-sub { display: block; font-size: 12px; color: #64748b; }

    /* Project list */
    .project-list { display: flex; flex-direction: column; gap: 6px; }
    .project-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; text-decoration: none; transition: background 0.15s, transform 0.15s, border-color 0.15s;
      border: 1px solid transparent;
    }
    .project-row:hover { background: #f8fafc; border-color: #e2e8f0; transform: translateX(2px); }
    .project-info { flex: 1; }
    .project-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .project-company { display: block; font-size: 12px; color: #64748b; }
    .project-right { display: flex; align-items: center; gap: 8px; }
    .progress-mini { width: 60px; height: 5px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--color-primary-500, #1465c5); border-radius: 10px; }
    .progress-pct { font-size: 12px; font-weight: 600; color: #475569; min-width: 30px; text-align: right; }

    /* Tickets */
    .ticket-list { display: flex; flex-direction: column; gap: 6px; }
    .ticket-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; text-decoration: none; transition: background 0.15s, transform 0.15s, border-color 0.15s;
      border: 1px solid transparent;
    }
    .ticket-row:hover { background: #f8fafc; border-color: #e2e8f0; transform: translateX(2px); }
    .priority-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .priority-dot.low { background: #16a34a; }
    .priority-dot.medium { background: #d97706; }
    .priority-dot.high { background: #ea580c; }
    .priority-dot.critical { background: #dc2626; }
    .ticket-info { flex: 1; }
    .ticket-title { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .ticket-company { display: block; font-size: 12px; color: #64748b; }

    .activity-feed { display: flex; flex-direction: column; gap: 10px; }
    .activity-feed-row { display: flex; align-items: flex-start; gap: 10px; padding: 4px 0; }
    .activity-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-primary-500, #1465c5); margin-top: 6px; flex-shrink: 0; }
    .activity-feed-text { flex: 1; font-size: 13px; color: #374151; margin: 0; line-height: 1.4; }
    .activity-feed-text strong { color: #0f172a; }
    .activity-feed-date { font-size: 11.5px; color: #94a3b8; flex-shrink: 0; white-space: nowrap; }
    .activity-feed-empty { font-size: 13px; color: #94a3b8; margin: 0; text-align: center; padding: 12px 0; }

    @media (max-width: 768px) { .content-grid { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  auth = inject(AuthService);
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private ticketService = inject(TicketService);
  private activityLog = inject(ActivityLogService);
  private invoiceService = inject(InvoiceService);

  recentActivity = computed(() => this.activityLog.getRecent(6));

  today = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
  });
  firstName = computed(() => this.auth.currentUser()?.name?.split(' ')[0] ?? '');
  myCompanyLogo = computed(() => {
    const user = this.auth.currentUser();
    return user?.companyId ? this.companyService.getById(user.companyId)?.logo : undefined;
  });

  stats = computed(() => {
    const projects = this.projectService.getAll();
    const tickets = this.ticketService.getAll();
    const companies = this.companyService.getAll().filter(c => c.status === 'active');
    return {
      totalCompanies: companies.length,
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      inProgressProjects: projects.filter(p => p.status === 'in_progress').length,
      openTickets: tickets.filter(t => t.status === 'open').length,
      slaBreached: tickets.filter(t => this.ticketService.isSlaBreached(t)).length,
      avgSatisfaction: this.ticketService.getAverageSatisfaction(tickets),
      pendingBilling: this.invoiceService.totalPending(),
    };
  });

  projectsByStatus = computed(() => {
    const projects = this.projectService.getAll();
    const total = projects.length || 1;
    const items = [
      { label: 'En Progreso', key: 'in_progress', color: projectStatusColor('in_progress') },
      { label: 'Revisión', key: 'review', color: projectStatusColor('review') },
      { label: 'Completado', key: 'completed', color: projectStatusColor('completed') },
      { label: 'Planificación', key: 'planning', color: projectStatusColor('planning') },
      { label: 'En Espera', key: 'on_hold', color: projectStatusColor('on_hold') },
    ];
    return items.map(i => ({ ...i, count: projects.filter(p => p.status === i.key).length, pct: Math.round(projects.filter(p => p.status === i.key).length / total * 100) }));
  });

  projectsByStatusChart = computed(() => {
    const items = this.projectsByStatus();
    const total = items.reduce((sum, i) => sum + i.count, 0);
    let cumulative = 0;
    const segments = items.filter(i => i.count > 0).map(i => {
      const start = cumulative;
      cumulative += total ? (i.count / total) * 100 : 0;
      return `${i.color} ${start}% ${cumulative}%`;
    });
    const gradient = segments.length ? `conic-gradient(${segments.join(', ')})` : 'conic-gradient(#e2e8f0 0 100%)';
    return { gradient, total };
  });

  companySummary = computed(() => {
    const companies = this.companyService.getAll();
    const projects = this.projectService.getAll();
    return companies.map(c => ({ ...c, projectCount: projects.filter(p => p.companyId === c.id).length }));
  });

  recentProjects = computed(() => this.projectService.getAll().slice(-5).reverse());
  recentTickets = computed(() => this.ticketService.getAll().slice(-5).reverse());

  clientStats = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.companyId) return { totalProjects: 0, completed: 0, inProgress: 0, openTickets: 0 };
    const projects = this.projectService.getByCompany(user.companyId);
    const tickets = this.ticketService.getByCompany(user.companyId);
    return {
      totalProjects: projects.length,
      completed: projects.filter(p => p.status === 'completed').length,
      inProgress: projects.filter(p => p.status === 'in_progress').length,
      openTickets: tickets.filter(t => t.status === 'open').length,
    };
  });

  clientProjects = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.companyId) return [];
    return this.projectService.getByCompany(user.companyId);
  });

  clientTickets = computed(() => {
    const user = this.auth.currentUser();
    if (!user?.companyId) return [];
    return this.ticketService.getByCompany(user.companyId).slice(-5).reverse();
  });

  getCompanyName(id: string) { return this.companyService.getById(id)?.name || 'N/A'; }
}
