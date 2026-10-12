import { Component, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { CompanyService } from '../../core/services/company.service';
import { UserService } from '../../core/services/user.service';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { Ticket, TicketPriority, TicketStatus } from '../../core/models';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { fileIcon, formatFileSize, MAX_ATTACHMENT_SIZE } from '../../shared/utils/file.util';
import { exportToExcel, exportToPdf } from '../../shared/utils/export.util';
import { TicketStatusLabelPipe, PriorityLabelPipe, TICKET_STATUS_LABELS, CATEGORY_LABELS, PRIORITY_LABELS } from '../../shared/pipes/labels.pipe';
import { ExportMenuComponent, ExportFormat } from '../../shared/export-menu/export-menu.component';

type View = 'company' | 'board' | 'list';
type Bucket = 'attention' | 'progress' | 'closed' | 'all';
type Tone = { tone: string; label: string };

const VIEW_KEY = 'pmpro_tickets_view';
const STATUSES: TicketStatus[] = ['open', 'in_review', 'escalated', 'resolved', 'closed'];
const PRIORITY_RANK: Record<TicketPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SLA_HOURS: Record<string, number> = { Premium: 4, Standard: 12, Basic: 24 };
const BOARD_LIMIT = 15;
const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';

/** Duración legible: "12 min", "3 h", "2 d". */
function span(ms: number): string {
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent, ModalFocusTrapDirective, TicketStatusLabelPipe, PriorityLabelPipe, ExportMenuComponent],
  template: `
    <div class="tickets-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isStaff() ? 'Centro de Tickets' : 'Mis Tickets de Soporte' }}</h1>
          <p>{{ auth.isStaff() ? 'Solicitudes de soporte agrupadas por empresa, de lo más urgente a lo resuelto' : 'Reporta problemas y solicitudes. SLA de respuesta: ' + mySlaHours() + ' horas.' }}</p>
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

      <!-- Barra: pestañas de urgencia + vista -->
      @if (auth.isStaff()) {
        <div class="top-bar">
          @if (view() !== 'board') {
            <div class="bucket-tabs" role="tablist">
              @for (b of buckets; track b.value) {
                <button role="tab" [class]="'bt-' + b.value" [class.active]="bucket() === b.value" [attr.aria-selected]="bucket() === b.value" (click)="bucket.set(b.value)">
                  {{ b.label }} <span class="count">{{ bucketCount(b.value) }}</span>
                </button>
              }
            </div>
          } @else {
            <p class="board-hint"><app-icon name="ticket" [size]="15" /> Arrastra una tarjeta a otra columna para cambiar su estado.</p>
          }
          <span class="spacer"></span>
          @if (breachedCount()) {
            <span class="breach-chip"><app-icon name="alert-triangle" [size]="13" /> {{ breachedCount() }} con SLA vencido</span>
          }
          <div class="view-toggle" role="group" aria-label="Vista">
            <button [class.active]="view() === 'company'" (click)="setView('company')"><app-icon name="building" [size]="14" /> Por empresa</button>
            <button [class.active]="view() === 'board'" (click)="setView('board')"><app-icon name="chart" [size]="14" /> Tablero</button>
            <button [class.active]="view() === 'list'" (click)="setView('list')"><app-icon name="menu" [size]="14" /> Lista</button>
          </div>
        </div>
      }

      <!-- Filtros -->
      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="ticket-search" class="sr-only">Buscar ticket</label>
          <input id="ticket-search" type="text" placeholder="Buscar por título, número o persona..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        @if (auth.isStaff()) {
          <label for="ticket-company-filter" class="sr-only">Filtrar por empresa</label>
          <select id="ticket-company-filter" class="filter-select" (change)="companyFilter.set($any($event.target).value)">
            <option value="">Todas las empresas</option>
            @for (c of companiesWithTickets(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
          </select>
        }
        @if (auth.isStaff()) {
          <label for="ticket-assignee-filter" class="sr-only">Filtrar por responsable</label>
          <select id="ticket-assignee-filter" class="filter-select" (change)="assigneeFilter.set($any($event.target).value)">
            <option value="" [selected]="assigneeFilter() === ''">Todos los responsables</option>
            <option value="me" [selected]="assigneeFilter() === 'me'">Asignados a mí</option>
            <option value="none" [selected]="assigneeFilter() === 'none'">Sin asignar</option>
            @for (m of otherStaff(); track m.id) {
              <option [value]="m.id" [selected]="assigneeFilter() === m.id">{{ m.name }}</option>
            }
          </select>
        }
        <label for="ticket-priority-filter" class="sr-only">Filtrar por prioridad</label>
        <select id="ticket-priority-filter" class="filter-select" (change)="priorityFilter.set($any($event.target).value)">
          <option value="">Todas las prioridades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </div>

      <!-- Fila de ticket reutilizable -->
      <ng-template #ticketRow let-t>
        <a [routerLink]="['/tickets', t.id]" class="t-row" [class.breached]="ticketService.isSlaBreached(t)">
          <span class="prio-bar" [class]="t.priority" [title]="'Prioridad ' + (t.priority | priorityLabel)"></span>
          <div class="t-main">
            <div class="t-line1">
              <span class="t-id">#{{ t.id }}</span>
              <span class="t-title">{{ t.title }}</span>
            </div>
            <div class="t-line2">
              <span class="who"><app-icon name="user" [size]="12" /> {{ t.createdByName || 'Usuario de la empresa' }}</span>
              <span>· hace {{ ago(t.createdAt) }}</span>
              <span class="turn" [class]="turn(t).tone">{{ turn(t).label }}</span>
            </div>
          </div>
          <div class="t-side">
            @if (t.assignedTo; as a) {
              <span class="assignee-chip" [class.mine]="a.id === auth.currentUser()?.id" [title]="'Responsable: ' + a.name">
                <span class="av" [class.owner]="a.role === 'owner'">{{ initials(a.name) }}</span>{{ a.id === auth.currentUser()?.id ? 'Tú' : a.name }}
              </span>
            } @else {
              <span class="assignee-chip none">Sin asignar</span>
            }
            <span class="status-badge" [class]="t.status">{{ t.status | ticketStatusLabel }}</span>
            <span class="sla" [class]="sla(t).tone"><app-icon name="clock" [size]="12" /> {{ sla(t).label }}</span>
            <span class="resp" [title]="t.responseCount + ' respuesta(s)'"><app-icon name="message-circle" [size]="13" /> {{ t.responseCount }}</span>
          </div>
        </a>
      </ng-template>

      @if (auth.isStaff()) {
        @switch (view()) {
          <!-- Vista por empresa -->
          @case ('company') {
            <div class="groups">
              @for (g of companyGroups(); track g.companyId) {
                <section class="group" [class.has-breach]="g.breached > 0">
                  <button class="group-head" (click)="toggleGroup(g.companyId)" [attr.aria-expanded]="!collapsed().has(g.companyId)">
                    <span class="logo">
                      @if (g.logo) { <img [src]="g.logo" alt=""> } @else { {{ g.name[0] }} }
                    </span>
                    <span class="g-info">
                      <span class="g-name">{{ g.name }}</span>
                      <span class="g-plan">Tiempo de respuesta: {{ g.slaHours }} h</span>
                    </span>
                    <span class="g-counters">
                      @if (g.breached) { <span class="gc red">{{ g.breached }} vencido{{ g.breached > 1 ? 's' : '' }}</span> }
                      <span class="gc">{{ g.tickets.length }} ticket{{ g.tickets.length > 1 ? 's' : '' }}</span>
                    </span>
                    <span class="caret">{{ collapsed().has(g.companyId) ? '▸' : '▾' }}</span>
                  </button>
                  @if (!collapsed().has(g.companyId)) {
                    <div class="group-body">
                      @for (t of g.tickets; track t.id) {
                        <ng-container *ngTemplateOutlet="ticketRow; context: { $implicit: t }" />
                      }
                    </div>
                  }
                </section>
              } @empty {
                <div class="empty-state">
                  <div class="empty-icon"><app-icon name="check" [size]="30" /></div>
                  <h3>{{ bucket() === 'attention' ? '¡Nada pendiente!' : 'Sin tickets' }}</h3>
                  <p>{{ bucket() === 'attention' ? 'No hay tickets que requieran atención ahora mismo.' : 'No hay tickets que coincidan con los filtros.' }}</p>
                </div>
              }
            </div>
          }

          <!-- Tablero kanban -->
          @case ('board') {
            <div class="board">
              @for (col of boardColumns(); track col.status) {
                <div class="column" [class.drop-target]="dragOverCol() === col.status"
                  (dragover)="onDragOver($event, col.status)" (dragleave)="dragOverCol.set(null)" (drop)="onDrop($event, col.status)">
                  <div class="col-head" [class]="col.status">
                    <span>{{ col.status | ticketStatusLabel }}</span><span class="count">{{ col.tickets.length }}</span>
                  </div>
                  <div class="col-body">
                    @for (t of col.shown; track t.id) {
                      <a class="card" [routerLink]="['/tickets', t.id]" draggable="true" [class.dragging]="draggedId() === t.id"
                        [class.breached]="ticketService.isSlaBreached(t)"
                        (dragstart)="onDragStart($event, t.id)" (dragend)="draggedId.set(null); dragOverCol.set(null)">
                        <div class="card-top">
                          <span class="card-company"><span class="mini-logo">{{ t.companyName[0] }}</span>{{ t.companyName }}</span>
                          <span class="prio-dot" [class]="t.priority" [title]="'Prioridad ' + (t.priority | priorityLabel)"></span>
                        </div>
                        <span class="card-title">{{ t.title }}</span>
                        <span class="card-who"><app-icon name="user" [size]="11" /> {{ t.createdByName || 'Usuario de la empresa' }}</span>
                        <div class="card-foot">
                          @if (t.assignedTo; as a) {
                            <span class="av sm" [class.owner]="a.role === 'owner'" [title]="'Responsable: ' + a.name">{{ initials(a.name) }}</span>
                          } @else {
                            <span class="av sm none" title="Sin asignar">?</span>
                          }
                          <span class="t-id">#{{ t.id }}</span>
                          <span class="resp"><app-icon name="message-circle" [size]="12" /> {{ t.responseCount }}</span>
                          <span class="sla" [class]="sla(t).tone"><app-icon name="clock" [size]="11" /> {{ sla(t).label }}</span>
                        </div>
                      </a>
                    } @empty {
                      <p class="col-empty">Sin tickets</p>
                    }
                    @if (col.tickets.length > col.shown.length) {
                      <p class="col-more">+{{ col.tickets.length - col.shown.length }} más (usa la vista Lista)</p>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Lista / tabla -->
          @case ('list') {
            <div class="table-wrap">
              <table class="t-table">
                <thead>
                  <tr><th>#</th><th>Ticket</th><th>Empresa</th><th>Creado por</th><th>Responsable</th><th>Prioridad</th><th>Estado</th><th>SLA</th><th></th></tr>
                </thead>
                <tbody>
                  @for (t of bucketTickets(); track t.id) {
                    <tr (click)="open(t.id)" [class.breached]="ticketService.isSlaBreached(t)">
                      <td class="t-id">#{{ t.id }}</td>
                      <td class="cell-title">{{ t.title }}</td>
                      <td>{{ t.companyName }}</td>
                      <td class="muted">{{ t.createdByName || '—' }}</td>
                      <td (click)="$event.stopPropagation()">
                        @if (auth.isOwner()) {
                          <select class="status-select" [attr.aria-label]="'Responsable del ticket ' + t.id" (change)="assign(t, $any($event.target).value || null, $any($event.target))">
                            <option value="" [selected]="!t.assignedTo">Sin asignar</option>
                            @for (m of userService.staff(); track m.id) {
                              <option [value]="m.id" [selected]="t.assignedTo?.id === m.id">{{ m.name }}</option>
                            }
                          </select>
                        } @else if (!t.assignedTo) {
                          <button class="btn-take" (click)="assign(t, auth.currentUser()!.id)">Tomar</button>
                        } @else {
                          <span [class.mine-text]="t.assignedTo.id === auth.currentUser()?.id">{{ t.assignedTo.id === auth.currentUser()?.id ? 'Tú' : t.assignedTo.name }}</span>
                        }
                      </td>
                      <td><span class="prio-pill" [class]="t.priority">{{ t.priority | priorityLabel }}</span></td>
                      <td (click)="$event.stopPropagation()">
                        <select class="status-select" [attr.aria-label]="'Estado del ticket ' + t.id"
                          (change)="changeStatus(t, $any($event.target).value, $any($event.target))">
                          @for (st of statuses; track st) { <option [value]="st" [selected]="t.status === st">{{ st | ticketStatusLabel }}</option> }
                        </select>
                      </td>
                      <td><span class="sla" [class]="sla(t).tone">{{ sla(t).label }}</span></td>
                      <td class="resp"><app-icon name="message-circle" [size]="13" /> {{ t.responseCount }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="9" class="table-empty">No hay tickets que coincidan.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      } @else {
        <!-- Vista del cliente: agrupado según de quién es el turno -->
        <div class="client-sections">
          @for (sec of clientSections(); track sec.key) {
            @if (sec.tickets.length) {
              <section class="c-section">
                <h2 [class]="sec.key">
                  <app-icon [name]="sec.icon" [size]="16" /> {{ sec.title }} <span class="count">{{ sec.tickets.length }}</span>
                </h2>
                <p class="c-hint">{{ sec.hint }}</p>
                <div class="group-body boxed">
                  @for (t of sec.tickets; track t.id) {
                    <ng-container *ngTemplateOutlet="ticketRow; context: { $implicit: t }" />
                  }
                </div>
              </section>
            }
          }
          @if (!scopedTickets().length) {
            <div class="empty-state">
              <div class="empty-icon"><app-icon name="ticket" [size]="32" /></div>
              <h3>Sin tickets</h3>
              <p>No tienes tickets que coincidan. Si algo falla, crea uno con "Nuevo Ticket".</p>
            </div>
          }
        </div>
      }
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
              <span>Tiempo de respuesta garantizado: <strong>{{ mySlaHours() }} horas</strong> desde la creación.</span>
            </div>
            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">Enviar Ticket</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .tickets-page { max-width: var(--page-max-width); margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .top-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .spacer { flex: 1; }
    .bucket-tabs { display: inline-flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; flex-wrap: wrap; }
    .bucket-tabs button { border: none; background: none; padding: 8px 14px; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
    .bucket-tabs button .count { background: #f1f5f9; color: #475569; border-radius: 999px; padding: 1px 8px; font-size: 12px; }
    .bucket-tabs button.active { background: #0f4b92; color: #fff; }
    .bucket-tabs button.active .count { background: rgba(255,255,255,0.22); color: #fff; }
    .bucket-tabs button.bt-attention:not(.active) .count { background: #fee2e2; color: #dc2626; }
    .board-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; margin: 0; }
    .breach-chip { display: inline-flex; align-items: center; gap: 5px; background: #fee2e2; color: #dc2626; font-size: 12.5px; font-weight: 700; padding: 6px 11px; border-radius: 999px; }
    .view-toggle { display: inline-flex; background: #f1f5f9; border-radius: 11px; padding: 3px; }
    .view-toggle button { border: none; background: none; padding: 7px 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .view-toggle button.active { background: #fff; color: #0f4b92; box-shadow: 0 1px 3px rgba(15,23,42,0.1); }

    /* Prioridad como variable de color */
    .low { --prio: #10b981; }
    .medium { --prio: #f59e0b; }
    .high { --prio: #f97316; }
    .critical { --prio: #ef4444; }

    /* Fila de ticket */
    .t-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px 11px 0; text-decoration: none; color: inherit; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; }
    .t-row:last-child { border-bottom: none; }
    .t-row:hover { background: #f8fafc; }
    .t-row.breached { background: #fff8f8; }
    .prio-bar { width: 4px; align-self: stretch; border-radius: 0 4px 4px 0; flex-shrink: 0; background: var(--prio); }
    .t-main { flex: 1; min-width: 0; }
    .t-line1 { display: flex; align-items: center; gap: 8px; }
    .t-id { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; color: #94a3b8; font-weight: 700; flex-shrink: 0; }
    .t-title { font-size: 14.5px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .t-line2 { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #64748b; margin-top: 3px; flex-wrap: wrap; }
    .who { display: inline-flex; align-items: center; gap: 4px; color: #334155; font-weight: 600; }
    .turn { font-size: 11.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; margin-left: 4px; }
    .turn.us { background: #fdf3e6; color: #c47a14; }
    .turn.them { background: #eef4fc; color: #0f4b92; }
    .turn.done { background: #f2f7e1; color: #6b7d1c; }
    .t-side { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .sla { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; color: #64748b; }
    .sla.late { color: #dc2626; }
    .sla.soon { color: #c47a14; }
    .sla.ok { color: #16a34a; }
    .resp { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: #94a3b8; }
    .assignee-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 2px 9px 2px 2px; border-radius: 999px; white-space: nowrap; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    .assignee-chip.mine { background: #fdf3e6; border-color: #f5d3a3; color: #9a5d0c; }
    .assignee-chip.none { padding: 3px 10px; border-style: dashed; color: #94a3b8; font-weight: 500; }
    .av { width: 22px; height: 22px; border-radius: 50%; background: #e99d34; color: #fff; font-size: 10px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .av.owner { background: #0f4b92; }
    .av.sm { width: 20px; height: 20px; font-size: 9.5px; }
    .av.none { background: #e2e8f0; color: #94a3b8; }
    .btn-take { border: none; background: #eef4fc; color: #0f4b92; font-weight: 700; font-size: 12px; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
    .mine-text { font-weight: 700; color: #9a5d0c; }

    /* Grupos por empresa */
    .groups { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
    @media (min-width: 1500px) { .groups { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .group { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
    .group.has-breach { border-color: #fca5a5; }
    .group-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fbfcfe; border: none; border-bottom: 1px solid #eef2f7; cursor: pointer; text-align: left; font-family: inherit; }
    .logo { width: 36px; height: 36px; border-radius: 10px; background: #0f4b92; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; overflow: hidden; flex-shrink: 0; }
    .logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
    .g-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .g-name { font-size: 15px; font-weight: 800; color: #0f172a; }
    .g-plan { font-size: 12px; color: #64748b; }
    .g-counters { display: flex; gap: 6px; }
    .gc { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; }
    .gc.red { background: #fee2e2; color: #dc2626; }
    .caret { color: #94a3b8; font-size: 12px; width: 12px; }
    .group-body.boxed { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }

    /* Tablero */
    .board { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 6px; }
    .column { background: #f1f5f9; border-radius: 14px; padding: 10px; min-height: 320px; border: 2px dashed transparent; transition: border-color 0.15s, background 0.15s; }
    .column.drop-target { border-color: #1465c5; background: #e8f1fd; }
    .col-head { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 800; color: #334155; padding: 4px 6px 10px; border-bottom: 3px solid #cbd5e1; margin-bottom: 10px; }
    .col-head.open { border-color: #f59e0b; }
    .col-head.in_review { border-color: #1465c5; }
    .col-head.escalated { border-color: #ef4444; }
    .col-head.resolved { border-color: #a9c238; }
    .col-head.closed { border-color: #94a3b8; }
    .col-head .count { background: #fff; border-radius: 999px; padding: 1px 8px; font-size: 12px; }
    .col-body { display: flex; flex-direction: column; gap: 8px; }
    .card { background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 1px 2px rgba(15,23,42,0.06); text-decoration: none; color: inherit; cursor: grab; border: 1px solid transparent; display: flex; flex-direction: column; gap: 6px; }
    .card:hover { border-color: #c7d7ee; }
    .card.breached { border-color: #fca5a5; background: #fffafa; }
    .card.dragging { opacity: 0.4; }
    .card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .card-company { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #0f4b92; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .mini-logo { width: 18px; height: 18px; border-radius: 5px; background: #0f4b92; color: #fff; font-size: 10px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .prio-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: var(--prio); }
    .card-title { font-size: 13.5px; font-weight: 700; color: #0f172a; line-height: 1.35; }
    .card-who { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: #64748b; }
    .card-foot { display: flex; align-items: center; gap: 8px; }
    .card-foot .sla { margin-left: auto; font-size: 11px; }
    .col-empty, .col-more { font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0; }

    /* Tabla */
    .table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow-x: auto; }
    .t-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .t-table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #64748b; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .t-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
    .t-table tbody tr { cursor: pointer; }
    .t-table tbody tr:hover { background: #f8fafc; }
    .t-table tr.breached { background: #fff8f8; }
    .t-table .cell-title { font-weight: 700; color: #0f172a; white-space: normal; min-width: 220px; }
    .muted { color: #64748b; }
    .prio-pill { font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; color: var(--prio); background: color-mix(in srgb, var(--prio) 14%, white); }
    .status-select { padding: 4px 6px; font-size: 12.5px; font-weight: 600; font-family: inherit; }
    .t-table .table-empty { text-align: center; color: #64748b; padding: 24px; }

    /* Cliente */
    .client-sections { display: flex; flex-direction: column; gap: 22px; }
    .c-section h2 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; margin: 0; color: #0f172a; }
    .c-section h2 .count { background: #f1f5f9; border-radius: 999px; padding: 1px 9px; font-size: 12px; color: #475569; }
    .c-section h2.answered app-icon { color: #e99d34; }
    .c-section h2.waiting app-icon { color: #1465c5; }
    .c-section h2.done app-icon { color: #a9c238; }
    .c-hint { font-size: 13px; color: #64748b; margin: 2px 0 10px; }

    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; font-family: inherit; resize: vertical; }
    .form-group select { width: 100%; padding: 10px 12px; font-size: 14px; box-sizing: border-box; font-family: inherit; }
    .form-group input:focus, .form-group textarea:focus { border-color: var(--color-primary-500, #1465c5); }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sla-info { display: flex; gap: 8px; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #1d4ed8; margin-top: 4px; }

    .attachment-chip {
      display: inline-flex; align-items: center; gap: 6px; margin-top: 8px;
      background: var(--color-neutral-bg, #f1f5f9); border-radius: 8px; padding: 6px 10px;
      font-size: 12.5px; color: #475569;
    }
    .attachment-chip button { background: none; border: none; cursor: pointer; color: #94a3b8; display: flex; margin-left: 4px; }
    .attachment-chip button:hover { color: #dc2626; }

    @media (max-width: 760px) {
      .t-row { flex-wrap: wrap; }
      .t-side { width: 100%; padding-left: 16px; flex-wrap: wrap; row-gap: 6px; }
      .g-counters .gc:not(.red) { display: none; }
      .view-toggle button { padding: 7px 9px; font-size: 12px; }
    }
    @media (max-width: 640px) {
      .form-grid-2 { grid-template-columns: 1fr; }
    }
  `]
})
export class TicketsComponent {
  auth = inject(AuthService);
  ticketService = inject(TicketService);
  private companyService = inject(CompanyService);
  userService = inject(UserService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  readonly buckets: { value: Bucket; label: string }[] = [
    { value: 'attention', label: 'Requieren atención' },
    { value: 'progress', label: 'En curso' },
    { value: 'closed', label: 'Cerrados' },
    { value: 'all', label: 'Todos' },
  ];
  readonly statuses = STATUSES;

  search = signal('');
  priorityFilter = signal('');
  companyFilter = signal('');
  /** '' todos, 'me' asignados a mí, 'none' sin asignar, o el id de alguien del equipo. El técnico arranca en los suyos. */
  assigneeFilter = signal(this.auth.isTechnician() ? 'me' : '');
  view = signal<View>(this.savedView());
  bucket = signal<Bucket>('attention');
  collapsed = signal(new Set<string>());
  draggedId = signal<string | null>(null);
  dragOverCol = signal<TicketStatus | null>(null);
  showModal = signal(false);
  saving = signal(false);
  selectedAttachment = signal<File | null>(null);
  /** Reloj para que las cuentas regresivas del SLA se actualicen solas. */
  now = signal(Date.now());

  constructor() {
    loadPageData(this.notify, this.ticketService.load(), this.companyService.load(),
      ...(this.auth.isStaff() ? [this.userService.loadStaff()] : []));
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

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
  mySlaHours = computed(() => {
    const user = this.auth.currentUser();
    return user?.companyId ? this.ticketService.getSlaHoursForCompany(user.companyId) : 24;
  });

  // ── Datos ──

  /** Tickets del usuario con búsqueda y filtros aplicados (sin la pestaña de urgencia). */
  scopedTickets = computed(() => {
    const user = this.auth.currentUser();
    let list = user?.role === 'client' ? this.ticketService.getByCompany(user.companyId!) : this.ticketService.getAll();
    const s = this.search().trim().toLowerCase().replace(/^#/, '');
    const pf = this.priorityFilter();
    const cf = this.companyFilter();
    if (s) list = list.filter(t => [t.title, t.description, t.id, t.createdByName ?? '', t.companyName].some(v => v.toLowerCase().includes(s)));
    if (pf) list = list.filter(t => t.priority === pf);
    if (cf) list = list.filter(t => t.companyId === cf);
    const af = this.assigneeFilter();
    const me = user?.id;
    if (af === 'me') list = list.filter(t => t.assignedTo?.id === me);
    else if (af === 'none') list = list.filter(t => !t.assignedTo);
    else if (af) list = list.filter(t => t.assignedTo?.id === af);
    return this.sortByUrgency(list);
  });

  /** Integrantes para el filtro (sin uno mismo: para eso está "Asignados a mí"). */
  otherStaff = computed(() => this.userService.staff().filter(m => m.id !== this.auth.currentUser()?.id));

  // Se lee now() para que los vencimientos se actualicen solos cada minuto.
  breachedCount = computed(() => { this.now(); return this.scopedTickets().filter(t => this.ticketService.isSlaBreached(t)).length; });

  bucketTickets = computed(() => { this.now(); return this.scopedTickets().filter(t => this.inBucket(t, this.bucket())); });

  companiesWithTickets = computed(() => {
    const ids = new Set(this.ticketService.getAll().map(t => t.companyId));
    return this.companyService.getAll().filter(c => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  });

  companyGroups = computed(() => {
    const groups = new Map<string, Ticket[]>();
    for (const t of this.bucketTickets()) groups.set(t.companyId, [...(groups.get(t.companyId) ?? []), t]);
    return [...groups.entries()]
      .map(([companyId, tickets]) => {
        const company = this.companyService.getById(companyId);
        const plan = company?.plan ?? 'Standard';
        return {
          companyId, tickets,
          name: company?.name ?? tickets[0].companyName,
          logo: company?.logo,
          plan, slaHours: SLA_HOURS[plan] ?? 12,
          breached: tickets.filter(t => this.ticketService.isSlaBreached(t)).length,
          urgent: Math.min(...tickets.map(t => PRIORITY_RANK[t.priority])),
        };
      })
      .sort((a, b) => b.breached - a.breached || a.urgent - b.urgent || b.tickets.length - a.tickets.length || a.name.localeCompare(b.name));
  });

  boardColumns = computed(() => STATUSES.map(status => {
    const tickets = this.scopedTickets().filter(t => t.status === status);
    // En las columnas cerradas, lo más reciente primero; en las abiertas, lo más urgente.
    const ordered = isClosed({ status } as Ticket) ? tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : tickets;
    return { status, tickets, shown: ordered.slice(0, BOARD_LIMIT) };
  }));

  clientSections = computed(() => {
    const list = this.scopedTickets();
    const sections: { key: string; title: string; hint: string; icon: IconName; tickets: Ticket[] }[] = [
      { key: 'answered', title: 'Te respondimos, revisa', hint: 'El equipo de 3TECH ya contestó; revisa la respuesta o confírmanos si quedó resuelto.', icon: 'message-circle',
        tickets: list.filter(t => !isClosed(t) && t.lastResponse?.authorRole === 'owner') },
      { key: 'waiting', title: 'Esperando respuesta de 3TECH', hint: 'Estamos trabajando en ellos dentro de tu tiempo de respuesta garantizado.', icon: 'clock',
        tickets: list.filter(t => !isClosed(t) && t.lastResponse?.authorRole !== 'owner') },
      { key: 'done', title: 'Resueltos', hint: 'Si aún no lo hiciste, califica la atención que recibiste.', icon: 'check',
        tickets: list.filter(isClosed).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) },
    ];
    return sections;
  });

  bucketCount(b: Bucket): number {
    return this.scopedTickets().filter(t => this.inBucket(t, b)).length;
  }

  /**
   * Requieren atención: nuevos, escalados, con SLA vencido o donde el cliente
   * escribió de último (nos toca responder). En curso: el resto de los abiertos.
   */
  private inBucket(t: Ticket, b: Bucket): boolean {
    if (b === 'all') return true;
    if (b === 'closed') return isClosed(t);
    if (isClosed(t)) return false;
    const needsUs = t.status === 'open' || t.status === 'escalated' || this.ticketService.isSlaBreached(t) || t.lastResponse?.authorRole === 'client';
    return b === 'attention' ? needsUs : !needsUs;
  }

  private sortByUrgency(list: Ticket[]): Ticket[] {
    return list.slice().sort((a, b) =>
      Number(isClosed(a)) - Number(isClosed(b)) ||
      Number(this.ticketService.isSlaBreached(b)) - Number(this.ticketService.isSlaBreached(a)) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.slaDeadline.localeCompare(b.slaDeadline));
  }

  // ── Presentación ──

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  ago(iso: string): string {
    return span(this.now() - new Date(iso).getTime());
  }

  /** SLA de primera respuesta: cuenta regresiva hasta que el equipo responde; luego, el resultado. */
  sla(t: Ticket): Tone {
    if (t.firstResponseAt) {
      const took = new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime();
      return this.ticketService.slaMet(t)
        ? { tone: 'ok', label: `Respondido en ${span(took)}` }
        : { tone: 'soon', label: `Respondido tarde (${span(took)})` };
    }
    if (isClosed(t)) return { tone: 'ok', label: 'Resuelto' };
    const left = new Date(t.slaDeadline).getTime() - this.now();
    if (left < 0) return { tone: 'late', label: `Sin respuesta · vencido hace ${span(left)}` };
    const total = new Date(t.slaDeadline).getTime() - new Date(t.createdAt).getTime();
    return { tone: left < total * 0.25 ? 'soon' : '', label: `Responder en ${span(left)}` };
  }

  /** De quién es el turno, según quién escribió de último. */
  turn(t: Ticket): Tone {
    if (isClosed(t)) return { tone: 'done', label: 'Cerrado' };
    const ownerView = this.auth.isStaff();
    if (t.lastResponse?.authorRole === 'owner') {
      return { tone: ownerView ? 'them' : 'us', label: ownerView ? 'Esperando al cliente' : 'Tienes una respuesta' };
    }
    return { tone: ownerView ? 'us' : 'them', label: ownerView ? (t.responseCount ? 'Cliente respondió' : 'Sin responder') : 'En manos de 3TECH' };
  }

  // ── Acciones ──

  private savedView(): View {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'board' || v === 'list' ? v : 'company';
    } catch { return 'company'; }
  }

  setView(v: View) {
    this.view.set(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* preferencia opcional */ }
  }

  toggleGroup(id: string) {
    this.collapsed.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  open(id: string) {
    this.router.navigate(['/tickets', id]);
  }

  async changeStatus(t: Ticket, status: TicketStatus, select?: HTMLSelectElement) {
    if (t.status === status) return;
    try {
      await this.ticketService.updateStatus(t.id, status);
      this.notify.success(`#${t.id} → ${TICKET_STATUS_LABELS[status]}. El cliente fue notificado.`);
    } catch (err) {
      if (select) select.value = t.status; // el cambio no se guardó
      this.notify.error(apiErrorMessage(err));
    }
  }

  async assign(t: Ticket, userId: string | null, select?: HTMLSelectElement) {
    const me = this.auth.currentUser()?.id;
    try {
      await this.ticketService.assign(t.id, userId);
      const who = this.userService.staff().find(m => m.id === userId)?.name;
      this.notify.success(userId === null ? `#${t.id} quedó sin asignar.` : userId === me ? `Tomaste el ticket #${t.id}.` : `#${t.id} asignado a ${who}.`);
    } catch (err) {
      if (select) select.value = t.assignedTo?.id ?? '';
      this.notify.error(apiErrorMessage(err));
    }
  }

  onDragStart(event: DragEvent, id: string) {
    this.draggedId.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, status: TicketStatus) {
    event.preventDefault();
    this.dragOverCol.set(status);
  }

  onDrop(event: DragEvent, status: TicketStatus) {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.draggedId();
    this.dragOverCol.set(null);
    this.draggedId.set(null);
    const ticket = id ? this.ticketService.getById(id) : undefined;
    if (ticket) this.changeStatus(ticket, status);
  }

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  openModal() { this.form.reset({ category: 'bug', priority: 'medium' }); this.selectedAttachment.set(null); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); }

  onAttachmentSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir el mismo archivo después de quitarlo
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      this.notify.error(`El archivo es muy pesado (máximo ${formatFileSize(MAX_ATTACHMENT_SIZE)}).`);
      return;
    }
    this.selectedAttachment.set(file);
  }

