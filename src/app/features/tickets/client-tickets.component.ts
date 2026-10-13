import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TicketService } from '../../core/services/ticket.service';
import { NotificationService } from '../../shared/services/notification.service';
import { apiErrorMessage } from '../../core/http/api-error';
import { Ticket } from '../../core/models';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { fileIcon, formatFileSize, MAX_ATTACHMENT_SIZE } from '../../shared/utils/file.util';

type Tab = 'open' | 'resolved';
interface Step { label: string; done: boolean; current: boolean; detail: string }

const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
function span(ms: number): string {
  const min = Math.round(Math.abs(ms) / 60000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/**
 * Centro de soporte del cliente: bandeja con sus solicitudes a la izquierda y
 * la conversación del ticket elegido a la derecha (responder y calificar ahí
 * mismo). En pantallas angostas solo se muestra la lista y se abre el detalle.
 */
@Component({
  selector: 'app-client-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink, IconComponent],
  template: `
    <div class="support">
      <!-- Encabezado -->
      <header class="support-head">
        <div>
          <h1>Soporte</h1>
          <p>Respuesta garantizada en <strong>{{ slaHours() }} horas</strong>. Aquí ves el avance de cada solicitud y conversas con el equipo de 3TECH.</p>
          <div class="learn-row">
            <a routerLink="/aprende" class="learn-link"><app-icon name="lightbulb" [size]="14" /> ¿Primera vez? Aprende a pedir soporte en 3 minutos</a>
            <button type="button" class="guide-btn" (click)="guide.emit()"><app-icon name="play" [size]="12" /> Guíame en esta pantalla</button>
          </div>
        </div>
        <button class="btn-new" (click)="create.emit()"><app-icon name="plus" [size]="16" /> Nueva solicitud</button>
      </header>

      <div class="inbox">
        <!-- Lista -->
        <aside class="list-pane">
          <div class="tabs" role="tablist">
            <button role="tab" [class.active]="tab() === 'open'" [attr.aria-selected]="tab() === 'open'" (click)="tab.set('open')">
              Abiertas <span class="count">{{ openCount() }}</span>
            </button>
            <button role="tab" [class.active]="tab() === 'resolved'" [attr.aria-selected]="tab() === 'resolved'" (click)="tab.set('resolved')">
              Resueltas <span class="count">{{ resolvedCount() }}</span>
            </button>
          </div>
          @if (answeredCount() && tab() === 'open') {
            <p class="new-replies"><span class="pulse"></span> {{ answeredCount() }} con respuesta nueva del equipo</p>
          }
          <div class="search-wrap">
            <app-icon name="search" [size]="15" class="search-icon" />
            <label for="client-ticket-search" class="sr-only">Buscar solicitud</label>
            <input id="client-ticket-search" class="search-input" type="text" placeholder="Buscar por título o número…"
              [value]="search()" (input)="search.set($any($event.target).value)">
          </div>

          <div class="cards" role="list">
            @for (t of list(); track t.id) {
              <button role="listitem" class="card" [class.selected]="selectedId() === t.id" [class.unread]="hasNewReply(t)" (click)="select(t.id)">
                <div class="card-top">
                  <span class="pill" [class]="statusTone(t)">{{ statusLabel(t) }}</span>
                  <span class="when">{{ ago(t.updatedAt) }}</span>
                </div>
                <strong class="card-title">{{ t.title }}</strong>
                <span class="snippet">
                  @if (t.lastResponse; as r) {
                    <b>{{ r.authorRole === 'owner' ? r.authorName : 'Tú' }}:</b> {{ r.content || 'Envió un mensaje' }}
                  } @else {
                    {{ t.description }}
                  }
                </span>
                <span class="card-foot">
                  <span class="mono">#{{ t.id }}</span>
                  @if (hasNewReply(t)) { <span class="new-tag">Nueva respuesta</span> }
                  @else if (t.status === 'resolved' && !t.satisfactionRating) { <span class="rate-tag">Califícanos</span> }
                </span>
              </button>
            } @empty {
              <div class="list-empty">
                <app-icon [name]="tab() === 'open' ? 'check' : 'inbox'" [size]="26" />
                <p>{{ search() ? 'Ninguna solicitud coincide con la búsqueda.' : tab() === 'open' ? 'No tienes solicitudes abiertas. ¡Todo funciona bien!' : 'Aún no hay solicitudes resueltas.' }}</p>
              </div>
            }
          </div>
        </aside>

        <!-- Conversación -->
        <section class="detail-pane" aria-live="polite">
          @if (selected(); as t) {
            <div class="d-head">
              <div class="d-title">
                <span class="mono">#{{ t.id }}</span>
                <h2>{{ t.title }}</h2>
                <span class="d-meta">Creada {{ t.createdAt | date:'d MMM y, HH:mm' }}{{ t.createdByName ? ' por ' + t.createdByName : '' }}</span>
              </div>
              <a class="full-link" [routerLink]="['/tickets', t.id]" title="Abrir en página completa"><app-icon name="external-link" [size]="15" /></a>
            </div>

            <!-- Recorrido -->
            <ol class="steps">
              @for (s of steps(t); track s.label) {
                <li [class.done]="s.done" [class.current]="s.current">
                  <span class="dot">@if (s.done) { <app-icon name="check" [size]="12" [strokeWidth]="3" /> }</span>
                  <span class="s-label">{{ s.label }}</span>
                  <span class="s-detail">{{ s.detail }}</span>
                </li>
              }
            </ol>

            <div class="sla-note" [class]="slaInfo(t).tone">
              <app-icon [name]="slaInfo(t).icon" [size]="15" /> {{ slaInfo(t).text }}
            </div>

            <!-- Hilo -->
            <div class="thread">
              <div class="msg mine">
                <div class="bubble">
                  <span class="who">{{ t.createdByName || 'Tú' }} · {{ t.createdAt | date:'d MMM, HH:mm' }}</span>
                  <p>{{ t.description }}</p>
                  @for (a of t.attachments ?? []; track a.id) {
                    <a class="att" [href]="a.url" target="_blank" rel="noopener"><app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <small>{{ formatFileSize(a.size) }}</small></a>
                  }
                </div>
              </div>
              @if (!detailLoaded().has(t.id)) {
                <p class="loading">Cargando conversación…</p>
              }
              @for (r of t.responses; track r.id) {
                <div class="msg" [class.mine]="r.authorRole === 'client'">
                  @if (r.authorRole !== 'client') { <span class="av">{{ initialsOf(r.authorName) }}</span> }
                  <div class="bubble">
                    <span class="who">{{ r.authorRole === 'client' ? r.authorName : r.authorName + ' · 3TECH' }} · {{ r.createdAt | date:'d MMM, HH:mm' }}</span>
                    <p>{{ r.content }}</p>
                    @for (a of r.attachments; track a.id) {
                      <a class="att" [href]="a.url" target="_blank" rel="noopener"><app-icon [name]="fileIcon(a.type)" [size]="14" /> {{ a.name }} <small>{{ formatFileSize(a.size) }}</small></a>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Calificación -->
            @if (isClosed(t)) {
              <div class="rate">
                @if (t.satisfactionRating) {
                  <span>Calificaste la atención:</span>
                  <span class="stars">@for (i of [1,2,3,4,5]; track i) { <app-icon name="star" [size]="17" [filled]="i <= t.satisfactionRating!" [class.on]="i <= t.satisfactionRating!" /> }</span>
                } @else {
                  <strong>¿Cómo te atendimos?</strong>
                  <span class="stars interactive">
                    @for (i of [1,2,3,4,5]; track i) {
                      <button type="button" (click)="rating.set(i)" (mouseenter)="hover.set(i)" (mouseleave)="hover.set(0)" [attr.aria-label]="i + ' de 5 estrellas'">
                        <app-icon name="star" [size]="22" [filled]="i <= (hover() || rating())" [class.on]="i <= (hover() || rating())" />
                      </button>
                    }
                  </span>
                  @if (rating()) {
                    <input class="rate-comment" [(ngModel)]="ratingComment" placeholder="Comentario opcional…" aria-label="Comentario">
                    <button class="btn-send" [disabled]="busy()" (click)="rate(t)">Enviar calificación</button>
                  }
                }
              </div>
            }

            <!-- Responder -->
            @if (t.status !== 'closed') {
              <form class="reply" (ngSubmit)="send(t)">
                <label for="client-reply" class="sr-only">Escribe tu mensaje</label>
                <textarea id="client-reply" name="reply" [(ngModel)]="reply" rows="2"
                  [placeholder]="t.status === 'resolved' ? '¿Sigue el problema? Escríbenos aquí…' : 'Escribe un mensaje al equipo…'"></textarea>
                <div class="reply-bar">
                  <label class="attach" [title]="'Adjuntar imagen o PDF (máx. ' + formatFileSize(maxSize) + ')'">
                    <app-icon name="paperclip" [size]="16" />
                    <input type="file" accept="image/*,.pdf" (change)="pickFile($event)" hidden>
                  </label>
                  @if (file(); as f) {
                    <span class="file-chip">{{ f.name }} <button type="button" (click)="file.set(null)" aria-label="Quitar adjunto"><app-icon name="x" [size]="12" /></button></span>
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
              <p>Aquí verás la conversación con el equipo y el avance de tu solicitud.</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 11.5px; color: #94a3b8; font-weight: 700; }
    .spacer { flex: 1; }

    .support-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
    .support-head h1 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #0f172a; }
    .support-head p { margin: 0; font-size: 14px; color: #64748b; max-width: 620px; }
    .support-head strong { color: #0f4b92; }
    .learn-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 8px; }
    .guide-btn { display: inline-flex; align-items: center; gap: 5px; border: 1.5px solid #c9dbf2; background: #eef4fc; color: #0f4b92; font-size: 12.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; cursor: pointer; font-family: inherit; }
    .guide-btn:hover { background: #dfeafa; }
    .learn-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #a8620a; text-decoration: none; }
    .learn-link:hover { text-decoration: underline; }
    .btn-new { display: inline-flex; align-items: center; gap: 7px; border: none; background: #e99d34; color: #fff; padding: 11px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; }
    .btn-new:hover { background: #d48a22; }

    /* Bandeja de dos paneles */
    .inbox { display: grid; grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 16px; height: calc(100vh - 210px); min-height: 520px; }
    .list-pane, .detail-pane { background: #fff; border: 1px solid #e2e8f0; border-radius: 18px; min-height: 0; }
    .list-pane { display: flex; flex-direction: column; padding: 14px; gap: 10px; }
    .detail-pane { display: flex; flex-direction: column; overflow: hidden; }

    .list-pane .search-wrap { flex: none; }
    .tabs { display: grid; grid-template-columns: 1fr 1fr; background: #f1f5f9; border-radius: 11px; padding: 3px; }
    .tabs button { border: none; background: none; padding: 8px; border-radius: 9px; font-size: 13.5px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; justify-content: center; gap: 6px; }
    .tabs button.active { background: #fff; color: #0f4b92; box-shadow: 0 1px 3px rgba(15,23,42,0.1); }
    .count { background: #e2e8f0; border-radius: 999px; padding: 0 7px; font-size: 11.5px; }
    .tabs button.active .count { background: #eef4fc; }
    .new-replies { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 12.5px; font-weight: 700; color: #a8620a; background: #fdf3e6; border-radius: 10px; padding: 8px 10px; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: #e99d34; box-shadow: 0 0 0 3px rgba(233,157,52,0.25); }

    .cards { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin: 0 -4px; padding: 2px 4px; }
    .card { text-align: left; font-family: inherit; border: 1.5px solid #eef2f7; background: #fff; border-radius: 14px; padding: 12px 13px; cursor: pointer; display: flex; flex-direction: column; gap: 5px; transition: border-color 0.15s, background 0.15s; }
    .card:hover { border-color: #c7d7ee; }
    .card.selected { border-color: #0f4b92; background: #f6f9fe; }
    .card.unread { border-left: 4px solid #e99d34; }
    .card-top { display: flex; justify-content: space-between; align-items: center; }
    .when { font-size: 11.5px; color: #94a3b8; }
    .card-title { font-size: 14px; color: #0f172a; line-height: 1.3; }
    .card.unread .card-title { font-weight: 800; }
    .snippet { font-size: 12.5px; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .snippet b { color: #334155; }
    .card-foot { display: flex; align-items: center; gap: 8px; }
    .new-tag { font-size: 11px; font-weight: 800; color: #a8620a; background: #fdf3e6; padding: 1px 8px; border-radius: 999px; }
    .rate-tag { font-size: 11px; font-weight: 800; color: #5b6b12; background: #f2f7e1; padding: 1px 8px; border-radius: 999px; }
    .list-empty { text-align: center; color: #94a3b8; padding: 30px 10px; }
    .list-empty p { font-size: 13px; margin: 8px 0 0; }

    .pill { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
    .pill.received { background: #f1f5f9; color: #475569; }
    .pill.working { background: #eef4fc; color: #0f4b92; }
    .pill.answered { background: #fdf3e6; color: #a8620a; }
    .pill.done { background: #f2f7e1; color: #5b6b12; }

    /* Detalle */
    .d-head { display: flex; justify-content: space-between; gap: 12px; padding: 18px 22px 12px; border-bottom: 1px solid #f1f5f9; }
    .d-title h2 { margin: 2px 0 3px; font-size: 19px; font-weight: 800; color: #0f172a; }
    .d-meta { font-size: 12.5px; color: #64748b; }
    .full-link { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #64748b; background: #f1f5f9; flex-shrink: 0; }
    .full-link:hover { color: #0f4b92; background: #eef4fc; }

    .steps { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); margin: 0; padding: 14px 22px 4px; }
    .steps li { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 3px; }
    .steps li:not(:last-child)::after { content: ''; position: absolute; top: 11px; left: calc(50% + 14px); right: calc(-50% + 14px); height: 2px; background: #e2e8f0; }
    .steps li.done:not(:last-child)::after { background: #a9c238; }
    .dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #cbd5e1; background: #fff; display: flex; align-items: center; justify-content: center; color: #fff; z-index: 1; }
    .done .dot { background: #a9c238; border-color: #a9c238; }
    .current .dot { border-color: #0f4b92; box-shadow: 0 0 0 4px rgba(15,75,146,0.12); }
    .s-label { font-size: 12.5px; font-weight: 700; color: #334155; }
    .current .s-label { color: #0f4b92; }
    .s-detail { font-size: 11px; color: #94a3b8; min-height: 14px; }

    .sla-note { display: flex; align-items: center; gap: 8px; margin: 10px 22px 0; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; }
    .sla-note.ok { background: #f2f7e1; color: #5b6b12; }
    .sla-note.wait { background: #eef4fc; color: #0f4b92; }
    .sla-note.late { background: #fdf3e6; color: #a8620a; }

    .thread { flex: 1; overflow-y: auto; padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; }
    .msg { display: flex; gap: 10px; align-items: flex-end; max-width: 80%; }
    .msg.mine { align-self: flex-end; flex-direction: row-reverse; }
    .av { width: 30px; height: 30px; border-radius: 50%; background: #0f4b92; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bubble { background: #f1f5f9; border-radius: 14px 14px 14px 4px; padding: 10px 13px; display: flex; flex-direction: column; gap: 4px; }
    .mine .bubble { background: #0f4b92; color: #fff; border-radius: 14px 14px 4px 14px; }
    .who { font-size: 11.5px; font-weight: 700; color: #64748b; }
    .mine .who { color: #c9dcf4; }
    .bubble p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .att { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: inherit; text-decoration: underline; }
    .att small { opacity: 0.7; }
    .loading { font-size: 13px; color: #94a3b8; text-align: center; }

    .rate { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 22px 10px; padding: 12px 14px; background: #f8fafc; border-radius: 12px; font-size: 13.5px; color: #334155; }
    .stars { display: inline-flex; gap: 2px; color: #cbd5e1; }
    .stars .on { color: #f59e0b; }
    .stars.interactive button { border: none; background: none; padding: 0; cursor: pointer; color: #cbd5e1; display: inline-flex; }
    .rate-comment { flex: 1; min-width: 160px; padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 13px; font-family: inherit; }

    .reply { border-top: 1px solid #f1f5f9; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .reply textarea { width: 100%; box-sizing: border-box; resize: none; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; }
    .reply textarea:focus { border-color: #0f4b92; }
    .reply-bar { display: flex; align-items: center; gap: 8px; }
    .attach { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #64748b; background: #f1f5f9; cursor: pointer; }
    .attach:hover { color: #0f4b92; }
    .file-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; background: #eef4fc; color: #0f4b92; padding: 4px 8px; border-radius: 8px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-chip button { border: none; background: none; color: inherit; cursor: pointer; display: inline-flex; padding: 0; }
    .btn-send { display: inline-flex; align-items: center; gap: 6px; border: none; background: #0f4b92; color: #fff; padding: 9px 16px; border-radius: 10px; font-weight: 700; font-size: 13.5px; cursor: pointer; }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .detail-empty { margin: auto; text-align: center; color: #94a3b8; padding: 30px; }
    .detail-empty h3 { margin: 10px 0 4px; color: #334155; font-size: 16px; }
    .detail-empty p { margin: 0; font-size: 13.5px; }

    /* Pantallas angostas: solo la lista (al tocar se abre el detalle completo). */
    @media (max-width: 1023px) {
      .inbox { grid-template-columns: 1fr; height: auto; min-height: 0; }
      .detail-pane { display: none; }
      .cards { overflow: visible; }
    }
    @media (max-width: 560px) {
      .btn-new { width: 100%; justify-content: center; }
    }
  `]
})
export class ClientTicketsComponent {
  /** Ticket recién creado: se selecciona automáticamente. */
  focusId = input<string | null>(null);
  create = output<void>();
  /** Pide el recorrido guiado sobre esta pantalla. */
  guide = output<void>();

  private auth = inject(AuthService);
  private ticketService = inject(TicketService);
  private notify = inject(NotificationService);
  private router = inject(Router);

  readonly maxSize = MAX_ATTACHMENT_SIZE;
  fileIcon = fileIcon;
  formatFileSize = formatFileSize;
  initialsOf = initials;
  isClosed = isClosed;

  tab = signal<Tab>('open');
  search = signal('');
  selectedId = signal<string | null>(null);
  detailLoaded = signal(new Set<string>());
  busy = signal(false);
  file = signal<File | null>(null);
  rating = signal(0);
  hover = signal(0);
  reply = '';
  ratingComment = '';
  private wide = signal(typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  constructor() {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => this.wide.set(e.matches);
    mq.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener('change', onChange));

    // En pantalla ancha siempre hay una solicitud abierta en el panel derecho.
    effect(() => {
      const list = this.list();
      const current = this.selectedId();
      if (!this.wide() || !list.length) return;
      // Al cambiar de pestaña o filtrar, el panel derecho sigue a la lista visible.
      if (!current || !list.some(t => t.id === current)) untracked(() => this.select(list[0].id));
    });
    // Ticket recién creado: cambia a "Abiertas" y lo selecciona.
    effect(() => {
      const id = this.focusId();
      if (!id) return;
      untracked(() => { this.tab.set('open'); this.select(id); });
    });
  }

  slaHours = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    return id ? this.ticketService.getSlaHoursForCompany(id) : 24;
  });

  private mine = computed(() => {
    const id = this.auth.currentUser()?.companyId;
    return id ? this.ticketService.getByCompany(id) : [];
  });

  openCount = computed(() => this.mine().filter(t => !isClosed(t)).length);
  resolvedCount = computed(() => this.mine().filter(isClosed).length);
  answeredCount = computed(() => this.mine().filter(t => this.hasNewReply(t)).length);

  /** Abiertas: primero las que tienen respuesta nueva; luego por actividad reciente. */
  list = computed(() => {
    const s = this.search().trim().toLowerCase().replace(/^#/, '');
    return this.mine()
      .filter(t => (this.tab() === 'open' ? !isClosed(t) : isClosed(t)))
      .filter(t => !s || t.title.toLowerCase().includes(s) || t.id.toLowerCase().includes(s))
      .sort((a, b) => Number(this.hasNewReply(b)) - Number(this.hasNewReply(a)) || b.updatedAt.localeCompare(a.updatedAt));
  });

  selected = computed(() => {
    const id = this.selectedId();
    return id ? this.mine().find(t => t.id === id) ?? null : null;
  });

  hasNewReply(t: Ticket): boolean {
    return !isClosed(t) && t.lastResponse?.authorRole === 'owner';
  }

  ago(iso: string) { return 'hace ' + span(Date.now() - new Date(iso).getTime()); }

  /** Estado en lenguaje del cliente (sin jerga interna). */
  statusLabel(t: Ticket): string {
    if (t.status === 'closed') return 'Cerrada';
    if (t.status === 'resolved') return 'Resuelta';
    if (this.hasNewReply(t)) return 'Te respondimos';
    if (t.status === 'in_review' || t.status === 'escalated' || t.assignedTo) return 'En revisión';
    return 'Recibida';
  }

  statusTone(t: Ticket): string {
    if (isClosed(t)) return 'done';
    if (this.hasNewReply(t)) return 'answered';
    if (t.status === 'in_review' || t.status === 'escalated' || t.assignedTo) return 'working';
    return 'received';
  }

  steps(t: Ticket): Step[] {
    const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : '');
    // Pasos alcanzados en verde; el siguiente pendiente, resaltado. Si alguien ya
    // respondió, la solicitud cuenta como asignada aunque nadie la haya tomado formalmente.
    const reached = [true, !!t.assignedTo || !!t.firstResponseAt, !!t.firstResponseAt, isClosed(t)];
    const next = reached.indexOf(false);
    return [
      { label: 'Recibida', detail: fmt(t.createdAt) },
      { label: 'Asignada', detail: t.assignedTo?.name.split(' ')[0] ?? '' },
      { label: 'En atención', detail: fmt(t.firstResponseAt) },
      { label: 'Resuelta', detail: fmt(t.resolvedAt) },
    ].map((s, i) => ({ ...s, done: reached[i], current: i === next }));
  }

  /** El SLA explicado al cliente: promesa, cumplimiento o retraso (sin la palabra "vencido"). */
  slaInfo(t: Ticket): { tone: string; icon: IconName; text: string } {
    if (t.firstResponseAt) {
      const took = span(new Date(t.firstResponseAt).getTime() - new Date(t.createdAt).getTime());
      return { tone: 'ok', icon: 'check', text: `Te respondimos en ${took}.` };
    }
    if (isClosed(t)) return { tone: 'ok', icon: 'check', text: 'Solicitud resuelta.' };
    if (this.ticketService.isSlaBreached(t)) {
      return { tone: 'late', icon: 'clock', text: 'Nuestra respuesta va con retraso; ya la estamos priorizando.' };
    }
    const due = new Date(t.slaDeadline).toLocaleString('es-GT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return { tone: 'wait', icon: 'clock', text: `Te responderemos a más tardar el ${due}` };
  }

  async select(id: string) {
    if (!this.wide()) { this.router.navigate(['/tickets', id]); return; }
    if (this.selectedId() !== id) { this.reply = ''; this.file.set(null); this.rating.set(0); this.ratingComment = ''; }
    this.selectedId.set(id);
    if (this.detailLoaded().has(id)) return;
    try {
      await this.ticketService.loadDetail(id);
      this.detailLoaded.update(s => new Set(s).add(id));
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }

  pickFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_SIZE) { this.notify.error(`El archivo es muy pesado (máximo ${formatFileSize(MAX_ATTACHMENT_SIZE)}).`); return; }
    this.file.set(f);
  }

  async send(t: Ticket) {
    const content = this.reply.trim();
    if (!content) return;
    this.busy.set(true);
    try {
      await this.ticketService.addResponse(t.id, content, this.file() ?? undefined);
      await this.ticketService.load(); // refresca vistas previas y orden de la lista
      this.reply = '';
      this.file.set(null);
      this.notify.success('Mensaje enviado. El equipo fue notificado.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  async rate(t: Ticket) {
    if (!this.rating()) return;
    this.busy.set(true);
    try {
      await this.ticketService.rateSatisfaction(t.id, this.rating(), this.ratingComment.trim() || undefined);
      this.notify.success('¡Gracias por tu calificación!');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
