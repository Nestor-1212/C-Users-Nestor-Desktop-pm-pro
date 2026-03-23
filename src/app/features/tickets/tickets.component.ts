import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { CompanyService } from '../../core/services/company.service';
import { Ticket } from '../../core/models';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <div class="tickets-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isOwner() ? 'Centro de Tickets' : 'Mis Tickets de Soporte' }}</h1>
          <p>{{ auth.isOwner() ? 'Gestiona y responde solicitudes de soporte de clientes' : 'Reporta problemas y solicitudes. SLA de respuesta: 24 horas.' }}</p>
        </div>
        @if (auth.isClient()) {
          <button class="btn-primary" (click)="openModal()">+ Nuevo Ticket</button>
        }
      </div>

      <!-- Stats -->
      <div class="ticket-stats">
        <div class="ts-card yellow">
          <span class="ts-val">{{ countByStatus('open') }}</span>
          <span class="ts-lbl">Abiertos</span>
        </div>
        <div class="ts-card blue">
          <span class="ts-val">{{ countByStatus('in_review') }}</span>
          <span class="ts-lbl">En Revisión</span>
        </div>
        <div class="ts-card green">
          <span class="ts-val">{{ countByStatus('resolved') }}</span>
          <span class="ts-lbl">Resueltos</span>
        </div>
        <div class="ts-card red">
          <span class="ts-val">{{ slaBreachedCount() }}</span>
          <span class="ts-lbl">SLA Vencido</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <input type="text" placeholder="Buscar ticket..." class="search-input"
          [value]="search()" (input)="search.set($any($event.target).value)">
        <select class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="in_review">En Revisión</option>
          <option value="resolved">Resuelto</option>
          <option value="escalated">Escalado</option>
          <option value="closed">Cerrado</option>
        </select>
        <select class="filter-select" (change)="priorityFilter.set($any($event.target).value)">
          <option value="">Todas las prioridades</option>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </div>

      <!-- Tickets List -->
      <div class="tickets-list">
        @for (t of filteredTickets(); track t.id) {
          <a [routerLink]="['/tickets', t.id]" class="ticket-card" [class.sla-breached]="ticketService.isSlaBreached(t)">
            <div class="ticket-priority-bar" [class]="t.priority"></div>
            <div class="ticket-body">
              <div class="ticket-top">
                <div class="ticket-id-badge">#{{ t.id }}</div>
                <h3 class="ticket-title">{{ t.title }}</h3>
                <span class="status-badge" [class]="t.status">{{ ticketStatusLabel(t.status) }}</span>
                <span class="priority-badge" [class]="t.priority">{{ priorityLabel(t.priority) }}</span>
                @if (ticketService.isSlaBreached(t)) {
                  <span class="sla-badge">⚠️ SLA Vencido</span>
                }
              </div>
              <p class="ticket-desc">{{ t.description }}</p>
              <div class="ticket-meta">
                @if (auth.isOwner()) {
                  <span class="meta-chip company">🏢 {{ t.companyName }}</span>
                }
                <span class="meta-chip">🏷️ {{ categoryLabel(t.category) }}</span>
                <span class="meta-chip">📅 {{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                <span class="meta-chip">⏰ SLA: {{ t.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</span>
                @if (t.responses.length > 0) {
                  <span class="meta-chip responses">💬 {{ t.responses.length }} respuesta(s)</span>
                }
              </div>
            </div>
            <div class="ticket-arrow">→</div>
          </a>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon">🎫</div>
            <h3>Sin tickets</h3>
            <p>{{ auth.isClient() ? 'No tienes tickets activos. ¡Todo funciona bien!' : 'No hay tickets que coincidan con los filtros.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- New Ticket Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nuevo Ticket de Soporte</h2>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="createTicket()" class="modal-body">
            <div class="form-group">
              <label>Título del problema *</label>
              <input type="text" formControlName="title" placeholder="Describe brevemente el problema">
            </div>
            <div class="form-group">
              <label>Descripción detallada *</label>
              <textarea formControlName="description" rows="4" placeholder="Explica el problema en detalle, pasos para reproducirlo, etc."></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Categoría</label>
                <select formControlName="category">
                  <option value="bug">🐛 Error / Bug</option>
                  <option value="feature">✨ Nueva funcionalidad</option>
                  <option value="support">❓ Soporte técnico</option>
                  <option value="billing">💰 Facturación</option>
                  <option value="other">📌 Otro</option>
                </select>
              </div>
              <div class="form-group">
                <label>Prioridad</label>
                <select formControlName="priority">
                  <option value="low">🟢 Baja</option>
                  <option value="medium">🟡 Media</option>
                  <option value="high">🟠 Alta</option>
                  <option value="critical">🔴 Crítica</option>
                </select>
              </div>
            </div>
            <div class="sla-info">
              <span>⏰</span>
              <span>Tiempo de respuesta garantizado: <strong>24 horas</strong> desde la creación.</span>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">Enviar Ticket</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .tickets-page { max-width: 1000px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .page-header p { color: #64748b; font-size: 14px; margin: 0; }
    .btn-primary { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }

    .ticket-stats { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
    .ts-card { background: white; border-radius: 12px; padding: 16px 24px; border: 1px solid #e2e8f0; text-align: center; min-width: 90px; border-top: 3px solid; }
    .ts-card.yellow { border-top-color: #f59e0b; }
    .ts-card.blue { border-top-color: #3b82f6; }
    .ts-card.green { border-top-color: #10b981; }
    .ts-card.red { border-top-color: #ef4444; }
    .ts-val { display: block; font-size: 28px; font-weight: 800; color: #0f172a; }
    .ts-lbl { font-size: 12px; color: #94a3b8; font-weight: 500; }

    .filters-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-input, .filter-select { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; background: white; }
    .search-input { flex: 1; min-width: 200px; }
    .search-input:focus, .filter-select:focus { border-color: #3b82f6; }

    .tickets-list { display: flex; flex-direction: column; gap: 10px; }
    .ticket-card {
      background: white; border-radius: 14px; border: 1px solid #e2e8f0;
      display: flex; align-items: stretch; overflow: hidden;
      text-decoration: none; transition: all 0.2s; cursor: pointer;
    }
    .ticket-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
    .ticket-card.sla-breached { border-color: #fca5a5; background: #fff8f8; }

    .ticket-priority-bar { width: 4px; flex-shrink: 0; }
    .ticket-priority-bar.low { background: #10b981; }
    .ticket-priority-bar.medium { background: #f59e0b; }
    .ticket-priority-bar.high { background: #f97316; }
    .ticket-priority-bar.critical { background: #ef4444; }

    .ticket-body { flex: 1; padding: 16px 18px; }
    .ticket-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .ticket-id-badge { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; font-family: monospace; }
    .ticket-title { font-size: 15px; font-weight: 700; color: #0f172a; flex: 1; margin: 0; }
    .sla-badge { background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .ticket-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ticket-meta { display: flex; gap: 10px; flex-wrap: wrap; }
    .meta-chip { font-size: 12px; color: #64748b; background: #f8fafc; padding: 3px 8px; border-radius: 6px; }
    .meta-chip.company { background: #eff6ff; color: #1d4ed8; }
    .meta-chip.responses { background: #f0fdf4; color: #16a34a; }

    .ticket-arrow { display: flex; align-items: center; padding: 0 16px; color: #cbd5e1; font-size: 18px; }

    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.open { background: #fef3c7; color: #d97706; }
    .status-badge.in_review { background: #dbeafe; color: #1d4ed8; }
    .status-badge.resolved { background: #dcfce7; color: #16a34a; }
    .status-badge.escalated { background: #fee2e2; color: #dc2626; }
    .status-badge.closed { background: #f1f5f9; color: #64748b; }
    .priority-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .priority-badge.low { background: #dcfce7; color: #16a34a; }
    .priority-badge.medium { background: #fef3c7; color: #d97706; }
    .priority-badge.high { background: #fed7aa; color: #ea580c; }
    .priority-badge.critical { background: #fee2e2; color: #dc2626; }

    .empty-state { text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { color: #0f172a; font-size: 18px; margin-bottom: 8px; }
    .empty-state p { color: #94a3b8; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: white; border-radius: 20px; width: 100%; max-width: 560px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; }
    .modal-body { padding: 24px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; resize: vertical; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #3b82f6; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sla-info { display: flex; gap: 8px; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #1d4ed8; margin-top: 4px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 16px; }
  `]
})
export class TicketsComponent {
  auth = inject(AuthService);
  ticketService = inject(TicketService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);

  search = signal('');
  statusFilter = signal('');
  priorityFilter = signal('');
  showModal = signal(false);

  form = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    category: ['bug'],
    priority: ['medium']
  });

  filteredTickets = computed(() => {
    const user = this.auth.currentUser();
    let list = user?.role === 'client'
      ? this.ticketService.getByCompany(user.companyId!)
      : this.ticketService.getAll();
    const s = this.search().toLowerCase();
    const sf = this.statusFilter();
    const pf = this.priorityFilter();
    if (s) list = list.filter(t => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
    if (sf) list = list.filter(t => t.status === sf);
    if (pf) list = list.filter(t => t.priority === pf);
    return list.slice().reverse();
  });

  countByStatus(status: string) {
    const user = this.auth.currentUser();
    const list = user?.role === 'client'
      ? this.ticketService.getByCompany(user.companyId!)
      : this.ticketService.getAll();
    return list.filter(t => t.status === status).length;
  }

  slaBreachedCount() {
    const user = this.auth.currentUser();
    const list = user?.role === 'client'
      ? this.ticketService.getByCompany(user.companyId!)
      : this.ticketService.getAll();
    return list.filter(t => this.ticketService.isSlaBreached(t)).length;
  }

  openModal() { this.form.reset({ category: 'bug', priority: 'medium' }); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); }

  createTicket() {
    if (this.form.invalid) return;
    const user = this.auth.currentUser()!;
    const company = this.companyService.getById(user.companyId!);
    this.ticketService.create({
      companyId: user.companyId!,
      companyName: company?.name || '',
      title: this.form.value.title!,
      description: this.form.value.description!,
      category: this.form.value.category as any,
      priority: this.form.value.priority as any
    });
    this.closeModal();
  }

  ticketStatusLabel(s: string) {
    const m: any = { open: 'Abierto', in_review: 'En Revisión', resolved: 'Resuelto', escalated: 'Escalado', closed: 'Cerrado' };
    return m[s] || s;
  }
  priorityLabel(p: string) {
    const m: any = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
    return m[p] || p;
  }
  categoryLabel(c: string) {
    const m: any = { bug: 'Bug', feature: 'Funcionalidad', support: 'Soporte', billing: 'Facturación', other: 'Otro' };
    return m[c] || c;
  }
}
