import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { TicketService } from '../../core/services/ticket.service';
import { Project, Ticket } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>{{ auth.isOwner() ? 'Panel de administración del sistema' : 'Panel de tu empresa' }}</p>
        </div>
        <span class="date-badge">{{ today }}</span>
      </div>

      <!-- Owner Stats -->
      @if (auth.isOwner()) {
        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-icon">🏢</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().totalCompanies }}</span>
              <span class="stat-label">Empresas Activas</span>
            </div>
          </div>
          <div class="stat-card indigo">
            <div class="stat-icon">📁</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().totalProjects }}</span>
              <span class="stat-label">Total Proyectos</span>
            </div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().completedProjects }}</span>
              <span class="stat-label">Completados</span>
            </div>
          </div>
          <div class="stat-card yellow">
            <div class="stat-icon">⚙️</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().inProgressProjects }}</span>
              <span class="stat-label">En Progreso</span>
            </div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon">🎫</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().openTickets }}</span>
              <span class="stat-label">Tickets Abiertos</span>
            </div>
          </div>
          <div class="stat-card orange">
            <div class="stat-icon">⚠️</div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().slaBreached }}</span>
              <span class="stat-label">SLA Vencidos</span>
            </div>
          </div>
        </div>

        <!-- Charts + Recent -->
        <div class="content-grid">
          <!-- Projects by Status -->
          <div class="card">
            <div class="card-header">
              <h3>Proyectos por Estado</h3>
            </div>
            <div class="status-bars">
              @for (item of projectsByStatus(); track item.label) {
                <div class="status-bar-item">
                  <div class="status-bar-label">
                    <span class="dot" [style.background]="item.color"></span>
                    <span>{{ item.label }}</span>
                    <span class="count">{{ item.count }}</span>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" [style.width.%]="item.pct" [style.background]="item.color"></div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Companies Summary -->
          <div class="card">
            <div class="card-header">
              <h3>Resumen por Empresa</h3>
              <a routerLink="/companies" class="see-all">Ver todo →</a>
            </div>
            <div class="company-list">
              @for (item of companySummary(); track item.id) {
                <div class="company-row">
                  <div class="company-avatar">{{ item.name[0] }}</div>
                  <div class="company-meta">
                    <span class="company-name">{{ item.name }}</span>
                    <span class="company-sub">{{ item.projectCount }} proyectos · {{ item.plan }}</span>
                  </div>
                  <span class="badge-status" [class]="item.status">{{ item.status === 'active' ? 'Activa' : 'Inactiva' }}</span>
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
              <a routerLink="/projects" class="see-all">Ver todo →</a>
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
                    <span class="status-badge" [class]="p.status">{{ statusLabel(p.status) }}</span>
                  </div>
                </a>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3>Tickets Recientes</h3>
              <a routerLink="/tickets" class="see-all">Ver todo →</a>
            </div>
            <div class="ticket-list">
              @for (t of recentTickets(); track t.id) {
                <a [routerLink]="['/tickets', t.id]" class="ticket-row">
                  <div class="ticket-icon" [class]="t.priority">{{ priorityIcon(t.priority) }}</div>
                  <div class="ticket-info">
                    <span class="ticket-title">{{ t.title }}</span>
                    <span class="ticket-company">{{ t.companyName }}</span>
                  </div>
                  <span class="status-badge" [class]="t.status">{{ ticketStatusLabel(t.status) }}</span>
                </a>
              }
            </div>
          </div>
        </div>
      }

      <!-- Client Dashboard -->
      @if (auth.isClient()) {
        <div class="stats-grid">
          <div class="stat-card blue">
            <div class="stat-icon">📁</div>
            <div class="stat-info">
              <span class="stat-value">{{ clientStats().totalProjects }}</span>
              <span class="stat-label">Mis Proyectos</span>
            </div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <span class="stat-value">{{ clientStats().completed }}</span>
              <span class="stat-label">Completados</span>
            </div>
          </div>
          <div class="stat-card yellow">
            <div class="stat-icon">⚙️</div>
            <div class="stat-info">
              <span class="stat-value">{{ clientStats().inProgress }}</span>
              <span class="stat-label">En Progreso</span>
            </div>
          </div>
          <div class="stat-card red">
            <div class="stat-icon">🎫</div>
            <div class="stat-info">
              <span class="stat-value">{{ clientStats().openTickets }}</span>
              <span class="stat-label">Tickets Abiertos</span>
            </div>
          </div>
        </div>

        <div class="content-grid">
          <div class="card full-width">
            <div class="card-header">
              <h3>Mis Proyectos</h3>
              <a routerLink="/projects" class="see-all">Ver todo →</a>
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
                    <span class="status-badge" [class]="p.status">{{ statusLabel(p.status) }}</span>
                  </div>
                </a>
              } @empty {
                <p class="empty-msg">No tienes proyectos asignados todavía.</p>
              }
            </div>
          </div>
        </div>

        <div class="content-grid">
          <div class="card full-width">
            <div class="card-header">
              <h3>Mis Tickets Recientes</h3>
              <a routerLink="/tickets" class="see-all">Ver todo →</a>
            </div>
            <div class="ticket-list">
              @for (t of clientTickets(); track t.id) {
                <a [routerLink]="['/tickets', t.id]" class="ticket-row">
                  <div class="ticket-icon" [class]="t.priority">{{ priorityIcon(t.priority) }}</div>
                  <div class="ticket-info">
                    <span class="ticket-title">{{ t.title }}</span>
                    <span class="ticket-company">{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                  </div>
                  <span class="status-badge" [class]="t.status">{{ ticketStatusLabel(t.status) }}</span>
                </a>
              } @empty {
                <p class="empty-msg">No tienes tickets. <a routerLink="/tickets">Crear uno</a></p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard { max-width: 1200px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .page-header p { color: #64748b; font-size: 14px; margin: 0; }
    .date-badge { background: #e0e7ff; color: #4338ca; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card {
      background: white; border-radius: 16px; padding: 20px;
      display: flex; align-items: center; gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f1f5f9;
    }
    .stat-icon { font-size: 28px; }
    .stat-value { font-size: 28px; font-weight: 800; display: block; line-height: 1; }
    .stat-label { font-size: 12px; color: #64748b; font-weight: 500; display: block; margin-top: 4px; }
    .stat-card.blue .stat-value { color: #1e40af; }
    .stat-card.indigo .stat-value { color: #4338ca; }
    .stat-card.green .stat-value { color: #059669; }
    .stat-card.yellow .stat-value { color: #d97706; }
    .stat-card.red .stat-value { color: #dc2626; }
    .stat-card.orange .stat-value { color: #ea580c; }

    .content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border: 1px solid #f1f5f9; }
    .card.full-width { grid-column: 1 / -1; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; }
    .see-all { font-size: 13px; color: #3b82f6; text-decoration: none; font-weight: 500; }
    .see-all:hover { text-decoration: underline; }

    /* Status bars */
    .status-bars { display: flex; flex-direction: column; gap: 12px; }
    .status-bar-item {}
    .status-bar-label { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 13px; color: #374151; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .count { margin-left: auto; font-weight: 700; color: #0f172a; }
    .bar-track { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 10px; transition: width 0.5s; }

    /* Company list */
    .company-list { display: flex; flex-direction: column; gap: 10px; }
    .company-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f8fafc; }
    .company-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #1e40af, #3b82f6);
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 700; flex-shrink: 0;
    }
    .company-meta { flex: 1; }
    .company-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .company-sub { display: block; font-size: 12px; color: #94a3b8; }
    .badge-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-status.active { background: #dcfce7; color: #16a34a; }
    .badge-status.inactive { background: #f1f5f9; color: #64748b; }

    /* Project list */
    .project-list { display: flex; flex-direction: column; gap: 6px; }
    .project-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; text-decoration: none; transition: background 0.15s;
      border: 1px solid transparent;
    }
    .project-row:hover { background: #f8fafc; border-color: #e2e8f0; }
    .project-info { flex: 1; }
    .project-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .project-company { display: block; font-size: 12px; color: #94a3b8; }
    .project-right { display: flex; align-items: center; gap: 8px; }
    .progress-mini { width: 60px; height: 5px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; background: #3b82f6; border-radius: 10px; }
    .progress-pct { font-size: 12px; font-weight: 600; color: #475569; min-width: 30px; text-align: right; }

    /* Tickets */
    .ticket-list { display: flex; flex-direction: column; gap: 6px; }
    .ticket-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 10px; text-decoration: none; transition: background 0.15s;
      border: 1px solid transparent;
    }
    .ticket-row:hover { background: #f8fafc; border-color: #e2e8f0; }
    .ticket-icon { font-size: 20px; }
    .ticket-info { flex: 1; }
    .ticket-title { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .ticket-company { display: block; font-size: 12px; color: #94a3b8; }

    /* Status badges */
    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .status-badge.planning { background: #e0e7ff; color: #4338ca; }
    .status-badge.in_progress { background: #dbeafe; color: #1d4ed8; }
    .status-badge.review { background: #fef3c7; color: #d97706; }
    .status-badge.completed { background: #dcfce7; color: #16a34a; }
    .status-badge.on_hold { background: #f1f5f9; color: #64748b; }
    .status-badge.open { background: #fef3c7; color: #d97706; }
    .status-badge.in_review { background: #dbeafe; color: #1d4ed8; }
    .status-badge.resolved { background: #dcfce7; color: #16a34a; }
    .status-badge.escalated { background: #fee2e2; color: #dc2626; }
    .status-badge.closed { background: #f1f5f9; color: #64748b; }

    .empty-msg { color: #94a3b8; font-size: 14px; text-align: center; padding: 20px; }
    .empty-msg a { color: #3b82f6; }

    @media (max-width: 768px) { .content-grid { grid-template-columns: 1fr; } }
  `]
})
export class DashboardComponent {
  auth = inject(AuthService);
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private ticketService = inject(TicketService);

  today = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
    };
  });

  projectsByStatus = computed(() => {
    const projects = this.projectService.getAll();
    const total = projects.length || 1;
    const items = [
      { label: 'En Progreso', key: 'in_progress', color: '#3b82f6' },
      { label: 'Revisión', key: 'review', color: '#f59e0b' },
      { label: 'Completado', key: 'completed', color: '#10b981' },
      { label: 'Planificación', key: 'planning', color: '#8b5cf6' },
      { label: 'En Espera', key: 'on_hold', color: '#94a3b8' },
    ];
    return items.map(i => ({ ...i, count: projects.filter(p => p.status === i.key).length, pct: Math.round(projects.filter(p => p.status === i.key).length / total * 100) }));
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
  statusLabel(s: string) {
    const m: any = { planning: 'Planificación', in_progress: 'En Progreso', review: 'Revisión', completed: 'Completado', on_hold: 'En Espera' };
    return m[s] || s;
  }
  ticketStatusLabel(s: string) {
    const m: any = { open: 'Abierto', in_review: 'En Revisión', resolved: 'Resuelto', escalated: 'Escalado', closed: 'Cerrado' };
    return m[s] || s;
  }
  priorityIcon(p: string) {
    return { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[p] || '⚪';
  }
}
