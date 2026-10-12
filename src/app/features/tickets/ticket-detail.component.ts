import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { UserService } from '../../core/services/user.service';
import { TicketStatus } from '../../core/models';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { NotificationService } from '../../shared/services/notification.service';
import { fileIcon, formatFileSize, MAX_ATTACHMENT_SIZE } from '../../shared/utils/file.util';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { TicketStatusLabelPipe, PriorityLabelPipe, CategoryLabelPipe } from '../../shared/pipes/labels.pipe';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe, IconComponent, TicketStatusLabelPipe, PriorityLabelPipe, CategoryLabelPipe],
  template: `
    @if (ticket()) {
      <div class="ticket-detail">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a routerLink="/tickets"><app-icon name="chevron-left" [size]="14" /> Tickets</a>
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
                <span class="status-badge" [class]="ticket()!.status">{{ ticket()!.status | ticketStatusLabel }}</span>
                <span class="priority-badge" [class]="ticket()!.priority">{{ ticket()!.priority | priorityLabel }}</span>
                @if (ticketService.isSlaBreached(ticket()!)) {
                  <span class="sla-alert"><app-icon name="alert-triangle" [size]="12" /> SLA Vencido</span>
                }
              </div>
              <h1>{{ ticket()!.title }}</h1>
              <div class="ticket-description">{{ ticket()!.description }}</div>
              <div class="ticket-info-chips">
                <span><app-icon name="building" [size]="13" /> {{ ticket()!.companyName }}</span>
                @if (ticket()!.createdByName) { <span><app-icon name="user" [size]="13" /> {{ ticket()!.createdByName }}</span> }
                <span><app-icon name="tag" [size]="13" /> {{ ticket()!.category | categoryLabel }}</span>
                <span><app-icon name="calendar" [size]="13" /> Creado: {{ ticket()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                <span><app-icon name="clock" [size]="13" /> SLA: {{ ticket()!.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</span>
                @if (!ticketService.isSlaBreached(ticket()!) && ticket()!.status !== 'resolved' && ticket()!.status !== 'closed') {
                  <span class="sla-ok"><app-icon name="check" [size]="13" /> {{ ticketService.getSlaHoursLeft(ticket()!) }}h restantes</span>
                }
                @if (ticket()!.resolvedAt) {
                  <span><app-icon name="check" [size]="13" /> Resuelto: {{ ticket()!.resolvedAt | date:'dd/MM/yyyy HH:mm' }}</span>
                }
              </div>
              @if (ticket()!.attachments?.length) {
                <div class="attachments-row">
                  @for (a of ticket()!.attachments; track a.id) {
                    <a class="attachment-chip" [href]="a.url" target="_blank" rel="noopener">
                      <app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <span class="attachment-size">({{ formatFileSize(a.size) }})</span>
                    </a>
                  }
                </div>
              }
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
                      @if (r.attachments?.length) {
                        <div class="attachments-row">
                          @for (a of r.attachments; track a.id) {
                            <a class="attachment-chip" [href]="a.url" target="_blank" rel="noopener">
                              <app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <span class="attachment-size">({{ formatFileSize(a.size) }})</span>
                            </a>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="empty-thread">
                    <p>No hay respuestas todavía.</p>
                    @if (auth.isStaff()) { <p>Responde este ticket para actualizar al cliente.</p> }
                    @if (auth.isClient()) { <p>Tu ticket está siendo revisado. Recibirás respuesta en máximo {{ ticketService.getSlaTotalHours(ticket()!) }}h.</p> }
                  </div>
                }
              </div>

              <!-- Reply Form -->
              @if (ticket()!.status !== 'closed') {
                <div class="reply-form">
                  <h4>{{ auth.isStaff() ? 'Responder al cliente' : 'Agregar mensaje' }}</h4>
                  <form [formGroup]="replyForm" (ngSubmit)="sendReply()" novalidate>
                    <label for="reply-content" class="sr-only">Respuesta</label>
                    <textarea id="reply-content" formControlName="content" rows="4" placeholder="Escribe tu respuesta..."></textarea>
                    <div class="reply-attachment-row">
                      <label for="reply-attachment" class="attach-label">
                        <app-icon name="paperclip" [size]="14" /> Adjuntar archivo
                      </label>
                      <input id="reply-attachment" type="file" accept="image/*,.pdf" (change)="onReplyAttachmentSelected($event)" class="sr-only">
                      @if (replyAttachment()) {
                        <span class="attachment-chip">
                          <app-icon [name]="fileIcon(replyAttachment()!.name.split('.').pop() || '')" [size]="13" /> {{ replyAttachment()!.name }}
                          <button type="button" (click)="clearReplyAttachment()" aria-label="Quitar adjunto"><app-icon name="x" [size]="12" /></button>
                        </span>
                      }
                    </div>
                    <button type="submit" class="btn-primary" [disabled]="replyForm.invalid || sending()">
                      <app-icon name="send" [size]="15" /> Enviar respuesta
                    </button>
                  </form>
                </div>
              }
            </div>
          </div>

          <!-- Right: Actions -->
          <div class="side-col">
            <!-- Responsable -->
            <div class="side-card">
              <h4>Responsable</h4>
              @if (ticket()!.assignedTo; as a) {
                <div class="assignee">
                  <span class="assignee-av" [class.owner]="a.role === 'owner'">{{ initials(a.name) }}</span>
                  <div class="assignee-info">
                    <strong>{{ a.name }}</strong>
                    <span>{{ a.role === 'owner' ? 'Administrador 3TECH' : 'Técnico 3TECH' }}</span>
                  </div>
                </div>
              } @else {
                <p class="unassigned">{{ auth.isClient() ? 'Pronto un especialista de 3TECH tomará tu ticket.' : 'Nadie lo ha tomado todavía.' }}</p>
              }
              @if (auth.isOwner()) {
                <label class="assign-label" for="ticket-assignee">Asignar a</label>
                <select id="ticket-assignee" class="assign-select" (change)="assign($any($event.target).value || null)">
                  <option value="" [selected]="!ticket()!.assignedTo">Sin asignar</option>
                  @for (m of userService.staff(); track m.id) {
                    <option [value]="m.id" [selected]="ticket()!.assignedTo?.id === m.id">{{ m.name }}{{ m.role === 'owner' ? ' (Administrador)' : '' }}</option>
                  }
                </select>
              } @else if (auth.isTechnician()) {
                @if (!ticket()!.assignedTo) {
                  <button class="btn-take" (click)="assign(auth.currentUser()!.id)"><app-icon name="user" [size]="14" /> Tomar este ticket</button>
                } @else if (ticket()!.assignedTo!.id === auth.currentUser()!.id) {
                  <button class="btn-release" (click)="assign(null)">Soltar ticket</button>
                }
              }
            </div>

            <!-- Status Management (owner only) -->
            @if (auth.isStaff()) {
              <div class="side-card">
                <h4>Gestión del ticket</h4>
                <div class="status-actions">
                  @for (action of statusActions(); track action.status) {
                    <button class="status-action-btn" [class]="action.cls"
                      [disabled]="ticket()!.status === action.status"
                      (click)="changeStatus(action.status)">
                      <app-icon [name]="action.icon" [size]="14" /> {{ action.label }}
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
                  <span class="status-badge sm" [class]="ticket()!.status">{{ ticket()!.status | ticketStatusLabel }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Prioridad</span>
                  <span class="priority-badge sm" [class]="ticket()!.priority">{{ ticket()!.priority | priorityLabel }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Empresa</span>
                  <span class="info-val">{{ ticket()!.companyName }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Creado por</span>
                  <span class="info-val">{{ ticket()!.createdByName || '—' }}</span>
                </div>
                @if (ticket()!.resolvedByName) {
                  <div class="info-row">
                    <span class="info-label">Resuelto por</span>
                    <span class="info-val">{{ ticket()!.resolvedByName }}</span>
                  </div>
                }
                <div class="info-row">
                  <span class="info-label">Categoría</span>
                  <span class="info-val">{{ ticket()!.category | categoryLabel }}</span>
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
                <div class="sla-resolved"><app-icon name="check" [size]="15" /> Ticket cerrado</div>
              } @else if (ticketService.isSlaBreached(ticket()!)) {
                <div class="sla-breached-info">
                  <span class="sla-dot critical"></span>
                  <div>
                    <div class="sla-title">SLA Vencido</div>
                    <div class="sla-subtitle">El ticket superó el límite de {{ ticketService.getSlaTotalHours(ticket()!) }}h</div>
                  </div>
                </div>
              } @else {
                <div class="sla-ok-info">
                  <span class="sla-dot ok"></span>
                  <div>
                    <div class="sla-title">{{ ticketService.getSlaHoursLeft(ticket()!) }}h restantes</div>
                    <div class="sla-subtitle">Vence: {{ ticket()!.slaDeadline | date:'dd/MM/yyyy HH:mm' }}</div>
                  </div>
                </div>
              }
            </div>

            <!-- Satisfacción -->
            @if (ticket()!.status === 'resolved' || ticket()!.status === 'closed') {
              <div class="side-card">
                <h4>Satisfacción</h4>
                @if (ticket()!.satisfactionRating) {
                  <div class="rating-display">
                    <div class="stars">
                      @for (i of [1,2,3,4,5]; track i) {
                        <app-icon name="star" [size]="18" [filled]="i <= ticket()!.satisfactionRating!" class="star" [class.filled]="i <= ticket()!.satisfactionRating!" />
                      }
                    </div>
                    @if (ticket()!.satisfactionComment) {
                      <p class="rating-comment">"{{ ticket()!.satisfactionComment }}"</p>
                    }
                  </div>
                } @else if (auth.isClient()) {
                  <p class="rating-prompt">¿Cómo calificarías el soporte recibido?</p>
                  <div class="stars interactive">
                    @for (i of [1,2,3,4,5]; track i) {
                      <button type="button" (click)="selectedRating.set(i)"
                        (mouseenter)="hoverRating.set(i)" (mouseleave)="hoverRating.set(0)"
                        [attr.aria-label]="i + ' de 5 estrellas'">
                        <app-icon name="star" [size]="22" class="star" [filled]="i <= (hoverRating() || selectedRating())" [class.filled]="i <= (hoverRating() || selectedRating())" />
                      </button>
                    }
                  </div>
                  <textarea [value]="ratingComment()" (input)="ratingComment.set($any($event.target).value)"
                    rows="2" placeholder="Comentario opcional..." class="rating-textarea"></textarea>
                  <button type="button" class="btn-primary rating-submit" [disabled]="selectedRating() === 0" (click)="submitRating()">
                    Enviar calificación
                  </button>
                } @else {
                  <p class="rating-pending">El cliente aún no ha calificado este ticket.</p>
                }
              </div>
            }
          </div>
        </div>
      </div>
    } @else if (loaded()) {
      <div class="not-found">
        <h2>Ticket no encontrado</h2>
        <a routerLink="/tickets"><app-icon name="chevron-left" [size]="14" /> Volver a tickets</a>
      </div>
    }
  `,
  styles: [`
    .ticket-detail { max-width: 1000px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .detail-grid { display: grid; grid-template-columns: 1fr 280px; gap: 20px; }
    .main-col { display: flex; flex-direction: column; gap: 16px; }
    .side-col { display: flex; flex-direction: column; gap: 14px; }

    .ticket-header-card { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }
    .ticket-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .ticket-id { background: #f1f5f9; color: #64748b; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; font-family: monospace; }
    .sla-alert { display: inline-flex; align-items: center; gap: 4px; background: #fee2e2; color: #dc2626; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; }
    .ticket-header-card h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }
    .ticket-description { background: #f8fafc; border-radius: 10px; padding: 14px; font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 14px; }
    .ticket-info-chips { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #64748b; }
    .ticket-info-chips span { display: inline-flex; align-items: center; gap: 5px; }
    .ticket-info-chips app-icon { color: #94a3b8; }
    .sla-ok { color: #16a34a; font-weight: 600; }
    .sla-ok app-icon { color: #16a34a; }

    .thread-section { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }
    .thread-section h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 20px; }
    .thread { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .response-bubble { display: flex; gap: 12px; }
    .response-bubble.owner-response { flex-direction: row-reverse; }
    .response-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--gradient-primary, linear-gradient(135deg, #0f4b92, #1465c5)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .owner-response .response-avatar { background: linear-gradient(135deg, #10b981, #059669); }
    .response-content { max-width: 75%; }
    .response-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .response-author { font-size: 13px; font-weight: 700; color: #0f172a; }
    .response-role-badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .response-role-badge.owner { background: #dcfce7; color: #16a34a; }
    .response-role-badge.client { background: #dbeafe; color: #1d4ed8; }
    .response-date { font-size: 11px; color: #64748b; }
    .response-text { background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 12px 16px; font-size: 14px; color: #374151; margin: 0; }
    .owner-response .response-text { background: #eff6ff; border-radius: 12px 0 12px 12px; }
    .empty-thread { text-align: center; padding: 24px; color: #64748b; font-size: 14px; background: #f8fafc; border-radius: 10px; }
    .reply-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .reply-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .reply-form textarea { width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; margin-bottom: 12px; }
    .reply-form textarea:focus { border-color: var(--color-primary-500, #1465c5); }

    .attachments-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .attachment-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--color-neutral-bg, #f1f5f9); border-radius: 8px; padding: 5px 10px;
      font-size: 12px; color: #475569; text-decoration: none; border: none; cursor: pointer;
    }
    a.attachment-chip:hover { background: var(--color-primary-100, #d1e4fa); color: var(--color-primary-700, #0f4b92); }
    .attachment-size { color: #94a3b8; }
    .attachment-chip button { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; padding: 0; }
    .attachment-chip button:hover { color: #dc2626; }

    .reply-attachment-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .attach-label {
      display: inline-flex; align-items: center; gap: 6px; cursor: pointer;
      font-size: 12.5px; color: var(--color-primary-700, #0f4b92); font-weight: 600;
    }
    .attach-label:hover { text-decoration: underline; }

    /* Side cards */
    .side-card { background: white; border-radius: 14px; padding: 18px; border: 1px solid #e2e8f0; }
    .assignee { display: flex; align-items: center; gap: 10px; }
    .assignee-av { width: 38px; height: 38px; border-radius: 50%; background: #e99d34; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .assignee-av.owner { background: #0f4b92; }
    .assignee-info { display: flex; flex-direction: column; }
    .assignee-info strong { font-size: 14px; color: #0f172a; }
    .assignee-info span { font-size: 12px; color: #64748b; }
    .unassigned { font-size: 13px; color: #64748b; margin: 0; }
    .assign-label { display: block; font-size: 12px; font-weight: 600; color: #64748b; margin: 12px 0 5px; }
    .assign-select { width: 100%; padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 13.5px; font-family: inherit; background: #fff; }
    .btn-take, .btn-release { margin-top: 12px; width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 10px; padding: 9px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-take { background: linear-gradient(135deg, #0f4b92, #1465c5); color: #fff; }
    .btn-release { background: #f1f5f9; color: #475569; }
    .side-card.sla-danger { border-color: #fca5a5; background: #fff8f8; }
    .side-card h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
    .status-actions { display: flex; flex-direction: column; gap: 8px; }
    .status-action-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 14px; border-radius: 8px; border: 1.5px solid; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; }
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
    .info-label { font-size: 12px; color: #64748b; font-weight: 500; }
    .info-val { font-size: 13px; color: #374151; font-weight: 500; }

    .sla-resolved { display: flex; align-items: center; justify-content: center; gap: 6px; color: #16a34a; font-size: 14px; font-weight: 600; text-align: center; padding: 8px; }
    .sla-breached-info, .sla-ok-info { display: flex; align-items: flex-start; gap: 10px; }
    .sla-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 3px; flex-shrink: 0; }
    .sla-dot.critical { background: #ef4444; }
    .sla-dot.ok { background: #10b981; }
    .sla-title { font-size: 14px; font-weight: 700; color: #0f172a; }
    .sla-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }

    .rating-prompt { font-size: 13px; color: #475569; margin: 0 0 10px; }
    .stars { display: flex; gap: 3px; margin-bottom: 10px; }
    .stars.interactive button { background: none; border: none; cursor: pointer; padding: 2px; display: flex; color: #cbd5e1; transition: color 0.1s; }
    .star { color: #cbd5e1; }
    .star.filled { color: #f59e0b; }
    .rating-textarea {
      width: 100%; padding: 10px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 13px; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; margin-bottom: 10px;
    }
    .rating-textarea:focus { border-color: var(--color-primary-500, #1465c5); }
    .rating-submit { width: 100%; }
    .rating-comment { font-size: 13px; color: #475569; font-style: italic; margin: 8px 0 0; padding: 10px; background: #f8fafc; border-radius: 8px; }
    .rating-pending { font-size: 13px; color: #94a3b8; margin: 0; }

    @media (max-width: 768px) {
      .detail-grid { grid-template-columns: 1fr; }
      .response-content { max-width: 85%; }
    }
  `]
})
export class TicketDetailComponent implements OnInit {
  auth = inject(AuthService);
  ticketService = inject(TicketService);
  userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  ticketId = signal('');
  ticket = computed(() => this.ticketService.getById(this.ticketId()));
  replyAttachment = signal<File | null>(null);
  selectedRating = signal(0);
  hoverRating = signal(0);
  ratingComment = signal('');
  loaded = signal(false);
  sending = signal(false);

