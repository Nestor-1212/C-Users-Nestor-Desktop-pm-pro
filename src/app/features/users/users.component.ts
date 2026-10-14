import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { CompanyService } from '../../core/services/company.service';
import { TicketService } from '../../core/services/ticket.service';
import { DepartmentService } from '../../core/services/department.service';
import { InternalRequestService } from '../../core/services/internal-request.service';
import { Department, Ticket, User } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';

interface Credentials { title: string; name: string; username: string; password: string }
type Role = 'client' | 'technician' | 'collaborator';
const ROLE_ORDER: Record<string, number> = { technician: 0, collaborator: 1, client: 2 };

const isClosed = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';
/** "hace 5 min", "hace 3 h", "hace 2 d", "hace 4 sem". */
function relative(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d < 14 ? `hace ${d} d` : `hace ${Math.round(d / 7)} sem`;
}
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
          <p>Quién puede entrar al sistema: clientes por empresa, tu equipo técnico y el personal interno por departamento</p>
        </div>
      </div>

      <!-- Resumen -->
      <div class="summary">
        <div class="sum"><strong>{{ clientUsers().length + technicians().length + collaborators().length }}</strong><span>Personas con acceso</span></div>
        <div class="sum"><strong>{{ companiesWithAccess() }} <small>de {{ activeCompanies() }}</small></strong><span>Empresas con acceso</span></div>
        <div class="sum"><strong>{{ technicians().length }}</strong><span>Técnicos 3TECH</span></div>
        <button class="sum clickable" [class.alert]="neverLogged().length > 0" (click)="group.set('all'); onlyNever.set(!onlyNever())">
          <strong>{{ neverLogged().length }}</strong><span>{{ onlyNever() ? 'Mostrando: nunca han entrado' : 'Nunca han entrado' }}</span>
        </button>
      </div>

      <div class="directory">
        <!-- Grupos -->
        <nav class="groups" aria-label="Grupos de usuarios">
          @for (g of fixedGroups(); track g.id) {
            <button class="group-item" [class.active]="group() === g.id" (click)="selectGroup(g.id)">
              <span class="g-icon" [class.team]="g.id === 'team'"><app-icon [name]="g.icon" [size]="16" /></span>
              <span class="g-name">{{ g.label }}</span>
              <span class="g-count">{{ g.count }}</span>
            </button>
          }
          <span class="groups-title groups-title-row">Departamentos
            <button class="mini-add" (click)="openDepartmentModal()" aria-label="Nuevo departamento" title="Nuevo departamento"><app-icon name="plus" [size]="13" /></button>
          </span>
          @for (d of departmentGroups(); track d.id) {
            <button class="group-item" [class.active]="group() === 'dep:' + d.id" [class.inactive]="!d.active" (click)="selectGroup('dep:' + d.id)">
              <span class="g-icon dep"><app-icon name="share" [size]="14" /></span>
              <span class="g-name">{{ d.name }}@if (!d.active) { <small>Inactivo</small> }</span>
              <span class="g-count">{{ d.count }}</span>
            </button>
          }
          <span class="groups-title">Empresas</span>
          @for (c of companyGroups(); track c.id) {
            <button class="group-item" [class.active]="group() === c.id" [class.inactive]="c.inactive" (click)="selectGroup(c.id)">
              <span class="g-logo" [class.has-logo]="c.logo" [style.background]="c.logo ? '#fff' : avatarColor(c.id)">
                @if (c.logo) { <img [src]="c.logo" alt=""> } @else { {{ c.name[0] }} }
              </span>
              <span class="g-name">{{ c.name }}@if (c.inactive) { <small>Inactiva</small> }</span>
              @if (c.count) { <span class="g-count">{{ c.count }}</span> }
              @else { <span class="g-warn" title="Sin acceso: nadie de esta empresa puede entrar"><app-icon name="alert-triangle" [size]="13" /></span> }
            </button>
          }
        </nav>

        <!-- Personas del grupo -->
        <section class="people-pane">
          <header class="pane-head">
            @if (selectedCompany(); as c) {
              <span class="g-logo lg" [class.has-logo]="c.logo" [style.background]="c.logo ? '#fff' : avatarColor(c.id)">
                @if (c.logo) { <img [src]="c.logo" alt=""> } @else { {{ c.name[0] }} }
              </span>
              <div class="pane-title">
                <h2>{{ c.name }}</h2>
                <span>{{ c.status === 'active' ? 'Empresa activa' : 'Empresa inactiva' }} · {{ people().length }} {{ people().length === 1 ? 'persona' : 'personas' }} con acceso</span>
              </div>
            } @else if (selectedDepartment(); as d) {
              <span class="g-icon lg dep"><app-icon name="share" [size]="20" /></span>
              <div class="pane-title">
                <h2>{{ d.name }}@if (!d.active) { <small class="inactive-tag">Inactivo</small> }</h2>
                <span>Responde solicitudes internas en máximo <b>{{ d.slaHours }} h</b> · {{ people().length }} {{ people().length === 1 ? 'persona' : 'personas' }} · {{ d.openReceived }} abiertas</span>
              </div>
              <div class="dep-actions">
                <button class="btn-ghost sm" (click)="openDepartmentModal(d)"><app-icon name="edit" [size]="13" /> Editar</button>
                <button class="btn-ghost sm" (click)="toggleDepartment(d)">{{ d.active ? 'Desactivar' : 'Activar' }}</button>
                <button class="btn-ghost sm danger" (click)="deleteDepartment(d)" aria-label="Eliminar departamento"><app-icon name="trash" [size]="13" /></button>
              </div>
            } @else {
              <span class="g-icon lg" [class.team]="group() === 'team'"><app-icon [name]="group() === 'team' ? 'settings' : 'users'" [size]="20" /></span>
              <div class="pane-title">
                <h2>{{ group() === 'team' ? 'Equipo 3TECH' : group() === 'internal' ? 'Colaboradores internos' : 'Todas las personas' }}</h2>
                <span>{{ group() === 'team' ? 'Atienden tickets y proyectos. No ven empresas, usuarios, bitácora ni analíticas.'
                  : group() === 'internal' ? 'Personal de los departamentos. Solo usan las solicitudes internas: no ven clientes ni proyectos.'
                  : 'Clientes, técnicos y personal interno con acceso al sistema' }}</span>
              </div>
            }
            <div class="search-wrap pane-search">
              <app-icon name="search" [size]="15" class="search-icon" />
              <label for="user-search" class="sr-only">Buscar persona</label>
              <input id="user-search" type="text" class="search-input" placeholder="Buscar persona…"
                [value]="search()" (input)="search.set($any($event.target).value)">
            </div>
            <button class="btn-add" (click)="addPerson()"><app-icon name="plus" [size]="14" /> {{ group() === 'team' ? 'Agregar técnico' : group() === 'internal' || selectedDepartment() ? 'Agregar colaborador' : 'Agregar persona' }}</button>
          </header>

          @if (people().length) {
            <div class="table" role="table" aria-label="Personas">
              <div class="t-head" role="row">
                <span role="columnheader">Persona</span>
                <span role="columnheader">Usuario</span>
                <span role="columnheader">{{ group() === 'all' ? 'Empresa / rol' : 'Rol' }}</span>
                <span role="columnheader">Actividad</span>
                <span role="columnheader">Último acceso</span>
                <span role="columnheader" class="sr-only">Acciones</span>
              </div>
              @for (u of people(); track u.id) {
                <div class="t-row" role="row">
                  <span class="cell person" role="cell">
                    <span class="av" [class.tech]="u.role === 'technician'" [class.collab]="u.role === 'collaborator'" [style.background]="u.role === 'client' ? avatarColor(u.id) : null">{{ initialsOf(u.name) }}</span>
                    <span class="person-main">
                      <strong>{{ u.name }}</strong>
                      <a [href]="'mailto:' + u.email">{{ u.email }}</a>
                    </span>
                  </span>
                  <span class="cell mono" role="cell">&#64;{{ u.username }}</span>
                  <span class="cell" role="cell">
                    @if (u.role === 'technician') { <span class="role-chip tech">Técnico 3TECH</span>@if (u.departmentName && !selectedDepartment()) { <small class="dep-note">{{ u.departmentName }}</small> } }
                    @else if (u.role === 'collaborator') { <span class="role-chip collab">{{ selectedDepartment() ? 'Colaborador' : 'Colaborador · ' + u.departmentName }}</span> }
                    @else if (selectedCompany()) { <span class="role-chip client">Cliente</span> }
                    @else { <span class="company-name">{{ u.companyName }}</span> }
                  </span>
                  <span class="cell activity" role="cell">
                    @if (u.role === 'technician') {
                      <span [class.warn]="u.breached > 0">{{ u.open }} abiertos</span> · {{ u.resolved }} resueltos
                    } @else if (u.role === 'collaborator') {
                      {{ u.internalOpen }} por atender · {{ u.internalCreated }} {{ u.internalCreated === 1 ? 'solicitud enviada' : 'solicitudes enviadas' }}
                    } @else {
                      {{ u.ticketsCreated }} {{ u.ticketsCreated === 1 ? 'ticket creado' : 'tickets creados' }}
                    }
                  </span>
                  <span class="cell" role="cell">
                    @if (u.lastLoginAt) { <span class="login" [class.recent]="u.recent">{{ u.lastLoginLabel }}</span> }
                    @else { <span class="login never">Nunca ha entrado</span> }
                  </span>
                  <span class="cell menu-cell" role="cell">
                    <button class="btn-menu" [attr.aria-expanded]="menuFor() === u.id" [attr.aria-label]="'Acciones para ' + u.name" (click)="toggleMenu(u.id)">
                      <span aria-hidden="true">⋯</span>
                    </button>
                    @if (menuFor() === u.id) {
                      <div class="menu-backdrop" (click)="menuFor.set(null)"></div>
                      <div class="menu" role="menu">
                        <button role="menuitem" (click)="menuFor.set(null); openResetModal(u.user)"><app-icon name="lock" [size]="14" /> Cambiar contraseña</button>
                        <button role="menuitem" (click)="menuFor.set(null); editUser(u.user)"><app-icon name="edit" [size]="14" /> Editar datos</button>
                        <button role="menuitem" class="danger" (click)="menuFor.set(null); deleteUser(u.user)"><app-icon name="trash" [size]="14" /> Quitar acceso</button>
                      </div>
                    }
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="pane-empty">
              @if (selectedCompany() && !search() && !onlyNever()) {
                <span class="empty-icon warn"><app-icon name="alert-triangle" [size]="26" /></span>
                <h3>Nadie de {{ selectedCompany()!.name }} puede entrar todavía</h3>
                <p>Crea su primer acceso para que vean el avance de sus proyectos y puedan pedir soporte.</p>
                <button class="btn-primary" (click)="addPerson()"><app-icon name="plus" [size]="15" /> Crear el primer acceso</button>
              } @else {
                <span class="empty-icon"><app-icon name="users" [size]="26" /></span>
                <h3>Sin resultados</h3>
                <p>Ninguna persona coincide con la búsqueda.</p>
              }
            </div>
          }
        </section>
      </div>
    </div>

    <!-- Crear / editar -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="user-modal-title">{{ editingId() ? 'Editar usuario' : (form.getRawValue().role === 'technician' ? 'Nuevo técnico' : form.getRawValue().role === 'collaborator' ? 'Nuevo colaborador interno' : 'Nuevo usuario de cliente') }}</h2>
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
                <button type="button" role="radio" [attr.aria-checked]="form.getRawValue().role === 'collaborator'" [class.active]="form.getRawValue().role === 'collaborator'" (click)="setRole('collaborator')">
                  <app-icon name="share" [size]="16" /><span><strong>Colaborador interno</strong><small>Solo solicitudes entre departamentos</small></span>
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
              @if (form.getRawValue().role !== 'client') {
                <div class="form-group full">
                  <label for="user-department">Departamento {{ form.getRawValue().role === 'collaborator' ? '*' : '(opcional)' }}</label>
                  <select id="user-department" formControlName="departmentId" [class.error]="invalid('departmentId')">
                    <option value="">{{ form.getRawValue().role === 'collaborator' ? 'Selecciona el departamento' : 'Sin departamento' }}</option>
                    @for (d of activeDepartments(); track d.id) { <option [value]="d.id">{{ d.name }}</option> }
                  </select>
                  @if (invalid('departmentId')) { <span class="field-error">Un colaborador necesita un departamento.</span> }
                  @else if (form.getRawValue().role === 'technician') { <span class="hint">Con departamento, también atiende y envía solicitudes internas.</span> }
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

    <!-- Departamento -->
    @if (departmentModal()) {
      <div class="modal-overlay" (click)="departmentModal.set(false)">
        <div class="modal small" role="dialog" aria-modal="true" aria-labelledby="dep-modal-title"
          appModalFocusTrap (closeRequested)="departmentModal.set(false)" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="dep-modal-title">{{ editingDepartment() ? 'Editar departamento' : 'Nuevo departamento' }}</h2>
            <button class="modal-close" (click)="departmentModal.set(false)" aria-label="Cerrar"><app-icon name="x" [size]="18" /></button>
          </div>
          <form [formGroup]="departmentForm" (ngSubmit)="saveDepartment()" class="modal-body" novalidate>
            <div class="form-group full">
              <label for="dep-name">Nombre *</label>
              <input id="dep-name" type="text" formControlName="name" placeholder="Ej: Call Center" maxlength="60">
            </div>
            <div class="form-group full dep-sla-group">
              <label for="dep-sla">Responde en máximo (horas) *</label>
              <input id="dep-sla" type="number" formControlName="slaHours" min="1" max="720">
              <span class="hint">Es el compromiso de primera respuesta para las solicitudes que recibe este departamento.</span>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="departmentModal.set(false)">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="departmentForm.invalid || saving()">{{ editingDepartment() ? 'Guardar' : 'Crear departamento' }}</button>
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

    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .sum { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; text-align: left; font-family: inherit; }
    .sum strong { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.2; }
    .sum strong small { font-size: 13px; color: #94a3b8; font-weight: 600; }
    .sum span { font-size: 12.5px; color: #64748b; }
    .sum.clickable { cursor: pointer; }
    .sum.clickable:hover { border-color: #0f4b92; }
    .sum.alert strong { color: #c47a14; }

    /* Directorio: grupos | personas */
    .directory { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; align-items: start; }
    .groups { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 10px; display: flex; flex-direction: column; gap: 2px; position: sticky; top: 16px; max-height: calc(100vh - 140px); overflow-y: auto; }
    .groups-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700; padding: 12px 10px 6px; }
    .group-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: none; background: none; border-radius: 10px; cursor: pointer; text-align: left; font-family: inherit; width: 100%; }
    .group-item:hover { background: #f8fafc; }
    .group-item.active { background: #eef4fc; }
    .group-item.active .g-name { color: #0f4b92; font-weight: 800; }
    .group-item.inactive { opacity: 0.6; }
    .g-icon { width: 30px; height: 30px; border-radius: 9px; background: #eef4fc; color: #0f4b92; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .g-icon.team { background: #fdf3e6; color: #c47a14; }
    .g-icon.lg, .g-logo.lg { width: 46px; height: 46px; border-radius: 12px; }
    .g-logo { width: 30px; height: 30px; border-radius: 9px; color: #fff; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
    .g-logo.lg { font-size: 19px; }
    .g-logo.has-logo { box-shadow: inset 0 0 0 1.5px #e2e8f0; }
    .g-logo img { width: 100%; height: 100%; object-fit: contain; padding: 3px; box-sizing: border-box; }
    .g-name { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; flex-direction: column; }
    .g-name small { font-size: 11px; color: #94a3b8; font-weight: 500; }
    .g-count { font-size: 12px; font-weight: 700; background: #f1f5f9; color: #475569; border-radius: 999px; padding: 1px 9px; }
    .group-item.active .g-count { background: #0f4b92; color: #fff; }
    .g-warn { color: #e99d34; display: inline-flex; }

    .people-pane { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; min-width: 0; }
    .pane-head { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap; }
    .pane-title { flex: 1; min-width: 200px; }
    .pane-title h2 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
    .pane-title span { font-size: 12.5px; color: #64748b; }
    .pane-search { flex: 0 1 260px; min-width: 180px; }
    .btn-add { display: inline-flex; align-items: center; gap: 6px; border: none; background: #0f4b92; color: #fff; font-weight: 700; font-size: 13px; padding: 9px 14px; border-radius: 10px; cursor: pointer; white-space: nowrap; }
    .btn-add:hover { background: #0c3d78; }

    .table { display: flex; flex-direction: column; }
    .t-head, .t-row { display: grid; grid-template-columns: minmax(220px, 2.2fr) minmax(110px, 1fr) minmax(140px, 1.3fr) minmax(150px, 1.3fr) minmax(120px, 1fr) 44px; align-items: center; gap: 12px; padding: 0 18px; }
    .t-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; font-weight: 700; padding-top: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
    .t-row { padding-top: 11px; padding-bottom: 11px; border-bottom: 1px solid #f8fafc; }
    .t-row:last-child { border-bottom: none; }
    .t-row:hover { background: #fafbfd; }
    .cell { font-size: 13px; color: #334155; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .person { display: flex; align-items: center; gap: 11px; overflow: visible; }
    .av { width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 12.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .av.tech { background: #e99d34; }
    .person-main { min-width: 0; display: flex; flex-direction: column; }
    .person-main strong { font-size: 14px; color: #0f172a; overflow: hidden; text-overflow: ellipsis; }
    .person-main a { font-size: 12.5px; color: #64748b; text-decoration: none; overflow: hidden; text-overflow: ellipsis; }
    .person-main a:hover { color: #0f4b92; text-decoration: underline; }
    .role-chip { font-size: 11.5px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
    .role-chip.tech { background: #fdf3e6; color: #a8620a; }
    .role-chip.client { background: #eef4fc; color: #0f4b92; }
    .role-chip.collab { background: #ecfeff; color: #0e7490; }
    .dep-note { display: block; font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .av.collab { background: #0891b2; }
    .g-icon.dep { background: #ecfeff; color: #0e7490; }
    .groups-title-row { display: flex; align-items: center; justify-content: space-between; }
    .mini-add { width: 22px; height: 22px; border-radius: 7px; border: none; background: #eef4fc; color: #0f4b92; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .mini-add:hover { background: #dfeafa; }
    .dep-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-ghost.sm { padding: 6px 10px; font-size: 12.5px; display: inline-flex; align-items: center; gap: 5px; }
    .btn-ghost.danger { color: #dc2626; }
    .inactive-tag { font-size: 11px; font-weight: 700; color: #94a3b8; margin-left: 8px; }
    .dep-sla-group { margin-top: 14px; }
    .company-name { font-weight: 600; }
    .activity .warn { color: #dc2626; font-weight: 700; }
    .login { font-size: 12.5px; color: #475569; }
    .login.recent { color: #5b6b12; font-weight: 700; }
    .login.never { color: #c47a14; font-weight: 700; }
    .menu-cell { position: relative; overflow: visible; display: flex; justify-content: flex-end; }
    .btn-menu { width: 32px; height: 32px; border-radius: 8px; border: none; background: none; color: #64748b; font-size: 18px; font-weight: 800; cursor: pointer; line-height: 1; }
    .btn-menu:hover, .btn-menu[aria-expanded="true"] { background: #f1f5f9; color: #0f172a; }
    .menu-backdrop { position: fixed; inset: 0; z-index: 40; }
    .menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 50; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px; min-width: 200px; box-shadow: 0 16px 40px -12px rgba(15,23,42,0.25); display: flex; flex-direction: column; }
    .menu button { display: flex; align-items: center; gap: 9px; border: none; background: none; padding: 9px 10px; border-radius: 8px; font-size: 13.5px; font-family: inherit; color: #334155; cursor: pointer; text-align: left; }
    .menu button:hover { background: #f1f5f9; }
    .menu button.danger { color: #dc2626; }
    .menu button.danger:hover { background: #fef2f2; }

    .pane-empty { text-align: center; padding: 48px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .pane-empty h3 { margin: 6px 0 0; font-size: 16px; color: #0f172a; }
    .pane-empty p { margin: 0 0 10px; font-size: 13.5px; color: #64748b; max-width: 420px; }
    .empty-icon { width: 56px; height: 56px; border-radius: 16px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; }
    .empty-icon.warn { background: #fdf3e6; color: #c47a14; }

    /* Pantallas medianas: la tabla se convierte en tarjetas apiladas */
    @media (max-width: 1100px) {
      .t-head { display: none; }
      .t-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "person menu" "user user" "company company" "activity activity" "login login"; row-gap: 4px; }
      .t-row .person { grid-area: person; }
      .t-row .menu-cell { grid-area: menu; }
      .t-row .cell:nth-child(2) { grid-area: user; padding-left: 47px; }
      .t-row .cell:nth-child(3) { grid-area: company; padding-left: 47px; }
      .t-row .cell:nth-child(4) { grid-area: activity; padding-left: 47px; }
      .t-row .cell:nth-child(5) { grid-area: login; padding-left: 47px; }
    }
    /* Tablet y celular: los grupos pasan a una fila deslizable arriba */
    @media (max-width: 900px) {
      .directory { grid-template-columns: 1fr; }
      .groups { position: static; max-height: none; flex-direction: row; overflow-x: auto; padding: 8px; }
      .groups-title { display: none; }
      .group-item { width: auto; flex-shrink: 0; }
      .g-name { max-width: 160px; }
      .summary { grid-template-columns: 1fr 1fr; }
      .pane-search { flex: 1 1 100%; }
    }

    /* Formularios */
    .modal.small { max-width: 440px; }
    .role-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
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
  private departmentService = inject(DepartmentService);
  private internalRequests = inject(InternalRequestService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  isControlInvalid = isControlInvalid;
  initialsOf = initials;
  readonly loginUrl = `${window.location.origin}/login`;

  /** 'all' = todas, 'team' = técnicos, 'internal' = colaboradores, 'dep:<id>' = un departamento, o el id de una empresa. */
  group = signal<string>('all');
  onlyNever = signal(false);
  menuFor = signal<string | null>(null);
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
    loadPageData(this.notify, this.userService.load(), this.companyService.load(), this.ticketService.load(),
      this.departmentService.load(), this.internalRequests.load());
  }

  departments = this.departmentService.departments;
  activeDepartments = computed(() => this.departments().filter(d => d.active));
  departmentModal = signal(false);
  editingDepartment = signal<Department | null>(null);
  departmentForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slaHours: [8, [Validators.required, Validators.min(1), Validators.max(720)]],
  });

  clientUsers = computed(() => this.userService.users().filter(u => u.role === 'client'));
  technicians = computed(() => this.userService.users().filter(u => u.role === 'technician'));
  collaborators = computed(() => this.userService.users().filter(u => u.role === 'collaborator'));

  form = this.fb.group({
    role: ['client' as Role],
    departmentId: [''],
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

  activeCompanies = computed(() => this.companies().filter(c => c.status === 'active').length);
  /** Empresas ACTIVAS que tienen al menos una persona con acceso (mismo universo que activeCompanies). */
  companiesWithAccess = computed(() => {
    const withUsers = new Set(this.clientUsers().map(u => u.companyId));
    return this.companies().filter(c => c.status === 'active' && withUsers.has(c.id)).length;
  });
  neverLogged = computed(() => [...this.clientUsers(), ...this.technicians(), ...this.collaborators()].filter(u => !u.lastLoginAt));

  fixedGroups = computed(() => [
    { id: 'all', label: 'Todas las personas', icon: 'users' as const, count: this.clientUsers().length + this.technicians().length + this.collaborators().length },
    { id: 'team', label: 'Equipo 3TECH', icon: 'settings' as const, count: this.technicians().length },
    { id: 'internal', label: 'Colaboradores internos', icon: 'share' as const, count: this.collaborators().length },
  ]);

  departmentGroups = computed(() => this.departments()
    .map(d => ({ ...d, count: this.userService.users().filter(u => u.departmentId === d.id).length }))
    .sort((a, b) => Number(!a.active) - Number(!b.active) || a.name.localeCompare(b.name)));

  selectedDepartment = computed(() => {
    const g = this.group();
    return g.startsWith('dep:') ? this.departments().find(d => d.id === g.slice(4)) ?? null : null;
  });

  /** Empresas para la columna izquierda: activas primero, luego por nombre. */
  companyGroups = computed(() => this.companies()
    .map(c => ({ id: c.id, name: c.name, logo: c.logo, inactive: c.status === 'inactive', count: this.clientUsers().filter(u => u.companyId === c.id).length }))
    .sort((a, b) => Number(a.inactive) - Number(b.inactive) || a.name.localeCompare(b.name)));

  selectedCompany = computed(() => this.companies().find(c => c.id === this.group()) ?? null);


  /** Personas del grupo elegido con su actividad y último acceso. */
  people = computed(() => {
    const g = this.group();
    const tickets = this.ticketService.getAll();
    const internal = this.internalRequests.items();
    const base = g === 'all' ? [...this.technicians(), ...this.collaborators(), ...this.clientUsers()]
      : g === 'team' ? this.technicians()
      : g === 'internal' ? this.collaborators()
      : g.startsWith('dep:') ? this.userService.users().filter(u => u.departmentId === g.slice(4))
      : this.clientUsers().filter(u => u.companyId === g);
    const s = this.search().trim().toLowerCase();
    const now = Date.now();
    return base
      .filter(u => !this.onlyNever() || !u.lastLoginAt)
      .map(u => {
        const companyName = this.companyService.getById(u.companyId ?? '')?.name ?? '';
        const departmentName = this.departmentService.getById(u.departmentId)?.name ?? '';
        const internalOpen = internal.filter(r => r.assignedTo?.id === u.id && r.status !== 'resolved' && r.status !== 'closed').length;
        const internalCreated = internal.filter(r => r.createdById === u.id).length;
        const mine = tickets.filter(t => t.assignedTo?.id === u.id);
        const open = mine.filter(t => !isClosed(t));
        const last = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : null;
        return {
          ...u, user: u, companyName, departmentName, internalOpen, internalCreated,
          ticketsCreated: tickets.filter(t => t.createdById === u.id).length,
          open: open.length, resolved: mine.filter(isClosed).length,
          breached: open.filter(t => this.ticketService.isSlaBreached(t)).length,
          lastLoginLabel: last ? relative(now - last) : '',
          recent: !!last && now - last < 24 * 36e5,
        };
      })
      .filter(u => !s || [u.name, u.username, u.email, u.companyName, u.departmentName].some(v => v.toLowerCase().includes(s)))
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.companyName.localeCompare(b.companyName) || a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name));
  });

  selectGroup(id: string) {
    this.group.set(id);
    this.onlyNever.set(false);
    this.search.set('');
  }

  toggleMenu(id: string) { this.menuFor.set(this.menuFor() === id ? null : id); }

  /** "Agregar" según el grupo: técnico en el equipo, cliente con la empresa ya elegida en una empresa. */
  addPerson() {
    const g = this.group();
    if (g === 'team') this.openModal('technician');
    else if (g === 'internal') this.openModal('collaborator');
    else if (g.startsWith('dep:')) this.openModal('collaborator', '', g.slice(4));
    else this.openModal('client', g === 'all' ? '' : g);
  }

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

  /**
   * Un técnico o colaborador no pertenece a ninguna empresa (el campo se deshabilita
   * para que no cuente en la validación); el departamento solo es obligatorio para colaboradores.
   */
  setRole(role: Role) {
    this.form.patchValue({ role });
    const company = this.form.get('companyId');
    if (role === 'client') company?.enable(); else company?.disable();
    const dep = this.form.get('departmentId')!;
    dep.setValidators(role === 'collaborator' ? Validators.required : null);
    dep.updateValueAndValidity();
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

  openModal(role: Role, companyId = '', departmentId = '') {
    this.editingId.set(null);
    this.usernameTouched = false;
    this.showPassword.set(false);
    this.form.reset({ role, name: '', username: '', email: '', companyId, departmentId, password: '' });
    this.setRole(role);
    this.form.get('password')?.enable();
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editUser(u: User) {
    this.editingId.set(u.id);
    this.usernameTouched = true;
    const role: Role = u.role === 'technician' || u.role === 'collaborator' ? u.role : 'client';
    this.form.reset({ role, name: u.name, username: u.username, email: u.email, companyId: u.companyId || '', departmentId: u.departmentId || '', password: '' });
    this.setRole(role);
    this.form.get('password')?.disable();
    this.showModal.set(true);
  }

  async saveUser() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const isClient = v.role === 'client';
    const data = { name: v.name!.trim(), username: v.username!.trim(), email: v.email!.trim(), companyId: isClient ? v.companyId! : null };
    const departmentId = isClient ? null : (v.departmentId || null);
    this.saving.set(true);
    try {
      if (this.editingId()) {
        const { companyId, ...common } = data;
        await this.userService.update(this.editingId()!, isClient ? { ...common, companyId } : { ...common, departmentId });
        this.notify.success('Usuario actualizado.');
      } else {
        await this.userService.create({ ...data, departmentId, role: v.role!, password: v.password! });
        const title = v.role === 'technician' ? 'Técnico creado' : v.role === 'collaborator' ? 'Colaborador creado' : 'Acceso creado';
        this.credentials.set({ title, name: data.name, username: data.username, password: v.password! });
      }
      // Los conteos de miembros por departamento cambian.
      if (!isClient) this.departmentService.load().catch(() => undefined);
      this.closeModal();
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Departamentos ──
  openDepartmentModal(d?: Department) {
    this.editingDepartment.set(d ?? null);
    this.departmentForm.reset({ name: d?.name ?? '', slaHours: d?.slaHours ?? 8 });
    this.departmentModal.set(true);
  }

  async saveDepartment() {
    if (this.departmentForm.invalid) { this.departmentForm.markAllAsTouched(); return; }
    const v = this.departmentForm.getRawValue();
    const data = { name: v.name!.trim(), slaHours: Number(v.slaHours) };
    this.saving.set(true);
    try {
      const editing = this.editingDepartment();
      if (editing) {
        await this.departmentService.update(editing.id, data);
        this.notify.success('Departamento actualizado. El nuevo tiempo aplica a las solicitudes nuevas.');
      } else {
        const d = await this.departmentService.create(data);
        this.selectGroup('dep:' + d.id);
        this.notify.success(`Departamento "${d.name}" creado. Agrégale personas para que reciba solicitudes.`);
      }
      this.departmentModal.set(false);
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async toggleDepartment(d: Department) {
    try {
      await this.departmentService.update(d.id, { active: !d.active });
      this.notify.success(d.active ? `"${d.name}" ya no recibe solicitudes nuevas. Su historial se conserva.` : `"${d.name}" vuelve a recibir solicitudes.`);
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }

  async deleteDepartment(d: Department) {
    const ok = await this.confirm.ask({
      title: 'Eliminar departamento',
      message: `¿Eliminar "${d.name}"? Solo es posible si nunca tuvo solicitudes; si tiene historial, desactívalo.`,
      confirmLabel: 'Eliminar', danger: true,
    });
    if (!ok) return;
    try {
      await this.departmentService.delete(d.id);
      this.selectGroup('all');
      this.userService.load().catch(() => undefined);
      this.notify.success('Departamento eliminado.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
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
