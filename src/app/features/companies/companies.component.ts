import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { Company } from '../../core/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, StatCardComponent, ModalFocusTrapDirective],
  template: `
    <div class="companies-page">
      <div class="page-header">
        <div>
          <h1>Empresas</h1>
          <p>Gestiona las empresas cliente de tu plataforma</p>
        </div>
        <button class="btn-primary" (click)="openModal()">
          <app-icon name="plus" [size]="16" /> Nueva Empresa
        </button>
      </div>

      <!-- Stats -->
      <div class="quick-stats">
        <app-stat-card [value]="companies().length" label="Total" icon="building" color="blue" />
        <app-stat-card [value]="activeCount()" label="Activas" icon="check" color="green" />
        <app-stat-card [value]="inactiveCount()" label="Inactivas" icon="x" color="gray" />
      </div>

      <!-- Search + Filter -->
      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="company-search" class="sr-only">Buscar empresa</label>
          <input id="company-search" type="text" placeholder="Buscar empresa..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="company-status-filter" class="sr-only">Filtrar por estado</label>
        <select id="company-status-filter" class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="inactive">Inactiva</option>
        </select>
      </div>

      <!-- Companies Grid -->
      <div class="companies-grid">
        @for (c of filteredCompanies(); track c.id) {
          <div class="company-card" [class.inactive]="c.status === 'inactive'">
            <div class="company-card-top">
              <div class="company-avatar-lg" [style.background]="c.logo ? '#fff' : avatarColor(c.id)" [class.has-logo]="c.logo">
                @if (c.logo) {
                  <img [src]="c.logo" [alt]="'Logo de ' + c.name">
                } @else {
                  {{ c.name[0] }}
                }
              </div>
              <div class="company-heading">
                <h3 class="company-title">{{ c.name }}</h3>
                <span class="status-badge sm" [class]="c.status">{{ c.status === 'active' ? 'Activa' : 'Inactiva' }}</span>
              </div>
              <div class="company-actions">
                <button class="btn-icon" (click)="editCompany(c)" title="Editar" aria-label="Editar empresa">
                  <app-icon name="edit" [size]="15" />
                </button>
                <button class="btn-icon danger" (click)="deleteCompany(c.id, c.name)" title="Eliminar" aria-label="Eliminar empresa">
                  <app-icon name="trash" [size]="15" />
                </button>
              </div>
            </div>
            <div class="company-card-body">
              <p class="company-email"><app-icon name="mail" [size]="14" /> {{ c.email }}</p>
              <p class="company-phone"><app-icon name="phone" [size]="14" /> {{ c.phone }}</p>
              @if (c.address) { <p class="company-address"><app-icon name="map-pin" [size]="14" /> {{ c.address }}</p> }
              <div class="company-meta-row">
                <span class="plan-badge" [class]="(c.plan || 'Standard').toLowerCase()">{{ c.plan || 'Standard' }}</span>
              </div>
              <div class="project-count">
                <span><app-icon name="folder" [size]="13" /> {{ getProjectCount(c.id) }} proyecto{{ getProjectCount(c.id) !== 1 ? 's' : '' }}</span>
                <span class="created-date">Desde {{ c.createdAt }}</span>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state grid-span">
            <div class="empty-icon"><app-icon name="building" [size]="32" /></div>
            <h3>Sin empresas</h3>
            <p>No hay empresas que coincidan con tu búsqueda.</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="company-modal-title">{{ editingId() ? 'Editar Empresa' : 'Nueva Empresa' }}</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveCompany()" class="modal-body" novalidate>
            <div class="form-grid">
              <div class="form-group full">
                <label for="company-logo">Logo de la empresa</label>
                <div class="logo-upload-row">
                  <div class="logo-preview">
                    @if (form.value.logo) {
                      <img [src]="form.value.logo" alt="Logo de la empresa">
                    } @else {
                      <app-icon name="image" [size]="20" />
                    }
                  </div>
                  <input id="company-logo" type="file" accept="image/*" (change)="onLogoSelected($event)">
                  @if (form.value.logo) {
                    <button type="button" class="btn-icon" (click)="clearLogo()" title="Quitar logo" aria-label="Quitar logo">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  }
                </div>
              </div>
              <div class="form-group full">
                <label for="company-name">Nombre de la empresa *</label>
                <input id="company-name" type="text" formControlName="name" placeholder="Ej: TechSolutions S.A."
                  [class.error]="invalid('name')" [attr.aria-invalid]="invalid('name')">
                @if (invalid('name')) { <span class="field-error">El nombre es obligatorio.</span> }
              </div>
              <div class="form-group">
                <label for="company-email">Email *</label>
                <input id="company-email" type="email" formControlName="email" placeholder="contacto@empresa.com"
                  [class.error]="invalid('email')" [attr.aria-invalid]="invalid('email')">
                @if (invalid('email')) { <span class="field-error">{{ emailErrorMessage() }}</span> }
              </div>
              <div class="form-group">
                <label for="company-phone">Teléfono *</label>
                <input id="company-phone" type="text" formControlName="phone" placeholder="+502 5555-0000"
                  [class.error]="invalid('phone')" [attr.aria-invalid]="invalid('phone')">
                @if (invalid('phone')) { <span class="field-error">El teléfono es obligatorio.</span> }
              </div>
              <div class="form-group full">
                <label for="company-address">Dirección</label>
                <input id="company-address" type="text" formControlName="address" placeholder="Zona 10, Guatemala City">
              </div>
              <div class="form-group">
                <label for="company-plan">Plan</label>
                <select id="company-plan" formControlName="plan">
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>
              <div class="form-group">
                <label for="company-status">Estado</label>
                <select id="company-status" formControlName="status">
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              @if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">
                {{ editingId() ? 'Guardar cambios' : 'Crear empresa' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .companies-page { max-width: 1100px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .quick-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px; }

    .companies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; }
    .company-card {
      background: white; border-radius: 16px; border: 1px solid #e2e8f0; border-left: 4px solid var(--color-success-text, #16a34a);
      overflow: hidden; transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
    }
    .company-card:hover { box-shadow: var(--shadow-card-hover, 0 8px 24px rgba(0,0,0,0.08)); border-color: var(--color-primary-500, #1465c5); transform: translateY(-2px); }
    .company-card.inactive { border-left-color: var(--color-neutral-text, #64748b); }

    .company-card-top { padding: 18px 16px 0; display: flex; align-items: flex-start; gap: 12px; }
    .company-avatar-lg {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: white;
      box-shadow: 0 4px 10px -4px rgba(15,23,42,0.35);
      overflow: hidden;
    }
    .company-avatar-lg.has-logo { box-shadow: inset 0 0 0 1.5px #e2e8f0; }
    .company-avatar-lg img { width: 100%; height: 100%; object-fit: contain; padding: 4px; box-sizing: border-box; }
    .company-heading { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .company-heading .status-badge { align-self: flex-start; }
    .company-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .btn-icon {
      width: 30px; height: 30px; border-radius: 8px; border: none;
      background: var(--color-neutral-bg, #f1f5f9); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.2s, color 0.2s;
      color: var(--color-text-secondary, #475569);
    }
    .btn-icon:hover { background: var(--color-primary-100, #d1e4fa); color: var(--color-primary-700, #0f4b92); }
    .btn-icon.danger:hover { background: var(--color-danger-bg, #fee2e2); color: var(--color-danger-text, #dc2626); }

    .company-card-body { padding: 14px 16px 16px; }
    .company-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; line-height: 1.3; }
    .company-email, .company-phone, .company-address {
      display: flex; align-items: center; gap: 6px;
      font-size: 13px; color: #64748b; margin: 6px 0;
    }
    .company-email app-icon, .company-phone app-icon, .company-address app-icon { color: #94a3b8; }
    .company-meta-row { display: flex; gap: 8px; align-items: center; margin: 12px 0 10px; }
    .plan-badge { padding: 3px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; }
    .plan-badge.premium { background: #FCEFDF; color: #9A5D09; }
    .plan-badge.standard { background: #F3F7E3; color: #718320; }
    .plan-badge.basic { background: var(--color-neutral-bg, #f1f5f9); color: var(--color-neutral-text, #64748b); }
    .project-count { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 10px; }
    .project-count span:first-child { display: flex; align-items: center; gap: 5px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input, select {
      padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
    }
    input:focus, select:focus { border-color: var(--color-primary-500, #1465c5); }

    .logo-upload-row { display: flex; align-items: center; gap: 10px; }
    .logo-preview {
      width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
      border: 1.5px dashed #cbd5e1; background: #f8fafc; color: #94a3b8;
      display: flex; align-items: center; justify-content: center; overflow: hidden;
    }
    .logo-preview img { width: 100%; height: 100%; object-fit: contain; }
    .logo-upload-row input[type="file"] { flex: 1; font-size: 12.5px; padding: 0; border: none; }

    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
    }
  `]
})
export class CompaniesComponent {
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  companies = this.companyService.companies;
  search = signal('');
  statusFilter = signal('');
  showModal = signal(false);
  editingId = signal<string | null>(null);

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    plan: ['Standard'],
    status: ['active'],
    logo: ['']
  });

  activeCount = computed(() => this.companies().filter(c => c.status === 'active').length);
  inactiveCount = computed(() => this.companies().filter(c => c.status === 'inactive').length);

  filteredCompanies = computed(() => {
    let list = this.companies();
    const s = this.search().toLowerCase();
    const sf = this.statusFilter();
    if (s) list = list.filter(c => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s));
    if (sf) list = list.filter(c => c.status === sf);
    return list;
  });

  getProjectCount(companyId: string) {
    return this.projectService.getAll().filter(p => p.companyId === companyId).length;
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

  emailErrorMessage(): string {
    const c = this.form.get('email');
    if (c?.hasError('required')) return 'El correo es obligatorio.';
    if (c?.hasError('email')) return 'Ingresa un correo electrónico válido.';
    return '';
  }

  openModal() { this.editingId.set(null); this.form.reset({ plan: 'Standard', status: 'active', logo: '' }); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editCompany(c: Company) {
    this.editingId.set(c.id);
    this.form.patchValue(c);
    this.showModal.set(true);
  }

  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.notify.error('El logo debe ser una imagen.');
      input.value = '';
      return;
    }
    if (file.size > 500 * 1024) {
      this.notify.error('La imagen es muy pesada (máximo 500KB).');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.form.patchValue({ logo: reader.result as string });
    reader.readAsDataURL(file);
  }

  clearLogo() {
    this.form.patchValue({ logo: '' });
  }

  saveCompany() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value as any;
    if (this.editingId()) {
      this.companyService.update(this.editingId()!, v);
      this.notify.success('Empresa actualizada correctamente.');
    } else {
      this.companyService.create(v);
      this.notify.success('Empresa creada correctamente.');
    }
    this.closeModal();
  }

  async deleteCompany(id: string, name: string) {
    const projectCount = this.getProjectCount(id);
    const extra = projectCount > 0
      ? ` Tiene ${projectCount} proyecto${projectCount !== 1 ? 's' : ''} asociado${projectCount !== 1 ? 's' : ''} que no se eliminarán automáticamente.`
      : '';
    const ok = await this.confirm.ask({
      title: 'Eliminar empresa',
      message: `¿Eliminar "${name}"? Esta acción no se puede deshacer.${extra}`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    this.companyService.delete(id);
    this.notify.success('Empresa eliminada correctamente.');
  }
}