  fileIcon = fileIcon;
  formatFileSize = formatFileSize;

  replyForm = this.fb.group({ content: ['', Validators.required] });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.ticketId.set(id);
    const loads: Promise<unknown>[] = [this.ticketService.loadDetail(id)];
    if (this.auth.isOwner()) loads.push(this.userService.loadStaff());
    loadPageData(this.notify, ...loads).finally(() => this.loaded.set(true));
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  assign(userId: string | null) {
    const me = this.auth.currentUser()?.id;
    const msg = userId === null ? 'El ticket quedó sin asignar.'
      : userId === me ? 'Tomaste el ticket.'
      : `Ticket asignado a ${this.userService.staff().find(m => m.id === userId)?.name ?? 'otro integrante'}. Se le notificó.`;
    this.run(this.ticketService.assign(this.ticketId(), userId), msg);
  }

  private async run(action: Promise<unknown>, successMessage: string): Promise<boolean> {
    try {
      await action;
      this.notify.success(successMessage);
      return true;
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
      return false;
    }
  }

  submitRating() {
    if (this.selectedRating() === 0) return;
    this.run(
      this.ticketService.rateSatisfaction(this.ticketId(), this.selectedRating(), this.ratingComment().trim() || undefined),
      '¡Gracias por tu calificación!',
    );
  }

