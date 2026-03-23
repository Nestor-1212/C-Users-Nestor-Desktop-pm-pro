import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { CompanyService } from '../../core/services/company.service';
import { Project } from '../../core/models';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="projects-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isOwner() ? 'Todos los Proyectos' : 'Mis Proyectos' }}</h1>
          <p>{{ auth.isOwner() ? 'Gestiona y supervisa todos los proyectos de clientes' : 'Visualiza el avance de tus proyectos' }}</p>
        </div>
        @if (auth.isOwner()) {
          <button class="btn-primary" (click)="openModal()">+ Nuevo Proyecto</button>
        }
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <input type="text" placeholder="Buscar proyecto..." class="search-input"
          [value]="search()" (input)="search.set($any($event.target).value)">
        <select class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="planning">Planificación</option>
          <option value="in_progress">En Progreso</option>
          <option value="review">Revisión</option>
          <option value="completed">Completado</option>
          <option value="on_hold">En Espera</option>
        </select>
        @if (auth.isOwner()) {
          <select class="filter-select" (change)="companyFilter.set($any($event.target).value)">
            <option value="">Todas las empresas</option>
            @for (c of allCompanies(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        }
      </div>

      <!-- Projects List -->
      <div class="projects-list">
        @for (p of filteredProjects(); track p.id) {
          <div class="project-card">
            <div class="project-card-left">
              <div class="priority-dot" [class]="p.priority"></div>
              <div class="project-main">
                <div class="project-header-row">
                  <a [routerLink]="['/projects', p.id]" class="project-title">{{ p.name }}</a>
                  <span class="status-badge" [class]="p.status">{{ statusLabel(p.status) }}</span>
                </div>
                <p class="project-desc">{{ p.description }}</p>
                <div class="project-meta">
                  @if (auth.isOwner()) {
                    <span class="meta-item">🏢 {{ getCompanyName(p.companyId) }}</span>
                  }
                  <span class="meta-item">📅 {{ p.startDate }} → {{ p.endDate }}</span>
                  <span class="meta-item priority-label" [class]="p.priority">{{ priorityLabel(p.priority) }}</span>
                  @if (p.budget) { <span class="meta-item">💰 Q{{ p.budget | number }}</span> }
                </div>
                <div class="tags-row">
                  @for (tag of p.tags || []; track tag) {
                    <span class="tag">{{ tag }}</span>
                  }
                </div>
              </div>
            </div>
            <div class="project-card-right">
              <div class="progress-section">
                <div class="progress-header">
                  <span class="progress-label">Progreso</span>
                  <span class="progress-value">{{ p.progress }}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="p.progress" [style.background]="progressColor(p.progress)"></div>
                </div>
              </div>
              <div class="project-stats">
                <div class="mini-stat">
                  <span class="mini-val">{{ p.comments.length }}</span>
                  <span class="mini-lbl">💬</span>
                </div>
                <div class="mini-stat">
                  <span class="mini-val">{{ p.requirements.length }}</span>
                  <span class="mini-lbl">📋</span>
                </div>
                <div class="mini-stat">
                  <span class="mini-val">{{ p.documents.length }}</span>
                  <span class="mini-lbl">📎</span>
                </div>
              </div>
              <div class="card-actions">
                <a [routerLink]="['/projects', p.id]" class="btn-view">Ver detalle →</a>
                @if (auth.isOwner()) {
                  <button class="btn-icon-sm" (click)="editProject(p)">✏️</button>
                  <button class="btn-icon-sm danger" (click)="deleteProject(p.id)">🗑️</button>
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon">📁</div>
            <h3>Sin proyectos</h3>
            <p>{{ auth.isOwner() ? 'Crea tu primer proyecto.' : 'No tienes proyectos asignados.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal large" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId() ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</h2>
            <button class="modal-close" (click)="closeModal()">✕</button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveProject()" class="modal-body">
            <div class="form-grid">
              <div class="form-group full">
                <label>Nombre del proyecto *</label>
                <input type="text" formControlName="name" placeholder="Ej: Portal E-Commerce">
              </div>
              <div class="form-group full">
                <label>Descripción *</label>
                <textarea formControlName="description" rows="3" placeholder="Describe brevemente el proyecto..."></textarea>
              </div>
              <div class="form-group">
                <label>Empresa cliente *</label>
                <select formControlName="companyId">
                  <option value="">Selecciona empresa</option>
                  @for (c of allCompanies(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
              <div class="form-group">
                <label>Estado</label>
                <select formControlName="status">
                  <option value="planning">Planificación</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="review">Revisión</option>
                  <option value="completed">Completado</option>
                  <option value="on_hold">En Espera</option>
                </select>
              </div>
              <div class="form-group">
                <label>Prioridad</label>
                <select formControlName="priority">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <div class="form-group">
                <label>Progreso (%)</label>
                <input type="number" formControlName="progress" min="0" max="100">
              </div>
              <div class="form-group">
                <label>Fecha inicio *</label>
                <input type="date" formControlName="startDate">
              </div>
              <div class="form-group">
                <label>Fecha fin *</label>
                <input type="date" formControlName="endDate">
              </div>
              <div class="form-group">
                <label>Presupuesto (Q)</label>
                <input type="number" formControlName="budget" placeholder="0">
              </div>
              <div class="form-group full">
                <label>Notas internas (solo visible para ti)</label>
                <textarea formControlName="internalNotes" rows="2" placeholder="Notas privadas del proyecto..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid">
                {{ editingId() ? 'Guardar cambios' : 'Crear proyecto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .projects-page { max-width: 1100px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 4px; }
    .page-header p { color: #64748b; font-size: 14px; margin: 0; }
    .btn-primary { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #475569; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; }

    .filters-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-input, .filter-select { padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; background: white; }
    .search-input { flex: 1; min-width: 200px; }
    .search-input:focus, .filter-select:focus { border-color: #3b82f6; }

    .projects-list { display: flex; flex-direction: column; gap: 12px; }
    .project-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; padding: 20px; display: flex; gap: 20px; transition: box-shadow 0.2s; }
    .project-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .project-card-left { display: flex; gap: 14px; flex: 1; }

    .priority-dot { width: 4px; border-radius: 10px; min-height: 60px; flex-shrink: 0; }
    .priority-dot.low { background: #10b981; }
    .priority-dot.medium { background: #f59e0b; }
    .priority-dot.high { background: #f97316; }
    .priority-dot.critical { background: #ef4444; }

    .project-main { flex: 1; }
    .project-header-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; flex-wrap: wrap; }
    .project-title { font-size: 16px; font-weight: 700; color: #0f172a; text-decoration: none; }
    .project-title:hover { color: #3b82f6; }
    .project-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; line-height: 1.5; }
    .project-meta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .meta-item { font-size: 12px; color: #64748b; }
    .meta-item.priority-label { font-weight: 600; }
    .meta-item.low { color: #10b981; }
    .meta-item.medium { color: #f59e0b; }
    .meta-item.high { color: #f97316; }
    .meta-item.critical { color: #ef4444; }
    .tags-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 500; }

    .project-card-right { display: flex; flex-direction: column; gap: 12px; min-width: 160px; align-items: flex-end; }
    .progress-section { width: 100%; }
    .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .progress-label { font-size: 12px; color: #94a3b8; }
    .progress-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .progress-bar { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 10px; transition: width 0.5s; }

    .project-stats { display: flex; gap: 12px; }
    .mini-stat { display: flex; align-items: center; gap: 4px; }
    .mini-val { font-size: 13px; font-weight: 600; color: #0f172a; }
    .mini-lbl { font-size: 14px; }

    .card-actions { display: flex; align-items: center; gap: 8px; }
    .btn-view { font-size: 13px; color: #3b82f6; font-weight: 600; text-decoration: none; white-space: nowrap; }
    .btn-view:hover { text-decoration: underline; }
    .btn-icon-sm { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
    .btn-icon-sm:hover { background: #f8fafc; }
    .btn-icon-sm.danger:hover { background: #fee2e2; border-color: #fca5a5; }

    .status-badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-badge.planning { background: #e0e7ff; color: #4338ca; }
    .status-badge.in_progress { background: #dbeafe; color: #1d4ed8; }
    .status-badge.review { background: #fef3c7; color: #d97706; }
    .status-badge.completed { background: #dcfce7; color: #16a34a; }
    .status-badge.on_hold { background: #f1f5f9; color: #64748b; }

    .empty-state { text-align: center; padding: 60px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { color: #0f172a; font-size: 18px; margin-bottom: 8px; }
    .empty-state p { color: #94a3b8; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal { background: white; border-radius: 20px; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
    .modal.large { max-width: 700px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; }
    .modal-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; }
    .modal-body { padding: 24px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input, select, textarea { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; resize: vertical; }
    input:focus, select:focus, textarea:focus { border-color: #3b82f6; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 20px; border-top: 1px solid #e2e8f0; margin-top: 20px; }
  `]
})
export class ProjectsComponent {
  auth = inject(AuthService);
  private projectService = inject(ProjectService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);

  search = signal('');
  statusFilter = signal('');
  companyFilter = signal('');
  showModal = signal(false);
  editingId = signal<string | null>(null);

  allCompanies = this.companyService.companies;

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    companyId: ['', Validators.required],
    status: ['planning'],
    priority: ['medium'],
    progress: [0],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    budget: [0 as number | null],
    internalNotes: ['']
  });

  filteredProjects = computed(() => {
    const user = this.auth.currentUser();
    let list = user?.role === 'client'
      ? this.projectService.getByCompany(user.companyId!)
      : this.projectService.getAll();
    const s = this.search().toLowerCase();
    const sf = this.statusFilter();
    const cf = this.companyFilter();
    if (s) list = list.filter(p => p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
    if (sf) list = list.filter(p => p.status === sf);
    if (cf) list = list.filter(p => p.companyId === cf);
    return list;
  });

  getCompanyName(id: string) { return this.companyService.getById(id)?.name || 'N/A'; }
  statusLabel(s: string) {
    const m: any = { planning: 'Planificación', in_progress: 'En Progreso', review: 'Revisión', completed: 'Completado', on_hold: 'En Espera' };
    return m[s] || s;
  }
  priorityLabel(p: string) {
    const m: any = { low: '↓ Baja', medium: '→ Media', high: '↑ Alta', critical: '⚡ Crítica' };
    return m[p] || p;
  }
  progressColor(pct: number) {
    if (pct >= 80) return '#10b981';
    if (pct >= 50) return '#3b82f6';
    if (pct >= 25) return '#f59e0b';
    return '#ef4444';
  }

  openModal() { this.editingId.set(null); this.form.reset({ status: 'planning', priority: 'medium', progress: 0 }); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editProject(p: Project) {
    this.editingId.set(p.id);
    this.form.patchValue({ ...p, budget: p.budget ?? 0 });
    this.showModal.set(true);
  }

  saveProject() {
    if (this.form.invalid) return;
    const v = this.form.value as any;
    v.tags = [];
    if (this.editingId()) {
      this.projectService.update(this.editingId()!, v);
    } else {
      this.projectService.create(v);
    }
    this.closeModal();
  }

  deleteProject(id: string) {
    if (confirm('¿Eliminar este proyecto?')) this.projectService.delete(id);
  }
}
