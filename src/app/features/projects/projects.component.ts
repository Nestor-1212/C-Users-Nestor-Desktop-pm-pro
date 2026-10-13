import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService, ProjectInput } from '../../core/services/project.service';
import { CompanyService } from '../../core/services/company.service';
import { Project, ProjectPriority, ProjectStatus } from '../../core/models';
import { TourService } from '../../shared/services/tour.service';
import { projectsTour } from '../../shared/services/client-tours';
import { apiErrorMessage, loadPageData } from '../../core/http/api-error';
import { IconComponent } from '../../shared/icon/icon.component';
import { ModalFocusTrapDirective } from '../../shared/directives/modal-focus-trap.directive';
import { ConfirmService } from '../../shared/services/confirm.service';
import { NotificationService } from '../../shared/services/notification.service';
import { isControlInvalid } from '../../shared/utils/form.util';
import { ReportService, ReportColumn, ReportTone } from '../../shared/services/report.service';
import { projectSchedule } from '../../shared/utils/project-health';
import { Project as ProjectModel } from '../../core/models';
import { ProjectStatusLabelPipe, PriorityLabelPipe, PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '../../shared/pipes/labels.pipe';
import { ExportMenuComponent, ExportFormat } from '../../shared/export-menu/export-menu.component';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent, ModalFocusTrapDirective, ProjectStatusLabelPipe, PriorityLabelPipe, ExportMenuComponent],
  template: `
    <div class="projects-page">
      <div class="page-header">
        <div>
          <h1>{{ auth.isStaff() ? 'Todos los Proyectos' : 'Mis Proyectos' }}</h1>
          <p>{{ auth.isStaff() ? 'Gestiona y supervisa todos los proyectos de clientes' : 'Visualiza el avance de tus proyectos' }}</p>
        </div>
        <div class="header-actions">
          <app-export-menu (formatSelected)="exportProjects($event)" />
          @if (auth.isOwner()) {
            <button class="btn-primary" (click)="openModal()">
              <app-icon name="plus" [size]="16" /> Nuevo Proyecto
            </button>
          }
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <div class="search-wrap">
          <app-icon name="search" [size]="16" class="search-icon" />
          <label for="project-search" class="sr-only">Buscar proyecto</label>
          <input id="project-search" type="text" placeholder="Buscar proyecto..." class="search-input"
            [value]="search()" (input)="search.set($any($event.target).value)">
        </div>
        <label for="project-status-filter" class="sr-only">Filtrar por estado</label>
        <select id="project-status-filter" class="filter-select" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Todos los estados</option>
          <option value="planning">Planificación</option>
          <option value="in_progress">En Progreso</option>
          <option value="review">Revisión</option>
          <option value="completed">Completado</option>
          <option value="on_hold">En Espera</option>
        </select>
        @if (auth.isOwner()) {
          <label for="project-company-filter" class="sr-only">Filtrar por empresa</label>
          <select id="project-company-filter" class="filter-select" (change)="companyFilter.set($any($event.target).value)">
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
                  <span class="status-badge" [class]="p.status">{{ p.status | projectStatusLabel }}</span>
                </div>
                <p class="project-desc">{{ p.description }}</p>
                <div class="project-meta">
                  @if (auth.isOwner()) {
                    <span class="meta-item"><app-icon name="building" [size]="13" /> {{ getCompanyName(p.companyId) }}</span>
                  }
                  <span class="meta-item"><app-icon name="calendar" [size]="13" /> {{ p.startDate }} → {{ p.endDate }}</span>
                  <span class="meta-item priority-label" [class]="p.priority">{{ p.priority | priorityLabel }}</span>
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
                <div class="mini-stat" title="Comentarios">
                  <app-icon name="message-circle" [size]="14" />
                  <span class="mini-val">{{ p.commentCount }}</span>
                </div>
                <div class="mini-stat" title="Requerimientos">
                  <app-icon name="clipboard" [size]="14" />
                  <span class="mini-val">{{ p.requirementCount }}</span>
                </div>
                <div class="mini-stat" title="Documentos">
                  <app-icon name="paperclip" [size]="14" />
                  <span class="mini-val">{{ p.documentCount }}</span>
                </div>
              </div>
              <div class="card-actions">
                <a [routerLink]="['/projects', p.id]" class="btn-view">
                  Ver detalle <app-icon name="chevron-right" [size]="13" />
                </a>
                @if (auth.isOwner()) {
                  <button class="btn-icon-sm" (click)="editProject(p)" aria-label="Editar proyecto">
                    <app-icon name="edit" [size]="14" />
                  </button>
                  <button class="btn-icon-sm danger" (click)="deleteProject(p.id, p.name)" aria-label="Eliminar proyecto">
                    <app-icon name="trash" [size]="14" />
                  </button>
                }
              </div>
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <div class="empty-icon"><app-icon name="folder" [size]="32" /></div>
            <h3>Sin proyectos</h3>
            <p>{{ auth.isOwner() ? 'Crea tu primer proyecto.' : 'No tienes proyectos asignados.' }}</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal large" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"
          appModalFocusTrap (closeRequested)="closeModal()" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 id="project-modal-title">{{ editingId() ? 'Editar Proyecto' : 'Nuevo Proyecto' }}</h2>
            <button class="modal-close" (click)="closeModal()" aria-label="Cerrar">
              <app-icon name="x" [size]="18" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="saveProject()" class="modal-body" novalidate>
            <div class="form-grid">
              <div class="form-group full">
                <label for="project-name">Nombre del proyecto *</label>
                <input id="project-name" type="text" formControlName="name" placeholder="Ej: Portal E-Commerce"
                  [class.error]="invalid('name')" [attr.aria-invalid]="invalid('name')">
                @if (invalid('name')) { <span class="field-error">El nombre es obligatorio.</span> }
              </div>
              <div class="form-group full">
                <label for="project-description">Descripción *</label>
                <textarea id="project-description" formControlName="description" rows="3" placeholder="Describe brevemente el proyecto..."
                  [class.error]="invalid('description')" [attr.aria-invalid]="invalid('description')"></textarea>
                @if (invalid('description')) { <span class="field-error">La descripción es obligatoria.</span> }
              </div>
              <div class="form-group">
                <label for="project-company">Empresa cliente *</label>
                <select id="project-company" formControlName="companyId"
                  [class.error]="invalid('companyId')" [attr.aria-invalid]="invalid('companyId')">
                  <option value="">Selecciona empresa</option>
                  @for (c of allCompanies(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                @if (invalid('companyId')) { <span class="field-error">Selecciona una empresa.</span> }
              </div>
              <div class="form-group">
                <label for="project-status">Estado</label>
                <select id="project-status" formControlName="status">
                  <option value="planning">Planificación</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="review">Revisión</option>
                  <option value="completed">Completado</option>
                  <option value="on_hold">En Espera</option>
                </select>
              </div>
              <div class="form-group">
                <label for="project-priority">Prioridad</label>
                <select id="project-priority" formControlName="priority">
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="critical">Crítica</option>
                </select>
              </div>
              <div class="form-group">
                <label for="project-progress">Progreso (%)</label>
                <input id="project-progress" type="number" formControlName="progress" min="0" max="100"
                  [class.error]="invalid('progress')" [attr.aria-invalid]="invalid('progress')">
                @if (invalid('progress')) { <span class="field-error">Debe ser un valor entre 0 y 100.</span> }
              </div>
              <div class="form-group">
                <label for="project-start">Fecha inicio *</label>
                <input id="project-start" type="date" formControlName="startDate"
                  [class.error]="invalid('startDate')" [attr.aria-invalid]="invalid('startDate')">
                @if (invalid('startDate')) { <span class="field-error">La fecha de inicio es obligatoria.</span> }
              </div>
              <div class="form-group">
                <label for="project-end">Fecha fin *</label>
                <input id="project-end" type="date" formControlName="endDate"
                  [class.error]="invalid('endDate')" [attr.aria-invalid]="invalid('endDate')">
                @if (invalid('endDate')) { <span class="field-error">La fecha de fin es obligatoria.</span> }
              </div>
              <div class="form-group full">
                <label for="project-notes">Notas internas (solo visible para ti)</label>
                <textarea id="project-notes" formControlName="internalNotes" rows="2" placeholder="Notas privadas del proyecto..."></textarea>
              </div>
            </div>
            <div class="modal-footer">
              @if (form.hasError('dateOrder')) { <span class="form-hint error-hint">La fecha de fin no puede ser anterior a la de inicio.</span> }
              @else if (form.invalid) { <span class="form-hint">Completa los campos obligatorios (*)</span> }
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ editingId() ? 'Guardar cambios' : 'Crear proyecto' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .projects-page { max-width: var(--page-max-width); margin: 0 auto; }
    .header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .projects-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; }
    @media (min-width: 1400px) { .projects-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
    .project-title:hover { color: var(--color-primary-700, #0f4b92); }
    .project-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; line-height: 1.5; }
    .project-meta { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .meta-item app-icon { color: #94a3b8; }
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
    .progress-label { font-size: 12px; color: #64748b; }
    .progress-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .progress-bar { height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 10px; transition: width 0.5s; }

    .project-stats { display: flex; gap: 12px; }
    .mini-stat { display: flex; align-items: center; gap: 5px; color: #94a3b8; }
    .mini-val { font-size: 13px; font-weight: 600; color: #0f172a; }

    .card-actions { display: flex; align-items: center; gap: 8px; }
    .btn-view { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; color: var(--color-primary-700, #0f4b92); font-weight: 600; text-decoration: none; white-space: nowrap; }
    .btn-view:hover { text-decoration: underline; }
    .btn-icon-sm { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
    .btn-icon-sm:hover { background: #f8fafc; }
    .btn-icon-sm.danger:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group.full { grid-column: 1/-1; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    .modal-body input, .modal-body textarea { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; font-family: inherit; resize: vertical; }
    .modal-body select { padding: 10px 12px; font-size: 14px; width: 100%; box-sizing: border-box; font-family: inherit; }
    .modal-body input:focus, .modal-body textarea:focus { border-color: var(--color-primary-500, #1465c5); }

    @media (max-width: 768px) {
      .project-card { flex-direction: column; }
      .project-card-right { align-items: stretch; min-width: 0; }
      .card-actions { justify-content: space-between; }
    }
    @media (max-width: 640px) {
      .form-grid { grid-template-columns: 1fr; }
      .form-group.full { grid-column: auto; }
    }
  `]
})
export class ProjectsComponent {
  auth = inject(AuthService);
  private reports = inject(ReportService);
  private projectService = inject(ProjectService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmService);
  private notify = inject(NotificationService);