  statusActions(): { status: TicketStatus; label: string; icon: IconName; cls: string }[] {
    return [
      { status: 'in_review', label: 'Marcar En Revisión', icon: 'search', cls: 'review' },
      { status: 'resolved', label: 'Marcar Resuelto', icon: 'check', cls: 'resolved' },
      { status: 'escalated', label: 'Escalar Ticket', icon: 'alert-triangle', cls: 'escalated' },
      { status: 'closed', label: 'Cerrar Ticket', icon: 'lock', cls: 'closed' },
    ];
  }

  changeStatus(status: TicketStatus) {
    this.run(this.ticketService.updateStatus(this.ticketId(), status), 'Estado del ticket actualizado.');
  }

  onReplyAttachmentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      this.notify.error(`El archivo es muy pesado (máximo ${formatFileSize(MAX_ATTACHMENT_SIZE)}).`);
      return;
    }
    this.replyAttachment.set(file);
  }

  clearReplyAttachment() {
    this.replyAttachment.set(null);
  }

  async sendReply() {
    if (this.replyForm.invalid) { this.replyForm.markAllAsTouched(); return; }
    this.sending.set(true);
    const ok = await this.run(
      this.ticketService.addResponse(this.ticketId(), this.replyForm.value.content!, this.replyAttachment() ?? undefined),
      'Respuesta enviada.',
    );
    this.sending.set(false);
    if (ok) {
      this.replyForm.reset();
      this.replyAttachment.set(null);
    }
  }
}
