import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyService, CompanyInput } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { TicketService, SLA_HOURS_BY_PLAN } from '../../core/services/ticket.service';
import { UserService } from '../../core/services/user.service';
import { Company, CompanyPlan, Ticket } from '../../core/models';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { IconComponent } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { TicketStatusLabelPipe } from '../../shared/pipes/labels.pipe';
import { projectSchedule } from '../../shared/utils/project-health';
import { companyHealth } from '../../shared/utils/company-health';

type Tab = 'all' | 'active' | 'attention' | 'inactive';
type Sort = 'health' | 'name' | 'tickets' | 'recent';

const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
const SLA_OPTIONS: { value: CompanyPlan; hours: number; hint: string }[] = [
  { value: 'Premium', hours: 4, hint: 'Prioritario' },
  { value: 'Standard', hours: 12, hint: 'Estándar' },
  { value: 'Basic', hours: 24, hint: 'Básico' },
];

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent, ModalFocusTrapDirective, TicketStatusLabelPipe],
  template: `
    <div class="companies-page">
      <div class="page-header">
        <div>
          <h1>Empresas</h1>
          <p>Tus clientes de un vistazo: cómo están, qué tienen en curso y quién los atiende</p>
        </div>
        <button class="btn-primary" (click)="openModal()">
          <app-icon name="plus" [size]="16" /> Nueva empresa
        </button>
      </div>

      <!-- Resumen -->
      <div class="summary">
        <div class="sum-item"><strong>{{ activeCount() }}</strong><span>Clientes activos</span></div>
        <div class="sum-item" [class.alert]="attentionCount() > 0"><strong>{{ attentionCount() }}</strong><span>Necesitan atención</span></div>
        <div class="sum-item"><strong>{{ totals().activeProjects }}</strong><span>Proyectos en curso</span></div>
        <div class="sum-item"><strong>{{ totals().openTickets }}</strong><span>Tickets abiertos</span></div>
        <div class="sum-item"><strong>{{ totals().users }}</strong><span>Usuarios con acceso</span></div>
      </div>

      <!-- Filtros -->
      <div class="toolbar">
        <div class="tabs" role="tablist" aria-label="Filtrar empresas">
          @for (t of tabs; track t.value) {
            <button role="tab" [class.active]="tab() === t.value" [attr.aria-selected]="tab() === t.value" (click)="tab.set(t.value)">
              {{ t.label }} <span class="count" [class.red]="t.value === 'attention' && tabCount(t.value) > 0">{{ tabCount(t.value) }}</span>
            </button>
          }
        </div>
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="company-search" class="sr-only">Buscar empresa</label>
          <input id="company-search" type="text" placeholder="Buscar por nombre, correo o teléfono..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="company-sort" class="sr-only">Ordenar</label>
        <select id="company-sort" class="filter-select" (change)="sort.set($any($event.target).value)">
          <option value="health">Primero las que necesitan atención</option>
          <option value="name">Nombre (A–Z)</option>
          <option value="tickets">Más tickets abiertos</option>
          <option value="recent">Clientes más recientes</option>
        </select>
      </div>

      <!-- Tarjetas -->
      <div class="grid">
        @for (c of rows(); track c.id) {
          <article class="card" [class.inactive]="c.status === 'inactive'" [class]="'lvl-' + c.health.level"
            tabindex="0" role="button" [attr.aria-label]="'Ver ficha de ' + c.name"
            (click)="openDrawer(c.id)" (keydown.enter)="openDrawer(c.id)">
            <div class="card-top">
              <span class="logo" [class.has-logo]="c.logo" [style.background]="c.logo ? '#fff' : avatarColor(c.id)">
                @if (c.logo) { <img [src]="c.logo" [alt]="'Logo de ' + c.name"> } @else { {{ c.name[0] }} }
              </span>
              <div class="title">
                <h3>{{ c.name }}</h3>
                <span class="sub"><span class="status-dot" [class.off]="c.status === 'inactive'"></span>{{ c.status === 'active' ? 'Activa' : 'Inactiva' }} · cliente desde {{ c.since | date:'MMM y' }}</span>
              </div>
              <span class="score" [class]="c.health.level" [title]="'Salud: ' + c.health.levelLabel">{{ c.health.score }}</span>
            </div>

            <div class="metrics">
              <div><strong>{{ c.projectsActive }}</strong><span>Proyectos<br>en curso</span></div>
              <div [class.warn]="c.health.breached > 0"><strong>{{ c.ticketsOpen }}</strong><span>Tickets<br>abiertos</span></div>
              <div><strong>{{ c.userCount }}</strong><span>Usuarios</span></div>
              <div><strong>{{ c.health.csat !== null ? c.health.csat : '—' }}</strong><span>Satisfacción</span></div>
            </div>

            @if (c.projectsActive) {
              <div class="avg">
                <div class="avg-top"><span>Avance promedio de proyectos</span><strong>{{ c.avgProgress }}%</strong></div>
                <div class="avg-bar"><div [style.width.%]="c.avgProgress"></div></div>
              </div>
            }

            <div class="alert-line" [class]="c.health.level">
              <app-icon [name]="c.health.level === 'good' ? 'check' : 'alert-triangle'" [size]="13" />
              {{ c.health.reasons || 'Sin alertas: todo en orden' }}
            </div>

            <div class="card-foot">
              <span class="sla"><app-icon name="clock" [size]="12" /> Respuesta en {{ slaHours(c.plan) }} h</span>
              <div class="actions">
                <button class="btn-icon" (keydown.enter)="$event.stopPropagation()" (click)="$event.stopPropagation(); editCompany(c)" aria-label="Editar empresa" title="Editar"><app-icon name="edit" [size]="14" /></button>
                <button class="btn-icon danger" (keydown.enter)="$event.stopPropagation()" (click)="$event.stopPropagation(); deleteCompany(c.id, c.name)" aria-label="Eliminar empresa" title="Eliminar"><app-icon name="trash" [size]="14" /></button>
              </div>
            </div>
          </article>
        } @empty {
          <div class="empty-state grid-span">
            <div class="empty-icon"><app-icon name="building" [size]="32" /></div>
            <h3>{{ tab() === 'attention' ? '¡Ningún cliente necesita atención!' : 'Sin empresas' }}</h3>
            <p>{{ tab() === 'attention' ? 'Todos tus clientes activos están sanos.' : 'No hay empresas que coincidan con tu búsqueda.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- Ficha lateral -->
    @if (selected(); as s) {
      <div class="drawer-overlay" (click)="closeDrawer()">
        <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"
          appModalFocusTrap (closeRequested)="closeDrawer()" (click)="$event.stopPropagation()">
          <header class="drawer-head">
            <span class="logo lg" [class.has-logo]="s.logo" [style.background]="s.logo ? '#fff' : avatarColor(s.id)">
              @if (s.logo) { <img [src]="s.logo" alt=""> } @else { {{ s.name[0] }} }
            </span>
            <div class="title">
              <h2 id="drawer-title">{{ s.name }}</h2>
              <span class="sub"><span class="status-dot" [class.off]="s.status === 'inactive'"></span>{{ s.status === 'active' ? 'Activa' : 'Inactiva' }} · cliente desde {{ s.since | date:'d MMM y' }}</span>
            </div>
            <button class="btn-icon" (click)="editCompany(s)" aria-label="Editar empresa" title="Editar"><app-icon name="edit" [size]="15" /></button>
            <button class="btn-icon" (click)="closeDrawer()" aria-label="Cerrar ficha"><app-icon name="x" [size]="16" /></button>
          </header>

          <div class="drawer-body">
            <div class="health-box" [class]="s.health.level">
              <span class="big-score">{{ s.health.score }}</span>
              <div>
                <strong>Salud del cliente: {{ s.health.levelLabel }}</strong>
                <span>{{ s.health.reasons || 'Sin tickets vencidos ni proyectos en riesgo.' }}</span>
              </div>
            </div>

            <section class="d-section">
              <h4>Contacto</h4>
              <a class="contact" [href]="'mailto:' + s.email"><app-icon name="mail" [size]="14" /> {{ s.email }}</a>
              <a class="contact" [href]="'tel:' + s.phone"><app-icon name="phone" [size]="14" /> {{ s.phone }}</a>
              @if (s.address) { <span class="contact"><app-icon name="map-pin" [size]="14" /> {{ s.address }}</span> }
              <span class="contact"><app-icon name="clock" [size]="14" /> Tiempo de respuesta garantizado: {{ slaHours(s.plan) }} h</span>
            </section>

            <section class="d-section">
              <h4>Proyectos <span class="count">{{ s.projects.length }}</span></h4>
              @for (p of s.projects; track p.id) {
                <a class="d-row" [routerLink]="['/projects', p.id]">
                  <div class="d-row-main">
                    <div class="d-row-top"><strong>{{ p.name }}</strong><span class="tone" [class]="p.tone">{{ p.label }}</span></div>
                    <div class="pbar"><div [class]="p.tone" [style.width.%]="p.progress"></div></div>
                  </div>
                  <span class="d-pct">{{ p.progress }}%</span>
                </a>
              } @empty { <p class="d-empty">Sin proyectos.</p> }
            </section>

            <section class="d-section">
              <h4>Tickets abiertos <span class="count" [class.red]="s.health.breached > 0">{{ s.openTickets.length }}</span></h4>
              @for (t of s.openTickets; track t.id) {
                <a class="d-row" [routerLink]="['/tickets', t.id]">
                  <span class="prio" [class]="t.priority"></span>
                  <div class="d-row-main">
                    <strong>{{ t.title }}</strong>
                    <small>#{{ t.id }} · {{ t.status | ticketStatusLabel }} · {{ t.assignedTo?.name ?? 'Sin asignar' }}</small>
                  </div>
                  @if (isBreached(t)) { <span class="tone late">Vencido</span> }
                </a>
              } @empty { <p class="d-empty">Sin tickets abiertos.</p> }
            </section>

            <section class="d-section">
              <h4>Usuarios con acceso <span class="count">{{ s.users.length }}</span></h4>
              @for (u of s.users; track u.id) {
                <div class="user"><span class="u-av">{{ u.name[0] }}</span><div><strong>{{ u.name }}</strong><small>&#64;{{ u.username }} · {{ u.email }}</small></div></div>
              } @empty { <p class="d-empty">Todavía nadie de esta empresa puede iniciar sesión.</p> }
              <a routerLink="/users" class="link"><app-icon name="users" [size]="14" /> Gestionar usuarios</a>
            </section>
          </div>

          <footer class="drawer-foot">
            <button class="btn-danger-text" (click)="deleteCompany(s.id, s.name)"><app-icon name="trash" [size]="14" /> Eliminar empresa</button>
          </footer>
        </aside>
      </div>
    }

    <!-- Crear / editar -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="company-modal-title">{{ editingId() ? 'Editar empresa' : 'Nueva empresa' }}</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveCompany()" class="modal-body" novalidate>
            <div class="identity">
              <label class="logo-drop" for="company-logo" [class.has-logo]="form.value.logo">
                @if (form.value.logo) { <img [src]="form.value.logo" alt="Logo de la empresa"> }
                @else { <app-icon name="image" [size]="22" /><span>Logo</span> }
                <input id="company-logo" type="file" accept="image/*" (change)="onLogoSelected($event)" hidden>
              </label>
              <div class="identity-fields">
                <label for="company-name">Nombre de la empresa *</label>
                <input id="company-name" type="text" formControlName="name" placeholder="Ej: TechSolutions S.A."
                  [class.error]="invalid('name')" [attr.aria-invalid]="invalid('name')">
                @if (invalid('name')) { <span class="field-error">El nombre es obligatorio.</span> }
                <span class="hint">Logo opcional: PNG o JPG, máximo 500 KB.
                  @if (form.value.logo) { <button type="button" class="link-btn" (click)="clearLogo()">Quitar logo</button> }
                </span>
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label for="company-email">Correo de contacto *</label>
                <input id="company-email" type="email" formControlName="email" placeholder="contacto@empresa.com"
                  [class.error]="invalid('email')" [attr.aria-invalid]="invalid('email')">
                @if (invalid('email')) { <span class="field-error">{{ emailErrorMessage() }}</span> }
              </div>
              <div class="form-group">
                <label for="company-phone">Teléfono *</label>
                <input id="company-phone" type="text" formControlName="phone" placeholder="+507 6000-0000"
                  [class.error]="invalid('phone')" [attr.aria-invalid]="invalid('phone')">
                @if (invalid('phone')) { <span class="field-error">El teléfono es obligatorio.</span> }
              </div>
              <div class="form-group full">
                <label for="company-address">Dirección</label>
                <input id="company-address" type="text" formControlName="address" placeholder="Ciudad, zona, edificio...">
              </div>
            </div>

            <div class="form-group">
              <span class="field-label">Tiempo de respuesta garantizado (SLA)</span>
              <div class="sla-picker" role="radiogroup" aria-label="Tiempo de respuesta">
                @for (o of slaOptions; track o.value) {
                  <button type="button" role="radio" [attr.aria-checked]="form.value.plan === o.value" [class.active]="form.value.plan === o.value"
                    (click)="form.patchValue({ plan: o.value })">
                    <strong>{{ o.hours }} h</strong><span>{{ o.hint }}</span>
                  </button>
                }
              </div>
            </div>

            <label class="switch-row">
              <span>
                <strong>Empresa activa</strong>
                <small>Si la desactivas, deja de contar en los resúmenes, pero sus datos se conservan.</small>
              </span>
              <input type="checkbox" class="switch" [checked]="form.value.status === 'active'"
                (change)="form.patchValue({ status: $any($event.target).checked ? 'active' : 'inactive' })">
            </label>

            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ editingId() ? 'Guardar cambios' : 'Crear empresa' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .companies-page { max-width: var(--page-max-width); margin: 0 auto; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

    /* Resumen */
    .summary { display: grid; grid-template-columns: repeat(5, 1fr); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 16px; overflow: hidden; }
    .sum-item { padding: 14px 18px; display: flex; flex-direction: column; border-right: 1px solid #f1f5f9; }
    .sum-item:last-child { border-right: none; }
    .sum-item strong { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.15; }
    .sum-item span { font-size: 12.5px; color: #64748b; }
    .sum-item.alert strong { color: #dc2626; }

    /* Filtros */
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .tabs { display: inline-flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; }
    .tabs button { border: none; background: none; padding: 7px 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .tabs button.active { background: #0f4b92; color: #fff; }
    .count { background: #f1f5f9; color: #475569; border-radius: 999px; padding: 0 8px; font-size: 11.5px; font-weight: 700; }
    .tabs button.active .count { background: rgba(255,255,255,0.22); color: #fff; }
    .count.red { background: #fee2e2; color: #dc2626; }
    .toolbar .search-wrap { flex: 1; min-width: 220px; }

    /* Tarjetas */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid #a9c238; border-radius: 16px; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; cursor: pointer; transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; outline: none; }
    .card.lvl-watch { border-top-color: #e99d34; }
    .card.lvl-danger { border-top-color: #ef4444; }
    .card.inactive { border-top-color: #cbd5e1; opacity: 0.75; }
    .card:hover, .card:focus-visible { box-shadow: 0 10px 26px rgba(15,75,146,0.1); transform: translateY(-2px); }
    .card:focus-visible { border-color: #0f4b92; }
    .card-top { display: flex; align-items: center; gap: 12px; }
    .logo { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 800; color: #fff; overflow: hidden; }
    .logo.has-logo { box-shadow: inset 0 0 0 1.5px #e2e8f0; }
    .logo img { width: 100%; height: 100%; object-fit: contain; padding: 4px; box-sizing: border-box; }
    .logo.lg { width: 56px; height: 56px; font-size: 22px; border-radius: 14px; }
    .title { flex: 1; min-width: 0; }
    .title h3 { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title h2 { margin: 0; font-size: 19px; font-weight: 800; color: #0f172a; }
    .sub { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #a9c238; }
    .status-dot.off { background: #94a3b8; }
    .score { min-width: 42px; height: 30px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; font-size: 13.5px; font-weight: 800; color: #fff; flex-shrink: 0; }
    .score.good { background: #a9c238; }
    .score.watch { background: #e99d34; }
    .score.danger { background: #ef4444; }

    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); background: #f8fafc; border-radius: 12px; padding: 10px 4px; }
    .metrics div { display: flex; flex-direction: column; align-items: center; text-align: center; border-right: 1px solid #eef2f7; }
    .metrics div:last-child { border-right: none; }
    .metrics strong { font-size: 18px; font-weight: 800; color: #0f172a; }
    .metrics span { font-size: 10.5px; color: #64748b; line-height: 1.25; }
    .metrics .warn strong { color: #dc2626; }

    .avg-top { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 5px; }
    .avg-top strong { color: #0f172a; }
    .avg-bar { height: 7px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .avg-bar div { height: 100%; background: #0f4b92; border-radius: 999px; }

    .alert-line { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; padding: 7px 10px; border-radius: 9px; }
    .alert-line.good { background: #f2f7e1; color: #5b6b12; }
    .alert-line.watch { background: #fdf3e6; color: #a8620a; }
    .alert-line.danger { background: #fee2e2; color: #dc2626; }

    .card-foot { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
    .sla { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #475569; font-weight: 600; }
    .actions { display: flex; gap: 4px; }
    .btn-icon { width: 30px; height: 30px; border-radius: 8px; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; transition: background 0.2s, color 0.2s; }
    .btn-icon:hover { background: #d1e4fa; color: #0f4b92; }
    .btn-icon.danger:hover { background: #fee2e2; color: #dc2626; }

    /* Ficha lateral */
    .drawer-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.35); z-index: 200; display: flex; justify-content: flex-end; animation: fade 0.2s ease; }
    .drawer { width: 460px; max-width: 100%; height: 100%; background: #fff; display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(15,23,42,0.18); animation: slide 0.25s ease; }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .drawer, .drawer-overlay { animation: none; } }
    .drawer-head { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #f1f5f9; }
    .drawer-body { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 20px; }
    .drawer-foot { padding: 14px 20px; border-top: 1px solid #f1f5f9; }
    .health-box { display: flex; align-items: center; gap: 14px; border-radius: 14px; padding: 14px 16px; }
    .health-box.good { background: #f2f7e1; color: #5b6b12; }
    .health-box.watch { background: #fdf3e6; color: #8a520a; }
    .health-box.danger { background: #fee2e2; color: #b91c1c; }
    .health-box div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
    .big-score { font-size: 32px; font-weight: 800; line-height: 1; }
    .d-section h4 { display: flex; align-items: center; gap: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin: 0 0 10px; }
    .contact { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #334155; text-decoration: none; padding: 4px 0; }
    a.contact:hover { color: #0f4b92; }
    .contact app-icon { color: #94a3b8; }
    .d-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px; text-decoration: none; color: inherit; margin: 0 -10px; }
    .d-row:hover { background: #f8fafc; }
    .d-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .d-row-main strong { font-size: 13.5px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .d-row-main small { font-size: 12px; color: #64748b; }
    .d-row-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .d-pct { font-weight: 800; font-size: 13px; color: #0f172a; width: 38px; text-align: right; }
    .tone { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: #f2f7e1; color: #5b6b12; flex-shrink: 0; }
    .tone.risk { background: #fdf3e6; color: #b06a0c; }
    .tone.late { background: #fee2e2; color: #dc2626; }
    .tone.done { background: #eef4fc; color: #0f4b92; }
    .tone.paused, .tone.upcoming { background: #f1f5f9; color: #64748b; }
    .pbar { height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .pbar div { height: 100%; border-radius: 999px; background: #a9c238; }
    .pbar div.risk { background: #e99d34; }
    .pbar div.late { background: #ef4444; }
    .pbar div.done { background: #0f4b92; }
    .pbar div.paused, .pbar div.upcoming { background: #94a3b8; }
    .prio { width: 4px; align-self: stretch; border-radius: 4px; background: #94a3b8; flex-shrink: 0; }
    .prio.critical { background: #ef4444; }
    .prio.high { background: #f97316; }
    .prio.medium { background: #e99d34; }
    .prio.low { background: #a9c238; }
    .user { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
    .user div { display: flex; flex-direction: column; min-width: 0; }
    .user strong { font-size: 13.5px; color: #0f172a; }
    .user small { font-size: 12px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .u-av { width: 30px; height: 30px; border-radius: 50%; background: #0f4b92; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .d-empty { font-size: 13px; color: #94a3b8; margin: 0; }
    .link { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; font-weight: 700; color: #0f4b92; text-decoration: none; }
    .btn-danger-text { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: #dc2626; font-weight: 700; font-size: 13px; cursor: pointer; padding: 6px 0; }

    /* Formulario */
    .identity { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 18px; }
    .logo-drop { width: 84px; height: 84px; border-radius: 16px; border: 2px dashed #cbd5e1; background: #f8fafc; color: #94a3b8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; overflow: hidden; transition: border-color 0.2s; }
    .logo-drop:hover { border-color: #0f4b92; color: #0f4b92; }
    .logo-drop.has-logo { border-style: solid; background: #fff; }
    .logo-drop img { width: 100%; height: 100%; object-fit: contain; padding: 6px; box-sizing: border-box; }
    .identity-fields { flex: 1; display: flex; flex-direction: column; gap: 6px; }
    .hint { font-size: 12px; color: #94a3b8; }
    .link-btn { background: none; border: none; color: #dc2626; font-weight: 600; cursor: pointer; padding: 0 0 0 6px; font-size: 12px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; margin-bottom: 18px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label, .field-label { font-size: 13px; font-weight: 600; color: #374151; }
    .modal-body input[type=text], .modal-body input[type=email] { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; }
    .modal-body select { padding: 10px 12px; font-size: 14px; width: 100%; box-sizing: border-box; font-family: inherit; }
    .modal-body input:focus { border-color: #0f4b92; }
    .sla-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .sla-picker button { border: 1.5px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 10px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: inherit; }
    .sla-picker strong { font-size: 18px; color: #0f172a; }
    .sla-picker span { font-size: 12px; color: #64748b; }
    .sla-picker button.active { border-color: #0f4b92; background: #eef4fc; }
    .sla-picker button.active strong { color: #0f4b92; }
    .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer; }
    .switch-row span { display: flex; flex-direction: column; gap: 2px; }
    .switch-row strong { font-size: 13.5px; color: #0f172a; }
    .switch-row small { font-size: 12px; color: #64748b; font-weight: 400; }
    .switch { appearance: none; width: 42px; height: 24px; border-radius: 999px; background: #cbd5e1; position: relative; cursor: pointer; flex-shrink: 0; transition: background 0.2s; }
    .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; }
    .switch:checked { background: #a9c238; }
    .switch:checked::after { left: 21px; }

    @media (max-width: 900px) { .summary { grid-template-columns: repeat(3, 1fr); } .sum-item:nth-child(3) { border-right: none; } }
    @media (max-width: 640px) {
      .summary { grid-template-columns: 1fr 1fr; }
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
      .grid { grid-template-columns: 1fr; }
    }
  `]
})
export class CompaniesComponent {
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private ticketService = inject(TicketService);
  private userService = inject(UserService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  readonly tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'attention', label: 'Necesitan atención' },
    { value: 'active', label: 'Activas' },
    { value: 'inactive', label: 'Inactivas' },
  ];
  readonly slaOptions = SLA_OPTIONS;

  companies = this.companyService.companies;
  search = signal('');
  tab = signal<Tab>('all');
  sort = signal<Sort>('health');
  selectedId = signal<string | null>(null);
  showModal = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  /** Cambio pendiente de logo: File = subir, null = quitar, undefined = sin cambios. */
  private logoChange: File | null | undefined;

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    plan: ['Standard' as CompanyPlan],
    status: ['active' as 'active' | 'inactive'],
    /** Solo para la vista previa (URL existente o local del archivo elegido). */
    logo: ['']
  });

  constructor() {
    loadPageData(this.notify, this.companyService.load(), this.projectService.load(), this.ticketService.load(), this.userService.load());
  }

  slaHours(plan?: CompanyPlan): number { return SLA_HOURS_BY_PLAN[plan ?? 'Standard']; }
  isBreached(t: Ticket) { return this.ticketService.isSlaBreached(t); }

  /** Cada empresa con sus números: base de las tarjetas, los filtros y la ficha. */
  private enriched = computed(() => {
    const projects = this.projectService.getAll();
    const tickets = this.ticketService.getAll();
    const users = this.userService.users();
    return this.companies().map(c => {
      const cp = projects.filter(p => p.companyId === c.id);
      const ct = tickets.filter(t => t.companyId === c.id);
      const active = cp.filter(p => p.status !== 'completed');
      const openTickets = ct.filter(t => !isClosed(t));
      return {
        ...c,
        since: new Date(c.createdAt),
        health: companyHealth(ct, cp, t => this.ticketService.isSlaBreached(t)),
        projectsActive: active.length,
        projectCount: cp.length,
        avgProgress: active.length ? Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length) : 0,
        ticketsOpen: openTickets.length,
        userCount: users.filter(u => u.companyId === c.id).length,
      };
    });
  });

  activeCount = computed(() => this.enriched().filter(c => c.status === 'active').length);
  attentionCount = computed(() => this.tabCount('attention'));

  totals = computed(() => {
    const active = this.enriched().filter(c => c.status === 'active');
    return {
      activeProjects: active.reduce((s, c) => s + c.projectsActive, 0),
      openTickets: active.reduce((s, c) => s + c.ticketsOpen, 0),
      users: active.reduce((s, c) => s + c.userCount, 0),
    };
  });

  private inTab(c: ReturnType<typeof this.enriched>[number], tab: Tab): boolean {
    if (tab === 'active') return c.status === 'active';
    if (tab === 'inactive') return c.status === 'inactive';
    if (tab === 'attention') return c.status === 'active' && c.health.level !== 'good';
    return true;
  }

  tabCount(tab: Tab): number {
    return this.enriched().filter(c => this.inTab(c, tab)).length;
  }

  rows = computed(() => {
    const s = this.search().trim().toLowerCase();
    let list = this.enriched().filter(c => this.inTab(c, this.tab()));
    if (s) list = list.filter(c => [c.name, c.email, c.phone].some(v => v.toLowerCase().includes(s)));
    const sorted = list.slice();
    switch (this.sort()) {
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'tickets': sorted.sort((a, b) => b.ticketsOpen - a.ticketsOpen); break;
      case 'recent': sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break;
      default:
        // Activas antes que inactivas; dentro, el peor puntaje primero.
        sorted.sort((a, b) => Number(a.status === 'inactive') - Number(b.status === 'inactive') || a.health.score - b.health.score || a.name.localeCompare(b.name));
    }
    return sorted;
  });

  selected = computed(() => {
    const id = this.selectedId();
    const c = id ? this.enriched().find(x => x.id === id) : undefined;
    if (!c) return null;
    const order: Record<string, number> = { late: 0, risk: 1, ok: 2, upcoming: 3, paused: 4, done: 5 };
    return {
      ...c,
      projects: this.projectService.getAll().filter(p => p.companyId === c.id).map(p => {
        const s = projectSchedule(p);
        return { id: p.id, name: p.name, progress: p.progress, tone: s.tone, label: s.label };
      }).sort((a, b) => order[a.tone] - order[b.tone]),
      openTickets: this.ticketService.getAll().filter(t => t.companyId === c.id && !isClosed(t))
        .sort((a, b) => Number(this.isBreached(b)) - Number(this.isBreached(a)) || a.slaDeadline.localeCompare(b.slaDeadline)),
      users: this.userService.users().filter(u => u.companyId === c.id),
    };
  });

  private readonly avatarPalette = ['#0f4b92', '#a9c238', '#e99d34', '#0891b2', '#7c3aed', '#475569'];
  avatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return this.avatarPalette[hash % this.avatarPalette.length];
  }

  openDrawer(id: string) { this.selectedId.set(id); }
  closeDrawer() { this.selectedId.set(null); }

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  emailErrorMessage(): string {
    const c = this.form.get('email');
    if (c?.hasError('required')) return 'El correo es obligatorio.';
    if (c?.hasError('email')) return 'Ingresa un correo electrónico válido.';
    return '';
  }

  openModal() {
    this.editingId.set(null);
    this.logoChange = undefined;
    this.form.reset({ plan: 'Standard', status: 'active', logo: '' });
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editCompany(c: Company) {
    this.closeDrawer();
    this.editingId.set(c.id);
    this.logoChange = undefined;
    this.form.reset({ name: c.name, email: c.email, phone: c.phone, address: c.address ?? '', plan: c.plan, status: c.status, logo: c.logo ?? '' });
    this.showModal.set(true);
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.notify.error('El logo debe ser una imagen.');
      return;
    }
    if (file.size > 500 * 1024) {
      this.notify.error('La imagen es muy pesada (máximo 500KB).');
      return;
    }
    this.logoChange = file;
    this.form.patchValue({ logo: URL.createObjectURL(file) });
  }

  clearLogo() {
    // Al crear no hay logo que borrar en el servidor; al editar, se elimina.
    this.logoChange = this.editingId() ? null : undefined;
    this.form.patchValue({ logo: '' });
  }

  async saveCompany() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { logo: _preview, ...v } = this.form.getRawValue();
    const data: CompanyInput = {
      name: v.name!, email: v.email!, phone: v.phone!, address: v.address?.trim() ?? '',
      plan: v.plan!, status: v.status!,
    };
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.companyService.update(this.editingId()!, data, this.logoChange);
        this.notify.success('Empresa actualizada correctamente.');
      } else {
        await this.companyService.create(data, this.logoChange ?? undefined);
        this.notify.success('Empresa creada. Ahora crea sus usuarios para que puedan iniciar sesión.');
      }
      this.closeModal();
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteCompany(id: string, name: string) {
    const c = this.enriched().find(x => x.id === id);
    const parts = [
      c?.projectCount && `${c.projectCount} proyecto${c.projectCount !== 1 ? 's' : ''}`,
      'sus tickets',
      c?.userCount && `${c.userCount} cuenta${c.userCount !== 1 ? 's' : ''} de usuario`,
    ].filter(Boolean);
    const ok = await this.confirm.ask({
      title: 'Eliminar empresa',
      message: `¿Eliminar "${name}"? Esta acción no se puede deshacer. También se eliminarán ${parts.join(', ')}.`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      await this.companyService.delete(id);
      // El servidor borró en cascada sus proyectos y tickets: la caché local también.
      await Promise.all([this.projectService.load(), this.ticketService.load()]);
      this.closeDrawer();
      this.notify.success('Empresa eliminada correctamente.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }
}
