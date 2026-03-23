import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { TicketStatus } from '../../core/models';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    @if (ticket()) {
      <div class="ticket-detail">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a routerLink="/tickets">← Tickets</a>
          <span>/</span>
          <span>#{{ ticket()!.id }} {{ ticket()!.title }}</span>
        </div>

        <div class="detail-grid">
          <!-- Left: Ticket info + Thread -->
          <div class="main-col">
            <!-- Ticket Header -->
            <div class="ticket-header-card">
              <div class="ticket-top-row">
                <span class="ticket-id">#{{ ticket()!.id }}</span>
                <span class="status-badge" [class]="ticket()!.status">{{ ticketStatusLabel(ticket()!.status) }}</span>
                <span class="priority-badge" [class]="ticket()!.priority">{{ priorityLabel(ticket()!.priority) }}</span>
                @if (ticketService.isSlaBreached(ticket()!)) {
                  <span class="sla-alert">⚠️ SLA Vencido</span>
                }
              </div>
              <h1>{{ ticket()!.title }}</h1>
              <div class="ticket-description">{{ ticket()!.description }}</div>
              <div class="ticket-info-chips">
                <span>🏢 {{ ticket()!.companyName }}</span>
                <span>🏷️ {{ categoryLabel(ticket()!.category) }}</span>
                <span>📅 Creado: {{ ticket()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                <span>⏰ SLA: {{ ticket()!.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</span>
                @if (!ticketService.isSlaBreached(ticket()!) && ticket()!.status !== 'resolved' && ticket()!.status !== 'closed') {
                  <span class="sla-ok">✅ {{ ticketService.getSlaHoursLeft(ticket()!) }}h restantes</span>
                }
                @if (ticket()!.resolvedAt) {
                  <span>✅ Resuelto: {{ ticket()!.resolvedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                }
              </div>
            </div>

            <!-- Thread -->
            <div class="thread-section">
              <h3>Hilo de conversación</h3>
              <div class="thread">
                @for (r of ticket()!.responses; track r.id) {
                  <div class="response-bubble" [class.owner-response]="r.authorRole === 'owner'">
                    <div class="response-avatar">{{ r.authorName[0] }}</div>
                    <div class="response-content">
                      <div class="response-header">
                        <span class="response-author">{{ r.authorName }}</span>
                        <span class="response-role-badge" [class]="r.authorRole">
                          {{ r.authorRole === 'owner' ? 'Soporte' : 'Cliente' }}
                        </span>
                        <span class="response-date">{{ r.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                      </div>
                      <p class="response-text">{{ r.content }}</p>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-thread">
                    <p>No hay respuestas todavía.</p>
                    @if (auth.isOwner()) { <p>Responde este ticket para actualizar al cliente.</p> }
                    @if (auth.isClient()) { <p>Tu ticket está siendo revisado. Recibirás respuesta en máximo 24h.</p> }
                  </div>
                }
              </div>

              <!-- Reply Form -->
              @if (ticket()!.status !== 'closed') {
                <div class="reply-form">
                  <h4>{{ auth.isOwner() ? 'Responder al cliente' : 'Agregar mensaje' }}</h4>
                  <form [formGroup]="replyForm" (ngSubmit)="sendReply()">
                    <textarea formControlName="content" rows="4" placeholder="Escribe tu respuesta..."></textarea>
                    <button type="submit" class="btn-primary" [disabled]="replyForm.invalid">
                      📤 Enviar respuesta
                    </button>
                  </form>
                </div>
              }
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="side-col">
            <!-- Status Management (owner only) -->
            @if (auth.isOwner()) {
              <div class="side-card">
                <h4>Gestión del ticket</h4>
                <div class="status-actions">
                  @for (action of statusActions(); track action.status) {
                    <button class="status-action-btn" [class]="action.cls"
                      [disabled]="ticket()!.status === action.status"
                      (click)="changeStatus(action.status)">
                      {{ action.icon }} {{ action.label }}
                    </button>
                  }
                </div>
              </div>
            }

            <!-- Ticket Info -->
            <div class="side-card">
              <h4>Información</h4>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">Estado</span>
                  <span class="status-badge sm" [class]="ticket()!.status">{{ ticketStatusLabel(ticket()!.status) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Prioridad</span>
                  <span class="priority-badge sm" [class]="ticket()!.priority">{{ priorityLabel(ticket()!.priority) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Empresa</span>
                  <span class="info-val">{{ ticket()!.companyName }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Categoría</span>
                  <span class="info-val">{{ categoryLabel(ticket()!.category) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Respuestas</span>
                  <span class="info-val">{{ ticket()!.responses.length }}</span>
                </div>
              </div>
            </div>

            <!-- SLA -->
            <div class="side-card" [class.sla-danger]="ticketService.isSlaBreached(ticket()!)">
              <h4>SLA Status</h4>
              @if (ticket()!.status === 'resolved' || ticket()!.status === 'closed') {
                <div class="sla-resolved">✅ Ticket cerrado</div>
              } @else if (ticketService.isSlaBreached(ticket()!)) {
                <div class="sla-breached-info">
                  <span class="sla-icon">🔴</span>
                  <div>
                    <div class="sla-title">SLA Vencido</div>
                    <div class="sla-subtitle">El ticket superó el límite de 24h</div>
                  </div>
                </div>
              } @else {
                <div class="sla-ok-info">
                  <span class="sla-icon">🟢</span>
                  <div>
                    <div class="sla-title">{{ ticketService.getSlaHoursLeft(ticket()!) }}h restantes</div>
                    <div class="sla-subtitle">Vence: {{ ticket()!.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div class="not-found">
        <h2>Ticket no encontrado</h2>
        <a routerLink="/tickets">← Volver a tickets</a>
      </div>
    }
  `,
  styles: [`
    .ticket-detail { max-width: 1000px; }
    .breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 14px; color: #64748b; }
    .breadcrumb a { color: #3b82f6; text-decoration: none; font-weight: 500; }

    .detail-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
    .main-col { display: flex; flex-direction: column; gap: 16px; }
    .side-col { display: flex; flex-direction: column; gap: 14px; }

    .ticket-header-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }
    .ticket-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .ticket-id { background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: monospace; }
    .sla-alert { background: #fee2e2; color: #dc2626; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .ticket-header-card h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }
    .ticket-description { background: #f8fafc; border-radius: 10px; padding: 14px; font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 14px; }
    .ticket-info-chips { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; color: #64748b; }
    .sla-ok { color: #16a34a; font-weight: 600; }

    .thread-section { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }
    .thread-section h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 20px; }
    .thread { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .response-bubble { display: flex; gap: 12px; }
    .response-bubble.owner-response { flex-direction: row-reverse; }
    .response-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1e40af); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .owner-response .response-avatar { background: linear-gradient(135deg, #10b981, #059669); }
    .response-content { max-width: 75%; }
    .response-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .response-author { font-size: 13px; font-weight: 700; color: #0f172a; }
    .response-role-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .response-role-badge.owner { background: #dcfce7; color: #16a34a; }
    .response-role-badge.client { background: #dbeafe; color: #1d4ed8; }
    .response-date { font-size: 11px; color: #94a3b8; }
    .response-text { background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 12px 16px; font-size: 14px; color: #374151; margin: 0; }
    .owner-response .response-text { background: #eff6ff; border-radius: 12px 0 12px 12px; }
    .empty-thread { text-align: center; padding: 24px; color: #94a3b8; font-size: 14px; background: #f8fafc; border-radius: 10px; }
    .reply-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .reply-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .reply-form textarea { width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; margin-bottom: 12px; }
    .reply-form textarea:focus { border-color: #3b82f6; }
    .btn-primary { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Side cards */
    .side-card { background: white; border-radius: 14px; padding: 18px; border: 1px solid #e2e8f0; }
    .side-card.sla-danger { border-color: #fca5a5; background: #fff8f8; }
    .side-card h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
    .status-actions { display: flex; flex-direction: column; gap: 8px; }
    .status-action-btn { width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; }
    .status-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .status-action-btn.review { border-color: #93c5fd; color: #1d4ed8; background: #eff6ff; }
    .status-action-btn.review:hover:not(:disabled) { background: #dbeafe; }
    .status-action-btn.resolved { border-color: #86efac; color: #16a34a; background: #f0fdf4; }
    .status-action-btn.resolved:hover:not(:disabled) { background: #dcfce7; }
    .status-action-btn.escalated { border-color: #fca5a5; color: #dc2626; background: #fef2f2; }
    .status-action-btn.escalated:hover:not(:disabled) { background: #fee2e2; }
    .status-action-btn.closed { border-color: #cbd5e1; color: #64748b; background: #f8fafc; }
    .status-action-btn.closed:hover:not(:disabled) { background: #f1f5f9; }

    .info-list { display: flex; flex-direction: column; gap: 10px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; }
    .info-label { font-size: 12px; color: #94a3b8; font-weight: 500; }
    .info-val { font-size: 13px; color: #374151; font-weight: 500; }

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

    .sla-resolved { color: #16a34a; font-size: 14px; font-weight: 600; text-align: center; padding: 8px; }
    .sla-breached-info, .sla-ok-info { display: flex; align-items: flex-start; gap: 10px; }
    .sla-icon { font-size: 20px; }
    .sla-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .sla-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }

    .not-found { text-align: center; padding: 60px; }

    @media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; } }
  `]
})
export class TicketDetailComponent implements OnInit {
  auth = inject(AuthService);
  ticketService = inject(TicketService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  ticketId = signal('');
  ticket = computed(() => this.ticketService.getById(this.ticketId()));

  replyForm = this.fb.group({ content: ['', Validators.required] });

  ngOnInit() {
    this.ticketId.set(this.route.snapshot.paramMap.get('id') || '');
  }

  statusActions() {
    return [
      { status: 'in_review' as TicketStatus, label: 'Marcar En Revisión', icon: '🔍', cls: 'review' },
      { status: 'resolved' as TicketStatus, label: 'Marcar Resuelto', icon: '✅', cls: 'resolved' },
      { status: 'escalated' as TicketStatus, label: 'Escalar Ticket', icon: '⚠️', cls: 'escalated' },
      { status: 'closed' as TicketStatus, label: 'Cerrar Ticket', icon: '🔒', cls: 'closed' },
    ];
  }

  changeStatus(status: TicketStatus) {
    this.ticketService.updateStatus(this.ticketId(), status);
  }

  sendReply() {
    if (this.replyForm.invalid) return;
    const user = this.auth.currentUser()!;
    this.ticketService.addResponse(this.ticketId(), {
      ticketId: this.ticketId(),
      authorId: user.id,
      authorName: user.role === 'owner' ? 'Soporte Tikets y Proceso' : user.name,
      authorRole: user.role,
      content: this.replyForm.value.content!
    });
    this.replyForm.reset();
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
    const m: any = { bug: '🐛 Bug', feature: '✨ Funcionalidad', support: '❓ Soporte', billing: '💰 Facturación', other: '📌 Otro' };
    return m[c] || c;
  }
}
