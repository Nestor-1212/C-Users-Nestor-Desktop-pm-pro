import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { CompanyService } from '../../core/services/company.service';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket, User } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';

type Tab = 'clients' | 'team';
interface Credentials { title: string; name: string; username: string; password: string }

const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
/** "Carlos López" → "carlos.lopez" (sin tildes ni símbolos). */
const suggestUsername = (name: string) => name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
/** Contraseña legible de 10 caracteres, sin caracteres confusos (0/O, 1/l). */
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(9));
  return Array.from(bytes, b => chars[b % chars.length]).join('') + '#';
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, ModalFocusTrapDirective],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Quién puede entrar al sistema: las personas de tus clientes y tu equipo técnico</p>
        </div>
        <button class="btn-primary" (click)="openModal(tab() === 'team' ? 'technician' : 'client')">
          <app-icon name="plus" [size]="16" /> {{ tab() === 'team' ? 'Nuevo técnico' : 'Nuevo usuario' }}
        </button>
      </div>

      <div class="toolbar">
        <div class="tabs" role="tablist" aria-label="Tipo de cuenta">
          <button role="tab" [class.active]="tab() === 'clients'" [attr.aria-selected]="tab() === 'clients'" (click)="tab.set('clients')">
            <app-icon name="building" [size]="15" /> Clientes <span class="count">{{ clientUsers().length }}</span>
          </button>
          <button role="tab" [class.active]="tab() === 'team'" [attr.aria-selected]="tab() === 'team'" (click)="tab.set('team')">
            <app-icon name="settings" [size]="15" /> Equipo 3TECH <span class="count">{{ technicians().length }}</span>
          </button>
        </div>
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="user-search" class="sr-only">Buscar usuario</label>
          <input id="user-search" type="text" class="search-input" [placeholder]="tab() === 'team' ? 'Buscar técnico...' : 'Buscar por nombre, usuario, correo o empresa...'"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
      </div>

      @if (tab() === 'clients') {
        @if (companiesWithoutAccess().length && !search()) {
          <div class="notice">
            <app-icon name="alert-triangle" [size]="16" />
            <span><strong>{{ companiesWithoutAccess().length }} empresa{{ companiesWithoutAccess().length === 1 ? '' : 's' }} sin acceso:</strong>
              nadie de {{ companiesWithoutAccess().length === 1 ? 'ella' : 'ellas' }} puede ver sus proyectos ni reportar tickets.</span>
          </div>
        }

        <div class="companies">
          @for (g of clientGroups(); track g.id) {
            <section class="company" [class.no-access]="!g.users.length">
              <header class="company-head">
                <span class="logo" [class.has-logo]="g.logo" [style.background]="g.logo ? '#fff' : avatarColor(g.id)">
                  @if (g.logo) { <img [src]="g.logo" alt=""> } @else { {{ g.name[0] }} }
                </span>
                <div class="company-title">
                  <h3>{{ g.name }}</h3>
                  <span>{{ g.users.length ? g.users.length + ' persona' + (g.users.length === 1 ? '' : 's') + ' con acceso' : 'Sin acceso todavía' }}{{ g.inactive ? ' · empresa inactiva' : '' }}</span>
                </div>
                <button class="btn-ghost" (click)="openModal('client', g.id)"><app-icon name="plus" [size]="14" /> {{ g.users.length ? 'Agregar' : 'Crear acceso' }}</button>
              </header>
              @for (u of g.users; track u.id) {
                <div class="person">
                  <span class="av" [style.background]="avatarColor(u.id)">{{ initialsOf(u.name) }}</span>
                  <div class="person-main">
                    <strong>{{ u.name }}</strong>
                    <span><span class="mono">&#64;{{ u.username }}</span> · <a [href]="'mailto:' + u.email">{{ u.email }}</a></span>
                  </div>
                  <span class="stat" [title]="u.ticketsCreated + ' ticket(s) creados'"><app-icon name="ticket" [size]="13" /> {{ u.ticketsCreated }} creado{{ u.ticketsCreated === 1 ? '' : 's' }}</span>
                  <div class="actions">
                    <button class="btn-icon" (click)="openResetModal(u)" title="Cambiar contraseña" aria-label="Cambiar contraseña"><app-icon name="lock" [size]="14" /></button>
                    <button class="btn-icon" (click)="editUser(u)" title="Editar" aria-label="Editar usuario"><app-icon name="edit" [size]="14" /></button>
                    <button class="btn-icon danger" (click)="deleteUser(u)" title="Quitar acceso" aria-label="Quitar acceso"><app-icon name="trash" [size]="14" /></button>
                  </div>
                </div>
              } @empty {
                <p class="no-users">Crea al menos un usuario para que esta empresa vea el avance de sus proyectos y pueda pedir soporte.</p>
              }
            </section>
          } @empty {
            <div class="empty-state"><div class="empty-icon"><app-icon name="users" [size]="30" /></div><h3>Sin resultados</h3><p>No hay usuarios que coincidan con tu búsqueda.</p></div>
          }
        </div>
      } @else {
        <div class="team">
          @for (t of teamRows(); track t.id) {
            <article class="tech">
              <div class="tech-top">
                <span class="av lg orange">{{ initialsOf(t.name) }}</span>
                <div class="person-main">
                  <strong>{{ t.name }}</strong>
                  <span><span class="mono">&#64;{{ t.username }}</span></span>
                  <a [href]="'mailto:' + t.email">{{ t.email }}</a>
                </div>
              </div>
              <div class="tech-stats">
                <div [class.warn]="t.breached > 0"><strong>{{ t.open }}</strong><span>Abiertos</span></div>
                <div><strong>{{ t.resolved }}</strong><span>Resueltos</span></div>
                <div><strong>{{ t.csat ?? '—' }}</strong><span>Satisfacción</span></div>
              </div>
              @if (t.breached) { <p class="tech-alert"><app-icon name="alert-triangle" [size]="13" /> {{ t.breached }} ticket{{ t.breached === 1 ? '' : 's' }} con SLA vencido</p> }
              <div class="tech-actions">
                <button class="btn-ghost" (click)="openResetModal(t.user)"><app-icon name="lock" [size]="13" /> Contraseña</button>
                <button class="btn-ghost" (click)="editUser(t.user)"><app-icon name="edit" [size]="13" /> Editar</button>
                <button class="btn-ghost danger" (click)="deleteUser(t.user)"><app-icon name="trash" [size]="13" /> Quitar</button>
              </div>
            </article>
          } @empty {
            <div class="empty-state grid-span">
              <div class="empty-icon"><app-icon name="settings" [size]="30" /></div>
              <h3>{{ search() ? 'Sin resultados' : 'Aún no tienes técnicos' }}</h3>
              <p>{{ search() ? 'Ningún técnico coincide con tu búsqueda.' : 'Crea a tu equipo para poder asignarles tickets.' }}</p>
            </div>
          }
        </div>
        <p class="team-note"><app-icon name="eye" [size]="14" /> Los técnicos ven y trabajan todos los tickets y proyectos. No ven empresas, usuarios, bitácora ni analíticas.</p>
      }
    </div>

    <!-- Crear / editar -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="user-modal-title">{{ editingId() ? 'Editar usuario' : (form.getRawValue().role === 'technician' ? 'Nuevo técnico' : 'Nuevo usuario de cliente') }}</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveUser()" class="modal-body" novalidate>
            @if (!editingId()) {
              <div class="role-picker" role="radiogroup" aria-label="Tipo de cuenta">
                <button type="button" role="radio" [attr.aria-checked]="form.getRawValue().role === 'client'" [class.active]="form.getRawValue().role === 'client'" (click)="setRole('client')">
                  <app-icon name="building" [size]="16" /><span><strong>Cliente</strong><small>Persona de una empresa cliente</small></span>
                </button>
                <button type="button" role="radio" [attr.aria-checked]="form.getRawValue().role === 'technician'" [class.active]="form.getRawValue().role === 'technician'" (click)="setRole('technician')">
                  <app-icon name="settings" [size]="16" /><span><strong>Técnico 3TECH</strong><small>Atiende tickets y proyectos</small></span>
                </button>
              </div>
            }

            <div class="form-grid">
              @if (form.getRawValue().role === 'client') {
                <div class="form-group full">
                  <label for="user-company">Empresa *</label>
                  <select id="user-company" formControlName="companyId" [class.error]="invalid('companyId')">
                    <option value="" disabled>Selecciona la empresa</option>
                    @for (c of companies(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
                  </select>
                  @if (invalid('companyId')) { <span class="field-error">Selecciona la empresa a la que pertenece.</span> }
                </div>
              }
              <div class="form-group full">
                <label for="user-name">Nombre completo *</label>
                <input id="user-name" type="text" formControlName="name" placeholder="Ej: Carlos López" (input)="onNameInput()"
                  [class.error]="invalid('name')" [attr.aria-invalid]="invalid('name')">
                @if (invalid('name')) { <span class="field-error">El nombre es obligatorio.</span> }
              </div>
              <div class="form-group">
                <label for="user-username">Usuario para entrar *</label>
                <input id="user-username" type="text" formControlName="username" placeholder="carlos.lopez" (input)="usernameTouched = true"
                  [class.error]="invalid('username')" [attr.aria-invalid]="invalid('username')">
                @if (form.get('username')?.hasError('taken')) { <span class="field-error">Ese usuario ya existe.</span> }
                @else if (invalid('username')) { <span class="field-error">El usuario es obligatorio.</span> }
              </div>
              <div class="form-group">
                <label for="user-email">Correo *</label>
                <input id="user-email" type="email" formControlName="email" placeholder="correo@empresa.com"
                  [class.error]="invalid('email')" [attr.aria-invalid]="invalid('email')">
                @if (invalid('email')) { <span class="field-error">Ingresa un correo válido.</span> }
              </div>
              @if (!editingId()) {
                <div class="form-group full">
                  <label for="user-password">Contraseña inicial *</label>
                  <div class="pass-row">
                    <input id="user-password" [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="Mínimo 6 caracteres"
                      [class.error]="invalid('password')" [attr.aria-invalid]="invalid('password')">
                    <button type="button" class="btn-icon" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'">
                      <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="15" />
                    </button>
                    <button type="button" class="btn-ghost" (click)="fillPassword(form)">Generar</button>
                  </div>
                  @if (invalid('password')) { <span class="field-error">La contraseña debe tener al menos 6 caracteres.</span> }
                  <span class="hint">Al crear la cuenta te mostraremos los datos de acceso listos para enviar.</span>
                </div>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">{{ editingId() ? 'Guardar cambios' : 'Crear acceso' }}</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Cambiar contraseña -->
    @if (resetUserTarget(); as target) {
      <div class="modal-overlay" (click)="closeResetModal()">
        <div class="modal small" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title"
          appModalFocusTrap (closeRequested)="closeResetModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="reset-modal-title">Nueva contraseña</h2>
            <button class="modal-close" (click)="closeResetModal()" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
          </div>
          <form [formGroup]="resetForm" (ngSubmit)="confirmReset()" class="modal-body" novalidate>
            <p class="reset-hint">Para <strong>{{ target.name }}</strong> (&#64;{{ target.username }}). La contraseña anterior dejará de funcionar.</p>
            <div class="pass-row">
              <label for="reset-password" class="sr-only">Nueva contraseña</label>
              <input id="reset-password" [type]="showPassword() ? 'text' : 'password'" formControlName="newPassword" placeholder="Mínimo 6 caracteres"
                [class.error]="isControlInvalid(resetForm.get('newPassword'))">
              <button type="button" class="btn-icon" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'">
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="15" />
              </button>
              <button type="button" class="btn-ghost" (click)="fillPassword(resetForm)">Generar</button>
            </div>
            @if (isControlInvalid(resetForm.get('newPassword'))) { <span class="field-error">Mínimo 6 caracteres.</span> }
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeResetModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="resetForm.invalid || saving()">Cambiar contraseña</button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Datos de acceso listos para compartir -->
    @if (credentials(); as cr) {
      <div class="modal-overlay" (click)="credentials.set(null)">
        <div class="modal small" role="dialog" aria-modal="true" aria-labelledby="cred-title"
          appModalFocusTrap (closeRequested)="credentials.set(null)" (click)="$event.stopPropagation()">
          <div class="cred-body">
            <span class="cred-check"><app-icon name="check" [size]="26" [strokeWidth]="2.5" /></span>
            <h2 id="cred-title">{{ cr.title }}</h2>
            <p>Comparte estos datos con <strong>{{ cr.name }}</strong>. Por seguridad no se volverán a mostrar.</p>
            <div class="cred-box">
              <div><span>Dirección</span><code>{{ loginUrl }}</code></div>
              <div><span>Usuario</span><code>{{ cr.username }}</code></div>
              <div><span>Contraseña</span><code>{{ cr.password }}</code></div>
            </div>
            <div class="cred-actions">
              <button class="btn-primary" (click)="copyCredentials(cr)"><app-icon name="copy" [size]="15" /> Copiar datos de acceso</button>
              <button class="btn-secondary" (click)="credentials.set(null)">Listo</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .users-page { max-width: var(--page-max-width); margin: 0 auto; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }

    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
    .tabs { display: inline-flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; }
    .tabs button { border: none; background: none; padding: 8px 14px; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
    .tabs button.active { background: #0f4b92; color: #fff; }
    .count { background: #f1f5f9; color: #475569; border-radius: 999px; padding: 0 8px; font-size: 12px; }
    .tabs button.active .count { background: rgba(255,255,255,0.22); color: #fff; }
    .toolbar .search-wrap { flex: 1; min-width: 240px; }

    .notice { display: flex; align-items: center; gap: 10px; background: #fdf3e6; border: 1px solid #f5d3a3; color: #8a520a; border-radius: 12px; padding: 11px 14px; margin-bottom: 16px; font-size: 13.5px; }

    /* Clientes por empresa */
    .companies { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; }
    @media (min-width: 1400px) { .companies { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .company { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }
    .company.no-access { border-style: dashed; border-color: #f5d3a3; }
    .company-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fbfcfe; border-bottom: 1px solid #f1f5f9; }
    .logo { width: 38px; height: 38px; border-radius: 10px; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .logo.has-logo { box-shadow: inset 0 0 0 1.5px #e2e8f0; }
    .logo img { width: 100%; height: 100%; object-fit: contain; padding: 3px; box-sizing: border-box; }
    .company-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .company-title h3 { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; }
    .company-title span { font-size: 12px; color: #64748b; }
    .no-access .company-title span { color: #b06a0c; font-weight: 600; }
    .person { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid #f8fafc; }
    .person:last-child { border-bottom: none; }
    .person:hover { background: #fafbfd; }
    .av { width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 12.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .av.lg { width: 48px; height: 48px; font-size: 16px; }
    .av.orange { background: #e99d34; }
    .person-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .person-main strong { font-size: 14px; color: #0f172a; }
    .person-main span, .person-main a { font-size: 12.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person-main a { color: #0f4b92; text-decoration: none; }
    .person-main a:hover { text-decoration: underline; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #64748b; background: #f8fafc; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
    .actions { display: flex; gap: 4px; }
    .no-users { margin: 0; padding: 14px 16px; font-size: 13px; color: #8a520a; }

    .btn-icon { width: 30px; height: 30px; border-radius: 8px; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569; flex-shrink: 0; }
    .btn-icon:hover { background: #d1e4fa; color: #0f4b92; }
    .btn-icon.danger:hover { background: #fee2e2; color: #dc2626; }
    .btn-ghost { display: inline-flex; align-items: center; gap: 5px; border: none; background: #eef4fc; color: #0f4b92; font-weight: 700; font-size: 12.5px; padding: 7px 11px; border-radius: 9px; cursor: pointer; white-space: nowrap; }
    .btn-ghost:hover { background: #d1e4fa; }
    .btn-ghost.danger { background: #fef2f2; color: #dc2626; }

    /* Equipo */
    .team { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .tech { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid #e99d34; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .tech-top { display: flex; align-items: center; gap: 12px; }
    .tech-stats { display: grid; grid-template-columns: repeat(3, 1fr); background: #f8fafc; border-radius: 12px; padding: 10px 0; }
    .tech-stats div { display: flex; flex-direction: column; align-items: center; border-right: 1px solid #eef2f7; }
    .tech-stats div:last-child { border-right: none; }
    .tech-stats strong { font-size: 20px; font-weight: 800; color: #0f172a; }
    .tech-stats span { font-size: 11px; color: #64748b; }
    .tech-stats .warn strong { color: #dc2626; }
    .tech-alert { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12.5px; font-weight: 600; color: #dc2626; }
    .tech-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .team-note { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #64748b; margin: 16px 0 0; }

    /* Formularios */
    .modal.small { max-width: 440px; }
    .role-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .role-picker button { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #fff; cursor: pointer; font-family: inherit; color: #475569; }
    .role-picker span { display: flex; flex-direction: column; }
    .role-picker strong { font-size: 13.5px; color: #0f172a; }
    .role-picker small { font-size: 12px; color: #64748b; }
    .role-picker button.active { border-color: #0f4b92; background: #eef4fc; color: #0f4b92; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    .modal-body input { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; }
    .modal-body select { padding: 10px 12px; font-size: 14px; width: 100%; box-sizing: border-box; font-family: inherit; }
    .modal-body input:focus { border-color: #0f4b92; }
    .pass-row { display: flex; gap: 6px; align-items: center; }
    .pass-row input { flex: 1; }
    .pass-row .btn-icon { height: 40px; width: 40px; }
    .pass-row .btn-ghost { height: 40px; }
    .hint { font-size: 12px; color: #94a3b8; }
    .reset-hint { font-size: 13.5px; color: #475569; background: #eef4fc; border-radius: 10px; padding: 12px 14px; margin: 0 0 14px; line-height: 1.5; }

    /* Datos de acceso */
    .cred-body { padding: 28px 24px 22px; text-align: center; }
    .cred-check { width: 56px; height: 56px; border-radius: 50%; background: #a9c238; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
    .cred-body h2 { font-size: 19px; margin: 12px 0 6px; color: #0f172a; }
    .cred-body p { font-size: 13.5px; color: #64748b; margin: 0 0 16px; }
    .cred-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 14px; text-align: left; }
    .cred-box div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid #eef2f7; font-size: 13px; }
    .cred-box div:last-child { border-bottom: none; }
    .cred-box span { color: #64748b; }
    .cred-box code { font-family: ui-monospace, Consolas, monospace; color: #0f172a; font-weight: 700; word-break: break-all; text-align: right; }
    .cred-actions { display: flex; gap: 8px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }

    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
      .person { flex-wrap: wrap; }
      .stat { order: 3; }
    }
  `]
})
export class UsersComponent {
  private userService = inject(UserService);
  private companyService = inject(CompanyService);
  private ticketService = inject(TicketService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  isControlInvalid = isControlInvalid;
  initialsOf = initials;
  readonly loginUrl = `${window.location.origin}/login`;

  tab = signal<Tab>('clients');
  search = signal('');
  showModal = signal(false);
  editingId = signal<string | null>(null);
  resetUserTarget = signal<User | null>(null);
  credentials = signal<Credentials | null>(null);
  showPassword = signal(false);
  saving = signal(false);
  /** Si el usuario ya escribió el login a mano, dejamos de sugerirlo a partir del nombre. */
  usernameTouched = false;

  companies = this.companyService.companies;

  constructor() {
    loadPageData(this.notify, this.userService.load(), this.companyService.load(), this.ticketService.load());
  }

  clientUsers = computed(() => this.userService.users().filter(u => u.role === 'client'));
  technicians = computed(() => this.userService.users().filter(u => u.role === 'technician'));

  form = this.fb.group({
    role: ['client' as 'client' | 'technician'],
    name: ['', Validators.required],
    username: ['', [Validators.required, this.usernameTakenValidator()]],
    email: ['', [Validators.required, Validators.email]],
    companyId: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  resetForm = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  private matches(text: string[]): boolean {
    const s = this.search().trim().toLowerCase();
    return !s || text.some(v => v.toLowerCase().includes(s));
  }

  /** Empresas con sus usuarios: primero las que no tienen acceso, luego por nombre. */
  clientGroups = computed(() => {
    const tickets = this.ticketService.getAll();
    const users = this.clientUsers();
    return this.companies()
      .map(c => {
        const companyMatches = this.matches([c.name]);
        const members = users.filter(u => u.companyId === c.id)
          .filter(u => companyMatches || this.matches([u.name, u.username, u.email]))
          .map(u => ({ ...u, ticketsCreated: tickets.filter(t => t.createdById === u.id).length }));
        return { id: c.id, name: c.name, logo: c.logo, inactive: c.status === 'inactive', users: members, show: companyMatches || members.length > 0 };
      })
      .filter(g => g.show)
      .sort((a, b) => Number(a.users.length > 0) - Number(b.users.length > 0) || Number(a.inactive) - Number(b.inactive) || a.name.localeCompare(b.name));
  });

  companiesWithoutAccess = computed(() => {
    const withUsers = new Set(this.clientUsers().map(u => u.companyId));
    return this.companies().filter(c => c.status === 'active' && !withUsers.has(c.id));
  });

  teamRows = computed(() => {
    const tickets = this.ticketService.getAll();
    return this.technicians()
      .filter(u => this.matches([u.name, u.username, u.email]))
      .map(u => {
        const mine = tickets.filter(t => t.assignedTo?.id === u.id);
        const open = mine.filter(t => !isClosed(t));
        return {
          id: u.id, name: u.name, username: u.username, email: u.email, user: u,
          open: open.length,
          breached: open.filter(t => this.ticketService.isSlaBreached(t)).length,
          resolved: mine.filter(isClosed).length,
          csat: this.ticketService.getAverageSatisfaction(mine),
        };
      })
      .sort((a, b) => b.open - a.open);
  });

  private usernameTakenValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      return this.userService.isUsernameTaken(control.value, this.editingId() ?? undefined) ? { taken: true } : null;
    };
  }

  private readonly avatarPalette = ['#0f4b92', '#a9c238', '#e99d34', '#0891b2', '#7c3aed', '#475569'];
  avatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return this.avatarPalette[hash % this.avatarPalette.length];
  }

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  /** Un técnico no pertenece a ninguna empresa: el campo se deshabilita para que no cuente en la validación. */
  setRole(role: 'client' | 'technician') {
    this.form.patchValue({ role });
    const company = this.form.get('companyId');
    if (role === 'technician') company?.disable(); else company?.enable();
  }

  onNameInput() {
    if (this.editingId() || this.usernameTouched) return;
    this.form.patchValue({ username: suggestUsername(this.form.value.name ?? '') });
  }

  fillPassword(target: typeof this.form | typeof this.resetForm) {
    const pwd = generatePassword();
    if (target === this.resetForm) this.resetForm.patchValue({ newPassword: pwd });
    else this.form.patchValue({ password: pwd });
    this.showPassword.set(true);
  }

  openModal(role: 'client' | 'technician', companyId = '') {
    this.editingId.set(null);
    this.usernameTouched = false;
    this.showPassword.set(false);
    this.form.reset({ role, name: '', username: '', email: '', companyId, password: '' });
    this.setRole(role);
    this.form.get('password')?.enable();
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editUser(u: User) {
    this.editingId.set(u.id);
    this.usernameTouched = true;
    this.form.reset({ role: u.role === 'technician' ? 'technician' : 'client', name: u.name, username: u.username, email: u.email, companyId: u.companyId || '', password: '' });
    this.setRole(u.role === 'technician' ? 'technician' : 'client');
    this.form.get('password')?.disable();
    this.showModal.set(true);
  }

  async saveUser() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const isTech = v.role === 'technician';
    const data = { name: v.name!.trim(), username: v.username!.trim(), email: v.email!.trim(), companyId: isTech ? null : v.companyId! };
    this.saving.set(true);
    try {
      if (this.editingId()) {
        const { companyId, ...common } = data;
        await this.userService.update(this.editingId()!, isTech ? common : { ...common, companyId });
        this.notify.success('Usuario actualizado.');
      } else {
        await this.userService.create({ ...data, role: v.role!, password: v.password! });
        this.credentials.set({ title: isTech ? 'Técnico creado' : 'Acceso creado', name: data.name, username: data.username, password: v.password! });
      }
      this.closeModal();
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteUser(u: User) {
    const ok = await this.confirm.ask({
      title: 'Quitar acceso',
      message: `¿Quitar el acceso de "${u.name}" (@${u.username})? Ya no podrá iniciar sesión. Sus tickets y comentarios se conservan.`,
      confirmLabel: 'Quitar acceso',
      danger: true
    });
    if (!ok) return;
    try {
      await this.userService.delete(u.id);
      this.notify.success('Acceso eliminado.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }

  openResetModal(u: User) {
    this.showPassword.set(false);
    this.resetForm.reset({ newPassword: '' });
    this.resetUserTarget.set(u);
  }
  closeResetModal() { this.resetUserTarget.set(null); }

  async confirmReset() {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }
    const target = this.resetUserTarget();
    if (!target) return;
    const password = this.resetForm.value.newPassword!;
    this.saving.set(true);
    try {
      await this.userService.resetPassword(target.id, password);
      this.closeResetModal();
      this.credentials.set({ title: 'Contraseña actualizada', name: target.name, username: target.username, password });
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async copyCredentials(cr: Credentials) {
    const text = `Acceso a Tikets y Proceso (3TECH)\nDirección: ${this.loginUrl}\nUsuario: ${cr.username}\nContraseña: ${cr.password}`;
    try {
      await navigator.clipboard.writeText(text);
      this.notify.success('Datos de acceso copiados. Pégalos en un correo o mensaje.');
    } catch {
      this.notify.error('No se pudo copiar. Selecciona el texto manualmente.');
    }
  }
}
