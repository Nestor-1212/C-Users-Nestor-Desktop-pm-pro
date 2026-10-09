import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { CompanyService } from '../../core/services/company.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { fileIcon, formatFileSize, MAX_ATTACHMENT_SIZE } from '../../shared/utils/file.util';
import { exportToExcel, exportToPdf } from '../../shared/utils/export.util';
import { TicketStatusLabelPipe, PriorityLabelPipe, CategoryLabelPipe, TICKET_STATUS_LABELS } from '../../shared/pipes/labels.pipe';
import { ExportMenuComponent, ExportFormat } from '../../shared/export-menu/export-menu.component';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe, IconComponent, StatCardComponent, ModalFocusTrapDirective, TicketStatusLabelPipe, PriorityLabelPipe, CategoryLabelPipe, ExportMenuComponent],
  template: `
    <div class="tickets-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isOwner() ? 'Centro de Tickets' : 'Mis Tickets de Soporte' }}</h1>
          <p>{{ auth.isOwner() ? 'Gestiona y responde solicitudes de soporte de clientes' : 'Reporta problemas y solicitudes. SLA de respuesta: ' + mySlaHours() + ' horas.' }}</p>
        </div>
        <div class="header-actions">
          <app-export-menu (formatSelected)="exportTickets($event)" />
          @if (auth.isClient()) {
            <button class="btn-primary" (click)="openModal()">
              <app-icon name="plus" [size]="16" /> Nuevo Ticket
            </button>
          }
        </div>
      </div>

      <!-- Stats -->
      <div class="ticket-stats">
        <app-stat-card [value]="countByStatus('open')" label="Abiertos" icon="inbox" color="yellow" />
        <app-stat-card [value]="countByStatus('in_review')" label="En Revisión" icon="search" color="blue" />
        <app-stat-card [value]="countByStatus('resolved')" label="Resueltos" icon="check" color="green" />
        <app-stat-card [value]="slaBreachedCount()" label="SLA Vencido" icon="alert-triangle" color="red" />
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="ticket-search" class="sr-only">Buscar ticket</label>
          <input id="ticket-search" type="text" placeholder="Buscar ticket..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="ticket-status-filter" class="sr-only">Filtrar por estado</label>
        <select id="ticket-status-filter" class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="in_review">En Revisión</option>
          <option value="resolved">Resuelto</option>
          <option value="escalated">Escalado</option>
          <option value="closed">Cerrado</option>
        </select>
        <label for="ticket-priority-filter" class="sr-only">Filtrar por prioridad</label>
        <select id="ticket-priority-filter" class="filter-select" (change)="priorityFilter.set($any($event.target).value)">
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
                <span class="status-badge" [class]="t.status">{{ t.status | ticketStatusLabel }}</span>
                <span class="priority-badge" [class]="t.priority">{{ t.priority | priorityLabel }}</span>
                @if (ticketService.isSlaBreached(t)) {
                  <span class="sla-badge"><app-icon name="alert-triangle" [size]="12" /> SLA Vencido</span>
                }
              </div>
              <p class="ticket-desc">{{ t.description }}</p>
              <div class="ticket-meta">
                @if (auth.isOwner()) {
                  <span class="meta-chip company"><app-icon name="building" [size]="12" /> {{ t.companyName }}</span>
                }
                <span class="meta-chip"><app-icon name="tag" [size]="12" /> {{ t.category | categoryLabel }}</span>
                <span class="meta-chip"><app-icon name="calendar" [size]="12" /> {{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                <span class="meta-chip"><app-icon name="clock" [size]="12" /> SLA: {{ t.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</span>
                @if (t.responses.length > 0) {
                  <span class="meta-chip responses"><app-icon name="message-circle" [size]="12" /> {{ t.responses.length }} respuesta(s)</span>
                }
              </div>
            </div>
            <div class="ticket-arrow"><app-icon name="chevron-right" [size]="18" /></div>
          </a>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon"><app-icon name="ticket" [size]="32" /></div>
            <h3>Sin tickets</h3>
            <p>{{ auth.isClient() ? 'No tienes tickets activos. ¡Todo funciona bien!' : 'No hay tickets que coincidan con los filtros.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- New Ticket Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="ticket-modal-title">Nuevo Ticket de Soporte</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="createTicket()" class="modal-body" novalidate>
            <div class="form-group">
              <label for="ticket-title">Título del problema *</label>
              <input id="ticket-title" type="text" formControlName="title" placeholder="Describe brevemente el problema"
                [class.error]="invalid('title')" [attr.aria-invalid]="invalid('title')">
              @if (invalid('title')) { <span class="field-error">El título es obligatorio.</span> }
            </div>
            <div class="form-group">
              <label for="ticket-description">Descripción detallada *</label>
              <textarea id="ticket-description" formControlName="description" rows="4" placeholder="Explica el problema en detalle, pasos para reproducirlo, etc."
                [class.error]="invalid('description')" [attr.aria-invalid]="invalid('description')"></textarea>
              @if (invalid('description')) { <span class="field-error">La descripción es obligatoria.</span> }
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="ticket-category">Categoría</label>
                <select id="ticket-category" formControlName="category">
                  <option value="bug">Error / Bug</option>
                  <option value="feature">Nueva funcionalidad</option>
                  <option value="support">Soporte técnico</option>
                  <option value="billing">Facturación</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div class="form-group">
                <label for="ticket-priority">Prioridad</label>
                <select id="ticket-priority" formControlName="priority">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="ticket-attachment">Adjuntar archivo (opcional)</label>
              <input id="ticket-attachment" type="file" accept="image/*,.pdf" (change)="onAttachmentSelected($event)">
              @if (selectedAttachment()) {
                <div class="attachment-chip">
                  <app-icon [name]="fileIcon(selectedAttachment()!.name.split('.').pop() || '')" [size]="14" />
                  <span>{{ selectedAttachment()!.name }} · {{ formatFileSize(selectedAttachment()!.size) }}</span>
                  <button type="button" (click)="clearAttachment()" aria-label="Quitar adjunto"><app-icon name="x" [size]="13" /></button>
                </div>
              }
            </div>
            <div class="sla-info">
              <app-icon name="clock" [size]="16" />
              <span>Tiempo de respuesta garantizado: <strong>{{ mySlaHours() }} horas</strong> desde la creación (plan {{ myPlan() }}).</span>
            </div>
            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">Enviar Ticket</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .tickets-page { max-width: 1000px; margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .ticket-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px; }

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
    .sla-badge { display: inline-flex; align-items: center; gap: 4px; background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .ticket-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ticket-meta { display: flex; gap: 10px; flex-wrap: wrap; }
    .meta-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; background: #f8fafc; padding: 3px 8px; border-radius: 6px; }
    .meta-chip.company { background: #eff6ff; color: #1d4ed8; }
    .meta-chip.responses { background: #f0fdf4; color: #16a34a; }

    .ticket-arrow { display: flex; align-items: center; padding: 0 16px; color: #cbd5e1; }

    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; resize: vertical; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--color-primary-500, #1465c5); }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sla-info { display: flex; gap: 8px; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #1d4ed8; margin-top: 4px; }

    .attachment-chip {
      display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
      background: var(--color-neutral-bg, #f1f5f9); border-radius: 8px; padding: 6px 10px;
      font-size: 12.5px; color: #475569;
    }
    .attachment-chip button { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; margin-left: 4px; }
    .attachment-chip button:hover { color: #dc2626; }

    @media (max-width: 640px) {
      .form-grid-2 { grid-template-columns: 1fr; }
      .ticket-arrow { padding: 0 10px; }
    }
  `]
})
export class TicketsComponent {
  auth = inject(AuthService);
  ticketService = inject(TicketService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  search = signal('');
  statusFilter = signal('');
  priorityFilter = signal('');
  showModal = signal(false);
  selectedAttachment = signal<{ name: string; type: string; size: number; data: string } | null>(null);

  fileIcon = fileIcon;
  formatFileSize = formatFileSize;

  form = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required],
    category: ['bug'],
    priority: ['medium']
  });

  myCompany = computed(() => {
    const user = this.auth.currentUser();
    return user?.companyId ? this.companyService.getById(user.companyId) : undefined;
  });
  myPlan = computed(() => this.myCompany()?.plan || 'Standard');
  mySlaHours = computed(() => {
    const user = this.auth.currentUser();
    return user?.companyId ? this.ticketService.getSlaHoursForCompany(user.companyId) : 24;
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

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  openModal() { this.form.reset({ category: 'bug', priority: 'medium' }); this.selectedAttachment.set(null); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); }

  onAttachmentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      this.notify.error('El archivo es muy pesado (máximo 2MB).');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.selectedAttachment.set({
      name: file.name,
      type: file.name.split('.').pop()?.toLowerCase() || 'file',
      size: file.size,
      data: reader.result as string
    });
    reader.readAsDataURL(file);
  }

  clearAttachment() {
    this.selectedAttachment.set(null);
  }

  exportTickets(format: ExportFormat) {
    const rows = this.filteredTickets();
    const columns = [
      { header: 'ID', value: (t: typeof rows[number]) => t.id },
      { header: 'Título', value: (t: typeof rows[number]) => t.title },
      { header: 'Empresa', value: (t: typeof rows[number]) => t.companyName },
      { header: 'Categoría', value: (t: typeof rows[number]) => t.category },
      { header: 'Prioridad', value: (t: typeof rows[number]) => t.priority },
      { header: 'Estado', value: (t: typeof rows[number]) => TICKET_STATUS_LABELS[t.status] ?? t.status },
      { header: 'Creado', value: (t: typeof rows[number]) => new Date(t.createdAt).toLocaleString('es-GT') },
      { header: 'SLA límite', value: (t: typeof rows[number]) => new Date(t.slaDeadline).toLocaleString('es-GT') },
      { header: 'Respuestas', value: (t: typeof rows[number]) => t.responses.length }
    ];
    if (format === 'excel') {
      exportToExcel('tickets', columns, rows);
    } else {
      exportToPdf('Reporte de Tickets', 'tickets', columns, rows);
    }
  }

  createTicket() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const user = this.auth.currentUser()!;
    const company = this.companyService.getById(user.companyId!);
    const attachment = this.selectedAttachment();
    this.ticketService.create({
      companyId: user.companyId!,
      companyName: company?.name || '',
      title: this.form.value.title!,
      description: this.form.value.description!,
      category: this.form.value.category as any,
      priority: this.form.value.priority as any,
      attachments: attachment ? [{ id: 'ta' + Date.now(), ...attachment }] : []
    });
    this.closeModal();
    this.notify.success(`Ticket creado correctamente. Te responderemos antes de ${this.mySlaHours()} horas.`);
  }
}
