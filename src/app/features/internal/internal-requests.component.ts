import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DepartmentService } from '../../core/services/department.service';
import { INTERNAL_CATEGORY_LABELS, InternalRequestService } from '../../core/services/internal-request.service';
import { InternalCategory, InternalRequest, TicketPriority, TicketStatus } from '../../core/models';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { NotificationService } from '../../shared/services/notification.service';
import { fileIcon, formatFileSize, MAX_ATTACHMENT_SIZE } from '../../shared/utils/file.util';

type Box = 'received' | 'sent' | 'mine' | 'all';
type StatusFilter = 'open' | 'closed' | 'all';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Abierta', in_review: 'En atención', resolved: 'Resuelta', escalated: 'Escalada', closed: 'Cerrada',
};
const PRIORITY_LABEL: Record<TicketPriority, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const isOpen = (r: InternalRequest) => r.status !== 'resolved' && r.status !== 'closed';
const H = 36e5;

function duration(ms: number): string {
  const min = Math.max(1, Math.round(Math.abs(ms) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/**
 * Solicitudes internas entre departamentos (Call Center → Tecnología, etc.).
 * Bandeja con conversación al lado, igual que el centro de soporte del cliente.
 */
@Component({
  selector: 'app-internal-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, IconComponent, ModalFocusTrapDirective],
  template: `
    <div class="internal">
      <header class="head">
        <div>
          <h1>Solicitudes internas</h1>
          <p>
            @if (myDepartment(); as d) { Pide apoyo a otros departamentos y atiende lo que llega a <strong>{{ d.name }}</strong>. }
            @else { Todas las solicitudes entre departamentos de la empresa. }
          </p>
        </div>
        <button class="btn-new" (click)="openNew()"><app-icon name="plus" [size]="16" /> Nueva solicitud</button>
      </header>

      <div class="inbox" [class.has-selection]="!!selected()">
        <!-- Lista -->
        <aside class="list-pane">
          <div class="boxes" role="tablist" aria-label="Bandejas">
            @for (b of boxes(); track b.id) {
              <button role="tab" [class.active]="box() === b.id" [attr.aria-selected]="box() === b.id" (click)="box.set(b.id); boxChosen = true">
                {{ b.label }} @if (b.count) { <span class="count" [class.hot]="b.hot">{{ b.count }}</span> }
              </button>
            }
          </div>
          <div class="list-tools">
            <div class="search-wrap">
              <app-icon name="search" [size]="15" class="search-icon" />
              <label for="internal-search" class="sr-only">Buscar solicitud</label>
              <input id="internal-search" class="search-input" type="text" placeholder="Buscar por título o SI-…"
                [value]="search()" (input)="search.set($any($event.target).value)">
            </div>
            <label for="internal-status" class="sr-only">Estado</label>
            <select id="internal-status" class="filter-select" [value]="statusFilter()" (change)="statusFilter.set($any($event.target).value)">
              <option value="open">Abiertas</option>
              <option value="closed">Resueltas</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div class="cards" role="list">
            @for (r of list(); track r.id) {
              <button role="listitem" class="card" [class.selected]="selectedId() === r.id" [class.breached]="r.slaBreached" (click)="select(r.id)">
                <div class="card-top">
                  <span class="mono">SI-{{ r.number }}</span>
                  <span class="pill" [class]="r.status">{{ statusLabel(r.status) }}</span>
                </div>
                <strong class="card-title">{{ r.title }}</strong>
                <span class="route">
                  <span class="dep" [class.me]="r.fromDepartment.id === myDepartmentId()">{{ r.fromDepartment.name }}</span>
                  <app-icon name="chevron-right" [size]="12" />
                  <span class="dep" [class.me]="r.toDepartment.id === myDepartmentId()">{{ r.toDepartment.name }}</span>
                </span>
                <span class="card-foot">
                  <span class="prio-dot" [class]="r.priority" [title]="'Prioridad ' + priorityLabel(r.priority)"></span>
                  @if (r.slaBreached) { <span class="late-tag"><app-icon name="clock" [size]="11" /> Vencida</span> }
                  @else if (isOpen(r) && !r.firstResponseAt) { <span class="wait-tag">Responder en {{ remaining(r) }}</span> }
                  <span class="spacer"></span>
                  <span class="who-small">{{ r.assignedTo?.name ?? 'Sin responsable' }}</span>
                </span>
              </button>
            } @empty {
              <div class="list-empty">
                <app-icon [name]="statusFilter() === 'open' ? 'check' : 'inbox'" [size]="26" />
                <p>{{ emptyText() }}</p>
              </div>
            }
          </div>
        </aside>

        <!-- Detalle -->
        <section class="detail-pane" aria-live="polite">
          @if (selected(); as r) {
            <div class="d-head">
              <button class="back" (click)="clearSelection()" aria-label="Volver a la lista"><app-icon name="chevron-left" [size]="16" /> Volver</button>
              <div class="d-title">
                <span class="mono">SI-{{ r.number }} · {{ categoryLabel(r.category) }}</span>
                <h2>{{ r.title }}</h2>
                <span class="d-meta">
                  <b>{{ r.fromDepartment.name }}</b> pide a <b>{{ r.toDepartment.name }}</b> · {{ r.createdByName }}, {{ r.createdAt | date:'d MMM y, HH:mm' }}
                </span>
              </div>
              <div class="d-badges">
                <span class="pill" [class]="r.status">{{ statusLabel(r.status) }}</span>
                <span class="prio-chip" [class]="r.priority">{{ priorityLabel(r.priority) }}</span>
              </div>
            </div>

            <div class="sla-note" [class]="slaInfo(r).tone"><app-icon [name]="slaInfo(r).icon" [size]="15" /> {{ slaInfo(r).text }}</div>

            <!-- Gestión: solo el lado que atiende -->
            @if (isReceiver(r)) {
              <div class="manage">
                <label for="internal-assignee" class="m-label">Responsable</label>
                <select id="internal-assignee" class="filter-select" [value]="r.assignedTo?.id ?? ''" [disabled]="busy()"
                  (change)="assign(r, $any($event.target).value || null)">
                  <option value="">Sin responsable</option>
                  @for (m of membersOf(r.toDepartment.id); track m.id) { <option [value]="m.id">{{ m.name }}{{ m.id === meId() ? ' (yo)' : '' }}</option> }
                </select>
                @if (canTake(r)) { <button class="btn-soft" [disabled]="busy()" (click)="assign(r, meId())">Tomarla</button> }
                <span class="spacer"></span>
                @for (a of statusActions(r); track a.status) {
                  <button class="btn-status" [class]="a.tone" [disabled]="busy()" (click)="setStatus(r, a.status)"><app-icon [name]="a.icon" [size]="14" /> {{ a.label }}</button>
                }
              </div>
            }

            <div class="thread">
              <div class="msg" [class.mine]="r.createdById === meId()">
                <span class="av">{{ initials(r.createdByName) }}</span>
                <div class="bubble">
                  <span class="who">{{ r.createdByName }} · {{ r.fromDepartment.name }} · {{ r.createdAt | date:'d MMM, HH:mm' }}</span>
                  <p>{{ r.description }}</p>
                  @for (a of r.attachments ?? []; track a.id) {
                    <a class="att" [href]="a.url" target="_blank" rel="noopener"><app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <small>{{ formatFileSize(a.size) }}</small></a>
                  }
                </div>
              </div>
              @if (!r.responses) { <p class="loading">Cargando conversación…</p> }
              @for (m of r.responses ?? []; track m.id) {
                <div class="msg" [class.mine]="m.authorId === meId()" [class.receiver]="m.authorDepartmentId === r.toDepartment.id">
                  <span class="av">{{ initials(m.authorName) }}</span>
                  <div class="bubble">
                    <span class="who">{{ m.authorName }} · {{ departmentName(m.authorDepartmentId, m.authorRole) }} · {{ m.createdAt | date:'d MMM, HH:mm' }}</span>
                    <p>{{ m.content }}</p>
                    @for (a of m.attachments; track a.id) {
                      <a class="att" [href]="a.url" target="_blank" rel="noopener"><app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <small>{{ formatFileSize(a.size) }}</small></a>
                    }
                  </div>
                </div>
              }
              @if (r.resolvedAt && !isOpen(r)) {
                <p class="sys"><app-icon name="check" [size]="13" /> {{ statusLabel(r.status) }} por {{ r.resolvedByName }} · {{ r.resolvedAt | date:'d MMM, HH:mm' }}</p>
              }
            </div>

            @if (r.status !== 'closed') {
              <form class="reply" (ngSubmit)="send(r)">
                <label for="internal-reply" class="sr-only">Escribe un mensaje</label>
                <textarea id="internal-reply" name="reply" [(ngModel)]="reply" rows="2"
                  [placeholder]="isReceiver(r) ? 'Responde a ' + r.fromDepartment.name + '…' : 'Escribe a ' + r.toDepartment.name + '…'"></textarea>
                <div class="reply-bar">
                  <label class="attach" [title]="'Adjuntar imagen o PDF (máx. ' + formatFileSize(maxSize) + ')'">
                    <app-icon name="paperclip" [size]="16" />
                    <input type="file" accept="image/*,.pdf" (change)="pickFile($event, 'reply')" hidden>
                  </label>
                  @if (replyFile(); as f) {
                    <span class="file-chip">{{ f.name }} <button type="button" (click)="replyFile.set(null)" aria-label="Quitar adjunto"><app-icon name="x" [size]="12" /></button></span>
                  }
                  <span class="spacer"></span>
                  <button type="submit" class="btn-send" [disabled]="busy() || !reply.trim()"><app-icon name="send" [size]="14" /> Enviar</button>
                </div>
              </form>
            }
          } @else {
            <div class="detail-empty">
              <app-icon name="message-circle" [size]="34" />
              <h3>Elige una solicitud</h3>
              <p>Aquí verás la conversación entre los departamentos y podrás darle seguimiento.</p>
            </div>
          }
        </section>
      </div>
    </div>

    <!-- Nueva solicitud -->
    @if (showNew()) {
      <div class="modal-overlay" (click)="closeNew()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="internal-new-title"
          appModalFocusTrap (closeRequested)="closeNew()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="internal-new-title">Nueva solicitud interna</h2>
            <button class="modal-close" (click)="closeNew()" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
          </div>
          <form class="modal-body" (ngSubmit)="create()" novalidate>
            @if (auth.isOwner()) {
              <div class="form-group">
                <label for="internal-from">Desde *</label>
                <select id="internal-from" name="from" [(ngModel)]="draft.fromDepartmentId">
                  <option value="" disabled>Elige tu departamento</option>
                  @for (d of activeDepartments(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }
                </select>
              </div>
            }
            <div class="form-group">
              <label for="internal-to">¿A qué departamento? *</label>
              <select id="internal-to" name="to" [(ngModel)]="draft.toDepartmentId">
                <option value="" disabled>Elige el departamento</option>
                @for (d of activeDepartments(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }
              </select>
              @if (departments.getById(draft.toDepartmentId); as to) {
                <span class="hint"><app-icon name="clock" [size]="12" /> {{ to.name }} responde en máximo <b>{{ to.slaHours }} h</b> · {{ to.members.length }} {{ to.members.length === 1 ? 'persona' : 'personas' }}</span>
              }
            </div>
            <div class="form-group">
              <label for="internal-title">Título *</label>
              <input id="internal-title" name="title" [(ngModel)]="draft.title" maxlength="160" placeholder="Ej. El softphone se desconecta en la estación 4">
            </div>
            <div class="form-group">
              <label for="internal-description">Descripción *</label>
              <textarea id="internal-description" name="description" [(ngModel)]="draft.description" rows="4" placeholder="Qué necesitas, para cuándo y cualquier dato que ayude."></textarea>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label for="internal-category">Tipo</label>
                <select id="internal-category" name="category" [(ngModel)]="draft.category">
                  @for (c of categories; track c.value) { <option [value]="c.value">{{ c.label }}</option> }
                </select>
              </div>
              <div class="form-group">
                <label for="internal-priority">Prioridad</label>
                <select id="internal-priority" name="priority" [(ngModel)]="draft.priority">
                  <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="internal-attachment">Adjuntar archivo (opcional)</label>
              <input id="internal-attachment" type="file" accept="image/*,.pdf" (change)="pickFile($event, 'new')">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeNew()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="!canCreate() || busy()">Enviar solicitud</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .internal { max-width: var(--page-max-width); margin: 0 auto; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; color: #94a3b8; font-weight: 700; }
    .spacer { flex: 1; }

    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
    .head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .head p { margin: 0; font-size: 14px; color: #64748b; }
    .head strong { color: #0f4b92; }
    .btn-new { display: inline-flex; align-items: center; gap: 7px; border: none; background: #0f4b92; color: #fff; padding: 11px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; font-family: inherit; }
    .btn-new:hover { background: #0b3a72; }

    .inbox { display: grid; grid-template-columns: minmax(330px, 420px) minmax(0, 1fr); gap: 16px; height: calc(100vh - 210px); min-height: 540px; }
    .list-pane, .detail-pane { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; min-height: 0; }
    .list-pane { display: flex; flex-direction: column; padding: 14px; gap: 10px; }
    .detail-pane { display: flex; flex-direction: column; overflow: hidden; }

    .boxes { display: flex; background: #f1f5f9; border-radius: 11px; padding: 3px; gap: 2px; }
    .boxes button { flex: 1; border: none; background: none; padding: 8px 6px; border-radius: 9px; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; justify-content: center; align-items: center; gap: 5px; font-family: inherit; white-space: nowrap; }
    .boxes button.active { background: #fff; color: #0f4b92; box-shadow: 0 1px 3px rgba(15,23,42,0.1); }
    .count { background: #e2e8f0; border-radius: 999px; padding: 0 7px; font-size: 11px; }
    .count.hot { background: #e99d34; color: #fff; }
    .list-tools { display: flex; gap: 8px; }
    .list-tools .search-wrap { min-width: 0; }
    .list-tools .filter-select { flex: none; }

    .cards { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin: 0 -4px; padding: 2px 4px; }
    .card { text-align: left; font-family: inherit; border: 1.5px solid #eef2f7; background: #fff; border-radius: 14px; padding: 11px 13px; cursor: pointer; display: flex; flex-direction: column; gap: 5px; transition: border-color 0.15s, background 0.15s; }
    .card:hover { border-color: #c7d7ee; }
    .card.selected { border-color: #0f4b92; background: #f6f9fe; }
    .card.breached { border-left: 4px solid #dc2626; }
    .card-top { display: flex; justify-content: space-between; align-items: center; }
    .card-title { font-size: 14px; color: #0f172a; line-height: 1.3; }
    .route { display: inline-flex; align-items: center; gap: 4px; color: #94a3b8; flex-wrap: wrap; }
    .dep { font-size: 11.5px; font-weight: 700; color: #475569; background: #f1f5f9; padding: 1px 8px; border-radius: 999px; }
    .dep.me { background: #eef4fc; color: #0f4b92; }
    .card-foot { display: flex; align-items: center; gap: 7px; }
    .prio-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .prio-dot.critical { background: #ef4444; } .prio-dot.high { background: #f97316; } .prio-dot.medium { background: #e99d34; } .prio-dot.low { background: #a9c238; }
    .late-tag { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 800; color: #dc2626; background: #fef2f2; padding: 1px 7px; border-radius: 999px; }
    .wait-tag { font-size: 11px; font-weight: 700; color: #0f4b92; background: #eef4fc; padding: 1px 7px; border-radius: 999px; }
    .who-small { font-size: 11.5px; color: #94a3b8; }
    .list-empty { text-align: center; color: #94a3b8; padding: 30px 10px; }
    .list-empty p { font-size: 13px; margin: 8px 0 0; }

    .pill { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; background: #f1f5f9; color: #475569; }
    .pill.in_review, .pill.escalated { background: #eef4fc; color: #0f4b92; }
    .pill.resolved, .pill.closed { background: #f2f7e1; color: #5b6b12; }
    .prio-chip { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
    .prio-chip.critical { background: #fee2e2; color: #dc2626; } .prio-chip.high { background: #ffedd5; color: #c2410c; }
    .prio-chip.medium { background: #fdf3e6; color: #a8620a; } .prio-chip.low { background: #f2f7e1; color: #5b6b12; }

    .d-head { display: flex; gap: 12px; padding: 16px 22px 12px; border-bottom: 1px solid #f1f5f9; align-items: flex-start; }
    .d-title { flex: 1; min-width: 0; }
    .d-title h2 { margin: 2px 0 3px; font-size: 19px; font-weight: 800; color: #0f172a; }
    .d-meta { font-size: 12.5px; color: #64748b; }
    .d-meta b { color: #334155; }
    .d-badges { display: flex; gap: 6px; flex-shrink: 0; }
    .back { display: none; align-items: center; gap: 4px; border: none; background: #f1f5f9; color: #334155; font-weight: 700; font-size: 13px; padding: 6px 10px; border-radius: 9px; cursor: pointer; font-family: inherit; }

    .sla-note { display: flex; align-items: center; gap: 8px; margin: 10px 22px 0; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; }
    .sla-note.ok { background: #f2f7e1; color: #5b6b12; }
    .sla-note.wait { background: #eef4fc; color: #0f4b92; }
    .sla-note.late { background: #fef2f2; color: #b91c1c; }

    .manage { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 22px 0; padding: 10px 12px; background: #f8fafc; border-radius: 12px; }
    .m-label { font-size: 12.5px; font-weight: 700; color: #475569; }
    .manage .filter-select { padding-top: 6px; padding-bottom: 6px; font-size: 13px; }
    .btn-soft { border: 1.5px solid #c9dbf2; background: #eef4fc; color: #0f4b92; font-weight: 700; font-size: 12.5px; padding: 6px 12px; border-radius: 9px; cursor: pointer; font-family: inherit; }
    .btn-status { display: inline-flex; align-items: center; gap: 5px; border: none; font-weight: 700; font-size: 12.5px; padding: 7px 12px; border-radius: 9px; cursor: pointer; font-family: inherit; background: #e2e8f0; color: #334155; }
    .btn-status.primary { background: #0f4b92; color: #fff; }
    .btn-status.good { background: #a9c238; color: #fff; }
    .btn-status:disabled { opacity: 0.5; cursor: not-allowed; }

    .thread { flex: 1; overflow-y: auto; padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
    .msg { display: flex; gap: 10px; align-items: flex-end; max-width: 82%; }
    .msg.mine { align-self: flex-end; flex-direction: row-reverse; }
    .av { width: 30px; height: 30px; border-radius: 50%; background: #94a3b8; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .msg.receiver .av { background: #0f4b92; }
    .bubble { background: #f1f5f9; border-radius: 14px 14px 14px 4px; padding: 10px 13px; display: flex; flex-direction: column; gap: 4px; }
    .mine .bubble { background: #0f4b92; color: #fff; border-radius: 14px 14px 4px 14px; }
    .who { font-size: 11.5px; font-weight: 700; color: #64748b; }
    .mine .who { color: #c9dcf4; }
    .bubble p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .att { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: inherit; text-decoration: underline; }
    .att small { opacity: 0.7; }
    .loading, .sys { font-size: 12.5px; color: #94a3b8; text-align: center; margin: 0; }
    .sys { display: inline-flex; align-self: center; align-items: center; gap: 5px; color: #5b6b12; background: #f2f7e1; padding: 4px 12px; border-radius: 999px; font-weight: 700; }

    .reply { border-top: 1px solid #f1f5f9; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .reply textarea { width: 100%; box-sizing: border-box; resize: none; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; }
    .reply textarea:focus { border-color: #0f4b92; }
    .reply-bar { display: flex; align-items: center; gap: 8px; }
    .attach { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #64748b; background: #f1f5f9; cursor: pointer; }
    .file-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; background: #eef4fc; color: #0f4b92; padding: 4px 8px; border-radius: 8px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip button { border: none; background: none; color: inherit; cursor: pointer; display: inline-flex; padding: 0; }
    .btn-send { display: inline-flex; align-items: center; gap: 6px; border: none; background: #0f4b92; color: #fff; padding: 9px 16px; border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .detail-empty { margin: auto; text-align: center; color: #94a3b8; padding: 30px; }
    .detail-empty h3 { margin: 10px 0 4px; color: #334155; font-size: 16px; }
    .detail-empty p { margin: 0; font-size: 13.5px; }

    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .form-group label { font-size: 13px; font-weight: 600; color: #334155; }
    .form-group input, .form-group select, .form-group textarea { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #0f4b92; }
    .form-group textarea { resize: vertical; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .hint { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: #0f4b92; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px; }

    /* Pantallas angostas: lista o detalle, uno a la vez. */
    @media (max-width: 1023px) {
      .inbox { grid-template-columns: 1fr; height: auto; min-height: 0; }
      .detail-pane { display: none; min-height: 70vh; }
      .inbox.has-selection .list-pane { display: none; }
      .inbox.has-selection .detail-pane { display: flex; }
      .cards { overflow: visible; }
      .back { display: inline-flex; }
      .d-head { flex-wrap: wrap; }
    }
    @media (max-width: 560px) {
      .btn-new { width: 100%; justify-content: center; }
      .form-grid-2 { grid-template-columns: 1fr; }
      .msg { max-width: 94%; }
    }
  `]
})
export class InternalRequestsComponent {
  auth = inject(AuthService);
  departments = inject(DepartmentService);
  private service = inject(InternalRequestService);
  private notify = inject(NotificationService);
  private location = inject(Location);
  private route = inject(ActivatedRoute);

  readonly categories = (Object.keys(INTERNAL_CATEGORY_LABELS) as InternalCategory[]).map(value => ({ value, label: INTERNAL_CATEGORY_LABELS[value] }));
  readonly maxSize = MAX_ATTACHMENT_SIZE;
  fileIcon = fileIcon;
  formatFileSize = formatFileSize;
  isOpen = isOpen;

  meId = computed(() => this.auth.currentUser()?.id ?? '');
  myDepartmentId = computed(() => this.auth.currentUser()?.departmentId ?? '');
  myDepartment = computed(() => this.departments.getById(this.myDepartmentId()));
  activeDepartments = computed(() => this.departments.departments().filter(d => d.active));

  box = signal<Box>(this.auth.currentUser()?.departmentId ? 'mine' : 'all');
  /** Si la persona ya eligió una bandeja, no se la cambiamos al terminar de cargar. */
  boxChosen = false;
  statusFilter = signal<StatusFilter>('open');
  search = signal('');
  selectedId = signal<string | null>(null);
  busy = signal(false);
  showNew = signal(false);
  replyFile = signal<File | null>(null);
  private newFile: File | null = null;
  reply = '';
  draft = this.emptyDraft();
  /** Reloj para las cuentas regresivas del SLA. */
  private now = signal(Date.now());

  constructor() {
    loadPageData(this.notify, this.service.load(), this.departments.load()).then(() => {
      // Abre en "Mías" si tiene algo asignado; si no, en lo que llegó a su departamento.
      if (!this.boxChosen && this.myDepartmentId()) {
        const mine = this.service.items().some(r => r.assignedTo?.id === this.meId() && isOpen(r));
        this.box.set(mine ? 'mine' : 'received');
      }
    });
    // Al abrir desde una notificación se reutiliza el componente: seguir el parámetro.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(p => {
      const id = p.get('id');
      if (id) this.select(id, false);
    });
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private inBox(r: InternalRequest, box: Box): boolean {
    const dep = this.myDepartmentId();
    switch (box) {
      case 'received': return !!dep && r.toDepartment.id === dep;
      case 'sent': return (!!dep && r.fromDepartment.id === dep) || r.createdById === this.meId();
      case 'mine': return r.assignedTo?.id === this.meId();
      default: return true;
    }
  }

  boxes = computed(() => {
    const items = this.service.items();
    const open = (b: Box) => items.filter(r => this.inBox(r, b) && isOpen(r)).length;
    const list: { id: Box; label: string; count: number; hot?: boolean }[] = [];
    // Orden de trabajo: primero lo que tengo yo, luego lo que llegó a mi departamento, al final lo que envié.
    if (this.myDepartmentId()) {
      list.push({ id: 'mine', label: 'Mías', count: open('mine'), hot: open('mine') > 0 });
      list.push({ id: 'received', label: 'Recibidas', count: open('received'), hot: this.service.pendingForMe() > 0 });
      list.push({ id: 'sent', label: 'Enviadas', count: open('sent') });
    }
    if (this.auth.isOwner()) list.push({ id: 'all', label: 'Todas', count: open('all') });
    return list;
  });

  list = computed(() => {
    const s = this.search().trim().toLowerCase().replace(/^si-?/, '');
    const f = this.statusFilter();
    return this.service.items()
      .filter(r => this.inBox(r, this.box()))
      .filter(r => f === 'all' || (f === 'open' ? isOpen(r) : !isOpen(r)))
      .filter(r => !s || r.title.toLowerCase().includes(s) || String(r.number) === s || r.description.toLowerCase().includes(s))
      // Primero las que atiendo yo, luego las demás abiertas (vencidas antes) y al final las resueltas.
      .sort((a, b) => this.rank(a) - this.rank(b) || Number(b.slaBreached) - Number(a.slaBreached) || b.updatedAt.localeCompare(a.updatedAt));
  });

  private rank(r: InternalRequest): number {
    if (!isOpen(r)) return 3;
    if (r.assignedTo?.id === this.meId()) return 0;
    return r.toDepartment.id === this.myDepartmentId() ? 1 : 2;
  }

  selected = computed(() => this.service.getById(this.selectedId()));

  emptyText = computed(() => {
    if (this.search()) return 'Ninguna solicitud coincide con la búsqueda.';
    if (this.statusFilter() === 'open') return this.box() === 'received' ? 'Tu departamento no tiene solicitudes pendientes.' : 'No hay solicitudes abiertas aquí.';
    return 'No hay solicitudes en esta bandeja.';
  });

  statusLabel(s: TicketStatus) { return STATUS_LABEL[s]; }
  priorityLabel(p: TicketPriority) { return PRIORITY_LABEL[p]; }
  categoryLabel(c: InternalCategory) { return INTERNAL_CATEGORY_LABELS[c]; }
  initials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  membersOf(depId: string) { return this.departments.getById(depId)?.members ?? []; }
  departmentName(id: string | undefined, role: string) {
    return this.departments.getById(id)?.name ?? (role === 'owner' ? 'Dirección' : 'Sin departamento');
  }

  /** Lado que atiende: su departamento destino, el responsable y el Propietario. */
  isReceiver(r: InternalRequest) {
    return this.auth.isOwner() || r.toDepartment.id === this.myDepartmentId() || r.assignedTo?.id === this.meId();
  }
  canTake(r: InternalRequest) {
    return r.toDepartment.id === this.myDepartmentId() && r.assignedTo?.id !== this.meId() && isOpen(r);
  }

  remaining(r: InternalRequest) {
    return duration(new Date(r.slaDeadline).getTime() - this.now());
  }

  slaInfo(r: InternalRequest): { tone: string; icon: IconName; text: string } {
    const created = new Date(r.createdAt).getTime();
    const deadline = new Date(r.slaDeadline).getTime();
    if (r.firstResponseAt) {
      const took = duration(new Date(r.firstResponseAt).getTime() - created);
      return r.slaMet
        ? { tone: 'ok', icon: 'check', text: `${r.toDepartment.name} respondió en ${took}, dentro de su compromiso de ${r.toDepartment.slaHours} h.` }
        : { tone: 'late', icon: 'clock', text: `${r.toDepartment.name} respondió en ${took}; su compromiso era ${r.toDepartment.slaHours} h.` };
    }
    if (!isOpen(r)) return { tone: 'ok', icon: 'check', text: 'Solicitud cerrada.' };
    const left = deadline - this.now();
    return left < 0
      ? { tone: 'late', icon: 'alert-triangle', text: `Sin respuesta: el plazo de ${r.toDepartment.slaHours} h venció hace ${duration(left)}.` }
      : { tone: 'wait', icon: 'clock', text: `${r.toDepartment.name} se comprometió a responder en ${r.toDepartment.slaHours} h · quedan ${duration(left)}.` };
  }

  statusActions(r: InternalRequest): { status: TicketStatus; label: string; icon: IconName; tone: string }[] {
    switch (r.status) {
      case 'open': return [{ status: 'in_review', label: 'En atención', icon: 'play', tone: 'primary' }, { status: 'resolved', label: 'Resolver', icon: 'check', tone: 'good' }];
      case 'in_review':
      case 'escalated': return [{ status: 'resolved', label: 'Resolver', icon: 'check', tone: 'good' }];
      case 'resolved': return [{ status: 'closed', label: 'Cerrar', icon: 'lock', tone: '' }, { status: 'open', label: 'Reabrir', icon: 'refresh', tone: '' }];
      default: return [{ status: 'open', label: 'Reabrir', icon: 'refresh', tone: '' }];
    }
  }

  select(id: string, updateUrl = true) {
    if (this.selectedId() !== id) { this.reply = ''; this.replyFile.set(null); }
    this.selectedId.set(id);
    // Cambia la URL sin recrear la pantalla (se puede compartir o recargar).
    if (updateUrl) this.location.replaceState(`/internas/${id}`);
    this.service.loadDetail(id).catch(err => {
      this.notify.error(apiErrorMessage(err));
      this.clearSelection();
    });
  }

  clearSelection() {
    this.selectedId.set(null);
    this.location.replaceState('/internas');
  }

  private async run(action: () => Promise<void>, ok?: string) {
    this.busy.set(true);
    try {
      await action();
      if (ok) this.notify.success(ok);
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  assign(r: InternalRequest, userId: string | null) {
    this.run(() => this.service.assign(r.id, userId), userId === this.meId() ? 'La tomaste.' : 'Responsable actualizado.');
  }

  setStatus(r: InternalRequest, status: TicketStatus) {
    this.run(() => this.service.setStatus(r.id, status), `Solicitud ${STATUS_LABEL[status].toLowerCase()}.`);
  }

  send(r: InternalRequest) {
    const content = this.reply.trim();
    if (!content) return;
    this.run(async () => {
      await this.service.respond(r.id, content, this.replyFile() ?? undefined);
      this.reply = '';
      this.replyFile.set(null);
    });
  }

  pickFile(event: Event, target: 'reply' | 'new') {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (f && f.size > MAX_ATTACHMENT_SIZE) {
      this.notify.error(`El archivo supera ${formatFileSize(MAX_ATTACHMENT_SIZE)}.`);
      input.value = '';
      return;
    }
    if (target === 'reply') { this.replyFile.set(f); input.value = ''; }
    else this.newFile = f;
  }

  private emptyDraft() {
    return {
      fromDepartmentId: this.auth.currentUser()?.departmentId ?? '',
      toDepartmentId: '', title: '', description: '',
      category: 'request' as InternalCategory, priority: 'medium' as TicketPriority,
    };
  }

  openNew() { this.draft = this.emptyDraft(); this.newFile = null; this.showNew.set(true); }
  closeNew() { this.showNew.set(false); }

  canCreate() {
    const d = this.draft;
    return !!(d.toDepartmentId && d.title.trim() && d.description.trim() && (!this.auth.isOwner() || d.fromDepartmentId));
  }

  create() {
    if (!this.canCreate()) return;
    const d = this.draft;
    this.run(async () => {
      const r = await this.service.create({
        toDepartmentId: d.toDepartmentId, fromDepartmentId: this.auth.isOwner() ? d.fromDepartmentId : undefined,
        title: d.title.trim(), description: d.description.trim(), category: d.category, priority: d.priority,
      }, this.newFile ?? undefined);
      this.showNew.set(false);
      this.box.set(this.myDepartmentId() ? 'sent' : 'all');
      this.statusFilter.set('open');
      this.select(r.id);
    }, 'Solicitud enviada. Le avisamos al departamento.');
  }
}
