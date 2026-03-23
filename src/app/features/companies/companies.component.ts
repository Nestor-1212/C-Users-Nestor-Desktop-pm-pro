import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CompanyService } from '../../core/services/company.service';
import { ProjectService } from '../../core/services/project.service';
import { Company } from '../../core/models';

@Component({
  selector: 'app-companies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="companies-page">
      <div class="page-header">
        <div>
          <h1>Empresas</h1>
          <p>Gestiona las empresas cliente de tu plataforma</p>
        </div>
        <button class="btn-primary" (click)="openModal()">+ Nueva Empresa</button>
      </div>

      <!-- Stats -->
      <div class="quick-stats">
        <div class="qs-card">
          <span class="qs-val">{{ companies().length }}</span>
          <span class="qs-lbl">Total</span>
        </div>
        <div class="qs-card">
          <span class="qs-val green">{{ activeCount() }}</span>
          <span class="qs-lbl">Activas</span>
        </div>
        <div class="qs-card">
          <span class="qs-val gray">{{ inactiveCount() }}</span>
          <span class="qs-lbl">Inactivas</span>
        </div>
      </div>

      <!-- Search + Filter -->
      <div class="filters-row">
        <input type="text" placeholder="Buscar empresa..." class="search-input"
          [value]="search()" (input)="search.set($any($event.target).value)">
        <select class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="inactive">Inactiva</option>
        </select>
      </div>

      <!-- Companies Grid -->
      <div class="companies-grid">
        @for (c of filteredCompanies(); track c.id) {
          <div class="company-card">
            <div class="company-card-header">
              <div class="company-avatar-lg">{{ c.name[0] }}</div>
              <div class="company-actions">
                <button class="btn-icon" (click)="editCompany(c)" title="Editar">✏️</button>
                <button class="btn-icon danger" (click)="deleteCompany(c.id)" title="Eliminar">🗑️</button>
              </div>
            </div>
            <div class="company-card-body">
              <h3 class="company-title">{{ c.name }}</h3>
              <p class="company-email">📧 {{ c.email }}</p>
              <p class="company-phone">📞 {{ c.phone }}</p>
              @if (c.address) { <p class="company-address">📍 {{ c.address }}</p> }
              <div class="company-meta-row">
                <span class="plan-badge">{{ c.plan || 'Standard' }}</span>
                <span class="status-badge" [class]="c.status">{{ c.status === 'active' ? 'Activa' : 'Inactiva' }}</span>
              </div>
              <div class="project-count">
                <span>📁 {{ getProjectCount(c.id) }} proyecto{{ getProjectCount(c.id) !== 1 ? 's' : '' }}</span>
                <span class="created-date">Desde {{ c.createdAt }}</span>
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon">🏢</div>
            <h3>Sin empresas</h3>
            <p>No hay empresas que coincidan con tu búsqueda.</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId() ? 'Editar Empresa' : 'Nueva Empresa' }}</h2>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveCompany()" class="modal-body">
            <div class="form-grid">
              <div class="form-group full">
                <label>Nombre de la empresa *</label>
                <input type="text" formControlName="name" placeholder="Ej: TechSolutions S.A.">
              </div>
              <div class="form-group">
                <label>Email *</label>
                <input type="email" formControlName="email" placeholder="contacto@empresa.com">
              </div>
              <div class="form-group">
                <label>Teléfono *</label>
                <input type="text" formControlName="phone" placeholder="+502 5555-0000">
              </div>
              <div class="form-group full">
                <label>Dirección</label>
                <input type="text" formControlName="address" placeholder="Zona 10, Guatemala City">
              </div>
              <div class="form-group">
                <label>Plan</label>
                <select formControlName="plan">
                  <option value="Basic">Basic</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>
              <div class="form-group">
                <label>Estado</label>
                <select formControlName="status">
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
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
    .companies-page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .page-header p { color: #64748b; font-size: 14px; margin: 0; }

    .btn-primary {
      background: linear-gradient(135deg, #1e40af, #3b82f6); color: white;
      border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary {
      background: #f1f5f9; color: #475569; border: none; border-radius: 10px;
      padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
    }

    .quick-stats { display: flex; gap: 16px; margin-bottom: 20px; }
    .qs-card {
      background: white; border-radius: 12px; padding: 16px 24px;
      border: 1px solid #e2e8f0; text-align: center;
    }
    .qs-val { display: block; font-size: 24px; font-weight: 800; color: #1e40af; }
    .qs-val.green { color: #059669; }
    .qs-val.gray { color: #64748b; }
    .qs-lbl { font-size: 12px; color: #94a3b8; font-weight: 500; }

    .filters-row { display: flex; gap: 12px; margin-bottom: 20px; }
    .search-input, .filter-select {
      padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px;
      font-size: 14px; outline: none; background: white;
    }
    .search-input { flex: 1; }
    .search-input:focus, .filter-select:focus { border-color: #3b82f6; }

    .companies-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .company-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; transition: box-shadow 0.2s; }
    .company-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
    .company-card-header {
      background: linear-gradient(135deg, #0f1f3d, #1e3a8a);
      padding: 20px; display: flex; justify-content: space-between; align-items: center;
    }
    .company-avatar-lg {
      width: 50px; height: 50px; border-radius: 14px;
      background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800; color: white;
    }
    .company-actions { display: flex; gap: 6px; }
    .btn-icon {
      width: 32px; height: 32px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.1); cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center; transition: background 0.2s;
    }
    .btn-icon:hover { background: rgba(255,255,255,0.2); }
    .btn-icon.danger:hover { background: rgba(239,68,68,0.3); }

    .company-card-body { padding: 16px; }
    .company-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
    .company-email, .company-phone, .company-address { font-size: 13px; color: #64748b; margin: 4px 0; }
    .company-meta-row { display: flex; gap: 8px; align-items: center; margin: 12px 0 8px; }
    .plan-badge { background: #e0e7ff; color: #4338ca; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.active { background: #dcfce7; color: #16a34a; }
    .status-badge.inactive { background: #f1f5f9; color: #64748b; }
    .project-count { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }

    .empty-state { grid-column: 1/-1; text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { color: #0f172a; font-size: 18px; margin-bottom: 8px; }
    .empty-state p { color: #94a3b8; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: white; border-radius: 20px; width: 100%; max-width: 560px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; }
    .modal-body { padding: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input, select {
      padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px;
      font-size: 14px; outline: none; width: 100%; box-sizing: border-box;
    }
    input:focus, select:focus { border-color: #3b82f6; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 20px; }
  `]
})
export class CompaniesComponent {
  private companyService = inject(CompanyService);
  private projectService = inject(ProjectService);
  private fb = inject(FormBuilder);

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
    status: ['active']
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

  openModal() { this.editingId.set(null); this.form.reset({ plan: 'Standard', status: 'active' }); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editCompany(c: Company) {
    this.editingId.set(c.id);
    this.form.patchValue(c);
    this.showModal.set(true);
  }

  saveCompany() {
    if (this.form.invalid) return;
    const v = this.form.value as any;
    if (this.editingId()) {
      this.companyService.update(this.editingId()!, v);
    } else {
      this.companyService.create(v);
    }
    this.closeModal();
  }

  deleteCompany(id: string) {
    if (confirm('¿Eliminar esta empresa?')) this.companyService.delete(id);
  }
}
