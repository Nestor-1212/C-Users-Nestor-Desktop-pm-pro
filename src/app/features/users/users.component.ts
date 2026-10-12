import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { CompanyService } from '../../core/services/company.service';
import { User } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, StatCardComponent, ModalFocusTrapDirective],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h1>Usuarios</h1>
          <p>Cuentas de tus empresas cliente y de tu equipo técnico de 3TECH</p>
        </div>
        <button class="btn-primary" (click)="openModal()">
          <app-icon name="plus" [size]="16" /> Nuevo Usuario
        </button>
      </div>

      <div class="quick-stats">
        <app-stat-card [value]="clientUsers().length" label="Usuarios de Clientes" icon="users" color="blue" />
        <app-stat-card [value]="technicians().length" label="Técnicos 3TECH" icon="settings" color="yellow" />
        <app-stat-card [value]="companies().length" label="Empresas con Acceso" icon="building" color="indigo" />
      </div>

      <div class="role-tabs" role="tablist" aria-label="Tipo de cuenta">
        <button role="tab" [class.active]="roleFilter() === ''" [attr.aria-selected]="roleFilter() === ''" (click)="roleFilter.set('')">Todos <span>{{ managedUsers().length }}</span></button>
        <button role="tab" [class.active]="roleFilter() === 'client'" [attr.aria-selected]="roleFilter() === 'client'" (click)="roleFilter.set('client')">Clientes <span>{{ clientUsers().length }}</span></button>
        <button role="tab" [class.active]="roleFilter() === 'technician'" [attr.aria-selected]="roleFilter() === 'technician'" (click)="roleFilter.set('technician')">Equipo 3TECH <span>{{ technicians().length }}</span></button>
      </div>

      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="user-search" class="sr-only">Buscar usuario</label>
          <input id="user-search" type="text" placeholder="Buscar por nombre, usuario o email..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="user-company-filter" class="sr-only">Filtrar por empresa</label>
        <select id="user-company-filter" class="filter-select" (change)="companyFilter.set($any($event.target).value)">
          <option value="">Todas las empresas</option>
          @for (c of companies(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
      </div>

      <div class="users-list">
        @for (u of filteredUsers(); track u.id) {
          <div class="user-row">
            <div class="user-avatar-md" [style.background]="avatarColor(u.id)">{{ u.name[0] }}</div>
            <div class="user-main">
              <span class="user-name">{{ u.name }}</span>
              <span class="user-sub">&#64;{{ u.username }} · {{ u.email }}</span>
            </div>
            @if (u.role === 'technician') {
              <span class="company-chip tech"><app-icon name="settings" [size]="12" /> Técnico 3TECH</span>
            } @else {
              <span class="company-chip"><app-icon name="building" [size]="12" /> {{ getCompanyName(u.companyId) }}</span>
            }
            <div class="user-actions">
              <button class="btn-icon" (click)="editUser(u)" title="Editar" aria-label="Editar usuario">
                <app-icon name="edit" [size]="15" />
              </button>
              <button class="btn-icon" (click)="openResetModal(u)" title="Resetear contraseña" aria-label="Resetear contraseña">
                <app-icon name="lock" [size]="15" />
              </button>
              <button class="btn-icon danger" (click)="deleteUser(u)" title="Eliminar" aria-label="Eliminar usuario">
                <app-icon name="trash" [size]="15" />
              </button>
            </div>
          </div>
        } @empty {
          <div class="empty-state grid-span">
            <div class="empty-icon"><app-icon name="users" [size]="32" /></div>
            <h3>Sin usuarios</h3>
            <p>No hay usuarios que coincidan con tu búsqueda.</p>
          </div>
        }
      </div>
    </div>

    <!-- Create / Edit Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="user-modal-title">{{ editingId() ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveUser()" class="modal-body" novalidate>
            <div class="form-grid">
              <div class="form-group full">
                <span class="field-label">Tipo de cuenta</span>
                <div class="role-picker" role="radiogroup" aria-label="Tipo de cuenta">
                  <button type="button" role="radio" [attr.aria-checked]="form.value.role === 'client'" [class.active]="form.getRawValue().role === 'client'"
                    [disabled]="!!editingId()" (click)="setRole('client')">
                    <app-icon name="building" [size]="16" />
                    <span><strong>Cliente</strong><small>Usuario de una empresa cliente</small></span>
                  </button>
                  <button type="button" role="radio" [attr.aria-checked]="form.value.role === 'technician'" [class.active]="form.getRawValue().role === 'technician'"
                    [disabled]="!!editingId()" (click)="setRole('technician')">
                    <app-icon name="settings" [size]="16" />
                    <span><strong>Técnico 3TECH</strong><small>Atiende tickets y proyectos</small></span>
                  </button>
                </div>
              </div>
              <div class="form-group full">
                <label for="user-name">Nombre completo *</label>
                <input id="user-name" type="text" formControlName="name" placeholder="Ej: Carlos López"
                  [class.error]="invalid('name')" [attr.aria-invalid]="invalid('name')">
                @if (invalid('name')) { <span class="field-error">El nombre es obligatorio.</span> }
              </div>
              <div class="form-group">
                <label for="user-username">Usuario (login) *</label>
                <input id="user-username" type="text" formControlName="username" placeholder="ej. empresa4"
                  [class.error]="invalid('username')" [attr.aria-invalid]="invalid('username')">
                @if (form.get('username')?.hasError('required') && invalid('username')) {
                  <span class="field-error">El usuario es obligatorio.</span>
                }
                @if (form.get('username')?.hasError('taken')) {
                  <span class="field-error">Ese nombre de usuario ya está en uso.</span>
                }
              </div>
              <div class="form-group">
                <label for="user-email">Email *</label>
                <input id="user-email" type="email" formControlName="email" placeholder="correo@empresa.com"
                  [class.error]="invalid('email')" [attr.aria-invalid]="invalid('email')">
                @if (invalid('email')) { <span class="field-error">Ingresa un correo electrónico válido.</span> }
              </div>
              @if (form.getRawValue().role === 'client') {
              <div class="form-group full">
                <label for="user-company">Empresa *</label>
                <select id="user-company" formControlName="companyId" [class.error]="invalid('companyId')">
                  <option value="" disabled>Selecciona una empresa</option>
                  @for (c of companies(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                @if (invalid('companyId')) { <span class="field-error">Selecciona la empresa a la que pertenece.</span> }
              </div>
              } @else {
                <p class="tech-hint full">El técnico ve todos los tickets y proyectos y puede tomar tickets. No ve facturación, empresas, usuarios ni bitácora.</p>
              }
              @if (!editingId()) {
                <div class="form-group full">
                  <label for="user-password">Contraseña inicial *</label>
                  <input id="user-password" type="text" formControlName="password" placeholder="Mínimo 6 caracteres"
                    [class.error]="invalid('password')" [attr.aria-invalid]="invalid('password')">
                  @if (invalid('password')) { <span class="field-error">La contraseña debe tener al menos 6 caracteres.</span> }
                </div>
              }
            </div>
            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ editingId() ? 'Guardar cambios' : 'Crear usuario' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Reset Password Modal -->
    @if (resetUserTarget()) {
      <div class="modal-overlay" (click)="closeResetModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title"
          appModalFocusTrap (closeRequested)="closeResetModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="reset-modal-title">Resetear contraseña</h2>
            <button class="modal-close" (click)="closeResetModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="resetForm" (ngSubmit)="confirmReset()" class="modal-body" novalidate>
            <p class="reset-hint">
              Vas a establecer una nueva contraseña para <strong>{{ resetUserTarget()!.name }}</strong>
              ({{ '@' + resetUserTarget()!.username }}). No se envía por correo: deberás comunicársela tú mismo.
            </p>
            <div class="form-group">
              <label for="reset-password">Nueva contraseña *</label>
              <input id="reset-password" type="text" formControlName="newPassword" placeholder="Mínimo 6 caracteres"
                [class.error]="isControlInvalid(resetForm.get('newPassword'))">
              @if (isControlInvalid(resetForm.get('newPassword'))) {
                <span class="field-error">La contraseña debe tener al menos 6 caracteres.</span>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeResetModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="resetForm.invalid">Establecer contraseña</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .users-page { max-width: 1100px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .role-tabs { display: inline-flex; gap: 4px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 4px; margin-bottom: 14px; }
    .role-tabs button { border: none; background: none; padding: 7px 14px; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: #64748b; cursor: pointer; display: inline-flex; gap: 7px; align-items: center; }
    .role-tabs button span { background: #f1f5f9; border-radius: 999px; padding: 0 8px; font-size: 12px; }
    .role-tabs button.active { background: #0f4b92; color: #fff; }
    .role-tabs button.active span { background: rgba(255,255,255,0.22); }
    .company-chip.tech { background: #fdf3e6; color: #9a5d0c; }
    .field-label { font-size: 13px; font-weight: 600; color: #374151; }
    .role-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .role-picker button { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #fff; cursor: pointer; font-family: inherit; color: #475569; }
    .role-picker button span { display: flex; flex-direction: column; }
    .role-picker button strong { font-size: 13.5px; color: #0f172a; }
    .role-picker button small { font-size: 12px; color: #64748b; }
    .role-picker button.active { border-color: #0f4b92; background: #eef4fc; color: #0f4b92; }
    .role-picker button:disabled:not(.active) { opacity: 0.45; cursor: not-allowed; }
    .tech-hint { grid-column: 1 / -1; font-size: 12.5px; color: #9a5d0c; background: #fdf3e6; border-radius: 10px; padding: 10px 12px; margin: 0; }
    .quick-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 20px; }

    .users-list { display: flex; flex-direction: column; gap: 10px; }
    .user-row {
      display: flex; align-items: center; gap: 14px; background: white; border-radius: 14px;
      border: 1px solid #e2e8f0; padding: 14px 16px; transition: box-shadow 0.2s, border-color 0.2s;
    }
    .user-row:hover { box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0,0,0,0.08)); border-color: var(--color-primary-500, #1465c5); }
    .user-avatar-md {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; color: white;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px;
    }
    .user-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .user-name { font-size: 14px; font-weight: 700; color: #0f172a; }
    .user-sub { font-size: 12.5px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .company-chip {
      display: inline-flex; align-items: center; gap: 5px; background: var(--color-neutral-bg, #f1f5f9);
      color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; flex-shrink: 0;
    }
    .user-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .btn-icon {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: var(--color-neutral-bg, #f1f5f9); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.2s, color 0.2s;
      color: var(--color-text-secondary, #475569);
    }
    .btn-icon:hover { background: var(--color-primary-100, #d1e4fa); color: var(--color-primary-700, #0f4b92); }
    .btn-icon.danger:hover { background: var(--color-danger-bg, #fee2e2); color: var(--color-danger-text, #dc2626); }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input, select {
      padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
    }
    input:focus, select:focus { border-color: var(--color-primary-500, #1465c5); }

    .reset-hint { font-size: 13.5px; color: #475569; background: var(--color-primary-50, #e8f1fd); border-radius: 10px; padding: 12px 14px; margin: 0 0 16px; line-height: 1.5; }

    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
      .user-row { flex-wrap: wrap; }
      .company-chip { order: 3; }
    }
  `]
})
export class UsersComponent {
  private userService = inject(UserService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  isControlInvalid = isControlInvalid;

  search = signal('');
  companyFilter = signal('');
  roleFilter = signal<'' | 'client' | 'technician'>('');
  showModal = signal(false);
  editingId = signal<string | null>(null);
  resetUserTarget = signal<User | null>(null);
  saving = signal(false);

  companies = this.companyService.companies;

  constructor() {
    loadPageData(this.notify, this.userService.load(), this.companyService.load());
  }
  managedUsers = computed(() => this.userService.users().filter(u => u.role === 'client' || u.role === 'technician'));
  clientUsers = computed(() => this.managedUsers().filter(u => u.role === 'client'));
  technicians = computed(() => this.managedUsers().filter(u => u.role === 'technician'));

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

  filteredUsers = computed(() => {
    const rf = this.roleFilter();
    let list = rf ? this.managedUsers().filter(u => u.role === rf) : this.managedUsers();
    const s = this.search().toLowerCase();
    const cf = this.companyFilter();
    if (s) list = list.filter(u => u.name.toLowerCase().includes(s) || u.username.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    if (cf) list = list.filter(u => u.companyId === cf);
    return list;
  });

  private usernameTakenValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      return this.userService.isUsernameTaken(control.value, this.editingId() ?? undefined) ? { taken: true } : null;
    };
  }

  getCompanyName(companyId?: string): string {
    if (!companyId) return 'Sin empresa';
    return this.companyService.getById(companyId)?.name || 'N/A';
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

  openModal() {
    this.editingId.set(null);
    this.form.reset({ role: this.roleFilter() === 'technician' ? 'technician' : 'client', name: '', username: '', email: '', companyId: '', password: '' });
    this.setRole(this.form.getRawValue().role!);
    this.form.get('password')?.enable();
    this.showModal.set(true);
  }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editUser(u: User) {
    this.editingId.set(u.id);
    this.form.patchValue({ name: u.name, username: u.username, email: u.email, companyId: u.companyId || '' });
    this.setRole(u.role === 'technician' ? 'technician' : 'client');
    this.form.get('password')?.disable();
    this.showModal.set(true);
  }

  async saveUser() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const isTech = v.role === 'technician';
    const data = { name: v.name!, username: v.username!, email: v.email!, companyId: isTech ? null : v.companyId! };
    this.saving.set(true);
    try {
      if (this.editingId()) {
        const { companyId, ...common } = data;
        await this.userService.update(this.editingId()!, isTech ? common : { ...common, companyId });
        this.notify.success('Usuario actualizado correctamente.');
      } else {
        await this.userService.create({ ...data, role: v.role!, password: v.password! });
        this.notify.success(isTech ? 'Técnico creado. Ya puede iniciar sesión y tomar tickets.' : 'Usuario creado correctamente.');
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
      title: 'Eliminar usuario',
      message: `¿Eliminar el acceso de "${u.name}" (@${u.username})? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      await this.userService.delete(u.id);
      this.notify.success('Usuario eliminado correctamente.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }

  openResetModal(u: User) {
    this.resetForm.reset({ newPassword: '' });
    this.resetUserTarget.set(u);
  }
  closeResetModal() { this.resetUserTarget.set(null); }

  async confirmReset() {
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }
    const target = this.resetUserTarget();
    if (!target) return;
    try {
      await this.userService.resetPassword(target.id, this.resetForm.value.newPassword!);
      this.notify.success(`Contraseña actualizada para ${target.name}.`);
      this.closeResetModal();
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }
}