  clearAttachment() {
    this.selectedAttachment.set(null);
  }

  exportTickets(format: ExportFormat) {
    const rows = this.auth.isStaff() && this.view() !== 'board' ? this.bucketTickets() : this.scopedTickets();
    const columns = [
      { header: 'ID', value: (t: Ticket) => t.id },
      { header: 'Título', value: (t: Ticket) => t.title },
      { header: 'Empresa', value: (t: Ticket) => t.companyName },
      { header: 'Creado por', value: (t: Ticket) => t.createdByName ?? '' },
      { header: 'Responsable', value: (t: Ticket) => t.assignedTo?.name ?? 'Sin asignar' },
      { header: 'Resuelto por', value: (t: Ticket) => t.resolvedByName ?? '' },
      { header: 'Categoría', value: (t: Ticket) => CATEGORY_LABELS[t.category] ?? t.category },
      { header: 'Prioridad', value: (t: Ticket) => PRIORITY_LABELS[t.priority] ?? t.priority },
      { header: 'Estado', value: (t: Ticket) => TICKET_STATUS_LABELS[t.status] ?? t.status },
      { header: 'Creado', value: (t: Ticket) => new Date(t.createdAt).toLocaleString('es-GT') },
      { header: 'SLA límite', value: (t: Ticket) => new Date(t.slaDeadline).toLocaleString('es-GT') },
      { header: 'Respuestas', value: (t: Ticket) => t.responseCount }
    ];
    if (format === 'excel') {
      exportToExcel('tickets', columns, rows);
    } else {
      exportToPdf('Reporte de Tickets', 'tickets', columns, rows);
    }
  }

  async createTicket() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    try {
      const ticket = await this.ticketService.create({
        title: v.title!,
        description: v.description!,
        category: v.category as Ticket['category'],
        priority: v.priority as TicketPriority,
      }, this.selectedAttachment() ?? undefined);
      this.closeModal();
      this.notify.success(`Ticket creado correctamente. Te responderemos antes de ${this.ticketService.getSlaTotalHours(ticket)} horas.`);
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