  search = signal('');
  statusFilter = signal('');
  companyFilter = signal('');
  showModal = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);

  allCompanies = this.companyService.companies;

  private tour = inject(TourService);

  constructor() {
    loadPageData(this.notify, this.projectService.load(), ...(this.auth.isStaff() ? [this.companyService.load()] : []));
    this.tour.attach(inject(DestroyRef), 'proyectos', () => this.tour.run(projectsTour()));
  }

  form = this.fb.group({
    name: ['', Validators.required],
    description: ['', Validators.required],
    companyId: ['', Validators.required],
    status: ['planning'],
    priority: ['medium'],
    progress: [0, [Validators.min(0), Validators.max(100)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    internalNotes: ['']
  }, {
    validators: (g: import('@angular/forms').AbstractControl) => {
      const s = g.get('startDate')?.value, e = g.get('endDate')?.value;
      return s && e && e < s ? { dateOrder: true } : null;
    },
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

  exportProjects(format: ExportFormat) {
    const rows = this.filteredProjects();
    const prioTone: Record<string, ReportTone> = { critical: 'bad', high: 'warn', medium: 'info', low: 'muted' };
    const healthTone: Record<string, ReportTone> = { ok: 'ok', upcoming: 'muted', risk: 'warn', late: 'bad', done: 'info', paused: 'muted' };
    const date = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' }); };
    const columns: ReportColumn<ProjectModel>[] = [
      { header: 'Proyecto', value: p => p.name, width: 2.4 },
      { header: 'Empresa', value: p => this.getCompanyName(p.companyId), width: 1.5 },
      { header: 'Estado', value: p => PROJECT_STATUS_LABELS[p.status] ?? p.status, width: 1.1, align: 'center', tone: p => (p.status === 'completed' ? 'ok' : p.status === 'on_hold' ? 'muted' : 'info') },
      { header: 'Prioridad', value: p => PRIORITY_LABELS[p.priority] ?? p.priority, width: 0.9, align: 'center', tone: p => prioTone[p.priority] },
      { header: 'Avance', value: p => `${p.progress}%`, width: 0.8, align: 'center' },
      { header: 'Salud', value: p => projectSchedule(p).label, width: 1, align: 'center', tone: p => healthTone[projectSchedule(p).tone] },
      { header: 'Inicio', value: p => date(p.startDate), width: 1.1 },
      { header: 'Entrega', value: p => date(p.endDate), width: 1.1 },
    ];
    const active = rows.filter(p => p.status !== 'completed');
    const atRisk = active.filter(p => ['risk', 'late'].includes(projectSchedule(p).tone)).length;
    const statusLabel = this.statusFilter() ? PROJECT_STATUS_LABELS[this.statusFilter()] : '';
    const company = this.companyFilter() ? this.getCompanyName(this.companyFilter()) : '';
    this.reports.export(format, {
      title: 'Reporte de proyectos',
      subtitle: [statusLabel || 'Todos los estados', company || 'Todas las empresas', this.search().trim() && `Búsqueda: "${this.search().trim()}"`].filter(Boolean).join(' · '),
      filename: 'proyectos',
      columns, rows,
      summary: [
        { label: 'Proyectos', value: rows.length },
        { label: 'En curso', value: active.length, tone: 'info' },
        { label: 'Avance promedio (en curso)', value: active.length ? `${Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length)}%` : '—' },
        { label: 'En riesgo o atrasados', value: atRisk, tone: atRisk ? 'bad' : 'ok' },
      ],
    });
  }

  progressColor(pct: number) {
    if (pct >= 80) return '#10b981';
    if (pct >= 50) return 'var(--color-primary-500, #1465c5)';
    if (pct >= 25) return '#f59e0b';
    return '#ef4444';
  }

  invalid(name: string): boolean {
    return isControlInvalid(this.form.get(name));
  }

  openModal() { this.editingId.set(null); this.form.reset({ status: 'planning', priority: 'medium', progress: 0 }); this.showModal.set(true); }
  closeModal() { this.showModal.set(false); this.editingId.set(null); }

  editProject(p: Project) {
    this.editingId.set(p.id);
    this.form.patchValue(p);
    this.showModal.set(true);
  }

  async saveProject() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const data: ProjectInput = {
      name: v.name!, description: v.description!, companyId: v.companyId!,
      status: v.status as ProjectStatus, priority: v.priority as ProjectPriority, progress: v.progress ?? 0,
      startDate: v.startDate!, endDate: v.endDate!,
      internalNotes: v.internalNotes || null,
    };
    this.saving.set(true);
    try {
      if (this.editingId()) {
        // Sin "tags": el formulario no las edita, así que no se tocan las existentes.
        await this.projectService.update(this.editingId()!, data);
        this.notify.success('Proyecto actualizado correctamente.');
      } else {
        await this.projectService.create({ ...data, tags: [] });
        this.notify.success('Proyecto creado correctamente.');
      }
      this.closeModal();
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProject(id: string, name: string) {
    const ok = await this.confirm.ask({
      title: 'Eliminar proyecto',
      message: `¿Eliminar "${name}"? Se perderán sus comentarios, requerimientos y documentos. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true
    });
    if (!ok) return;
    try {
      await this.projectService.delete(id);
      this.notify.success('Proyecto eliminado correctamente.');
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
    }
  }
}
