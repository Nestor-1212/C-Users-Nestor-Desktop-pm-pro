import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, ProjectLink, ProjectLinkType, ProjectStage } from '../../core/models';
import { ProjectLinkInput, ProjectService } from '../../core/services/project.service';
import { apiErrorMessage } from '../../core/http/api-error';
import { IconComponent, IconName } from '../../shared/icon/icon.component';
import { NotificationService } from '../../shared/services/notification.service';
import { expectedProgress, projectSchedule } from '../../shared/utils/project-health';

const LINK_TYPES: { value: ProjectLinkType; label: string; icon: IconName }[] = [
  { value: 'staging', label: 'Sitio de pruebas', icon: 'globe' },
  { value: 'production', label: 'Sitio publicado', icon: 'globe' },
  { value: 'design', label: 'Diseño', icon: 'image' },
  { value: 'video', label: 'Video', icon: 'play' },
  { value: 'other', label: 'Otro', icon: 'external-link' },
];

const emptyLink = (): ProjectLinkInput => ({ label: '', url: '', type: 'staging', username: '', password: '' });

@Component({
  selector: 'app-project-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, IconComponent],
  template: `
    <!-- Avance general -->
    <section class="track-card overview">
      <div class="overview-top">
        <div>
          <span class="eyebrow">Avance general</span>
          <div class="big-pct">{{ project().progress }}<small>%</small></div>
        </div>
        <span class="schedule-badge" [class]="schedule().tone">
          <span class="dot"></span>{{ schedule().label }}
        </span>
      </div>
      <div class="main-bar" role="progressbar" [attr.aria-valuenow]="project().progress" aria-valuemin="0" aria-valuemax="100">
        <div class="main-fill" [style.width.%]="project().progress"></div>
        @if (expectedProgress() !== null && schedule().tone !== 'done') {
          <div class="expected-mark" [style.left.%]="expectedProgress()" [title]="'Lo esperado a hoy: ' + expectedProgress() + '%'"></div>
        }
      </div>
      <div class="overview-meta">
        <span><app-icon name="calendar" [size]="14" /> Inicio {{ project().startDate | date:'d MMM y' }}</span>
        <span><app-icon name="check" [size]="14" /> Entrega {{ project().endDate | date:'d MMM y' }}</span>
        <span class="meta-strong"><app-icon name="clock" [size]="14" /> {{ schedule().detail }}</span>
      </div>
    </section>

    <!-- Etapas -->
    <section class="track-card stages-card">
      <div class="section-head">
        <h3><app-icon name="trending-up" [size]="17" /> Etapas</h3>
        @if (canEdit() && !editingStages()) {
          <button class="btn-ghost" (click)="startEditStages()"><app-icon name="edit" [size]="14" /> Editar etapas</button>
        }
      </div>

      @if (!editingStages()) {
        <ol class="stage-list">
          @for (s of project().stages; track $index) {
            <li class="stage" [class]="stageState(s)">
              <span class="stage-icon">
                @if (s.progress >= 100) { <app-icon name="check" [size]="14" [strokeWidth]="2.5" /> }
                @else { {{ $index + 1 }} }
              </span>
              <div class="stage-body">
                <div class="stage-row">
                  <span class="stage-name">{{ s.name }}</span>
                  <span class="stage-pct">{{ s.progress }}%</span>
                </div>
                <div class="stage-bar"><div class="stage-fill" [style.width.%]="s.progress"></div></div>
                <span class="stage-meta">
                  {{ stageStateLabel(s) }}
                  @if (s.startDate && s.endDate) { · {{ s.startDate | date:'d MMM' }} – {{ s.endDate | date:'d MMM y' }} }
                </span>
              </div>
            </li>
          } @empty {
            <p class="empty">Este proyecto todavía no tiene etapas.</p>
          }
        </ol>
      } @else {
        <div class="stage-editor">
          <p class="hint">El avance general es el promedio de las etapas. Las etapas con tareas en el cronograma calculan su avance solas. Quitar una etapa borra también sus tareas.</p>
          @for (s of draftStages(); track $index; let i = $index, last = $last) {
            <div class="stage-edit-row">
              <div class="order-btns">
                <button type="button" [disabled]="i === 0" (click)="moveStage(i, -1)" aria-label="Subir etapa">▲</button>
                <button type="button" [disabled]="last" (click)="moveStage(i, 1)" aria-label="Bajar etapa">▼</button>
              </div>
              <input class="name-input" [(ngModel)]="s.name" placeholder="Nombre de la etapa" [attr.aria-label]="'Nombre etapa ' + (i + 1)">
              <div class="pct-edit" [title]="hasTasks(s) ? 'Se calcula con las tareas del cronograma' : ''">
                <input type="range" min="0" max="100" step="5" [(ngModel)]="s.progress" [disabled]="hasTasks(s)" [attr.aria-label]="'Avance etapa ' + (i + 1)">
                <input type="number" min="0" max="100" [(ngModel)]="s.progress" [disabled]="hasTasks(s)" class="pct-num" aria-label="Porcentaje">
              </div>
              <input type="date" [(ngModel)]="s.startDate" aria-label="Inicio de la etapa">
              <input type="date" [(ngModel)]="s.endDate" aria-label="Fin de la etapa">
              <button type="button" class="icon-btn danger" (click)="removeStage(i)" aria-label="Quitar etapa"><app-icon name="trash" [size]="15" /></button>
            </div>
          }
          <div class="editor-actions">
            <button type="button" class="btn-ghost" (click)="addStage()"><app-icon name="plus" [size]="14" /> Agregar etapa</button>
            <span class="spacer"></span>
            <span class="preview">Avance resultante: <strong>{{ draftAverage() }}%</strong></span>
            <button type="button" class="btn-secondary" (click)="editingStages.set(false)">Cancelar</button>
            <button type="button" class="btn-primary" [disabled]="saving()" (click)="saveStages()">Guardar etapas</button>
          </div>
        </div>
      }
    </section>

    <!-- Enlaces -->
    <section class="track-card links-card">
      <div class="section-head">
        <h3><app-icon name="globe" [size]="17" /> Ver el proyecto</h3>
        @if (canEdit() && !linkForm()) {
          <button class="btn-ghost" (click)="openLinkForm()"><app-icon name="plus" [size]="14" /> Agregar enlace</button>
        }
      </div>

      @if (linkForm(); as f) {
        <div class="link-form">
          <div class="form-grid">
            <label>Nombre<input [(ngModel)]="f.label" placeholder="Ej. Sitio de pruebas"></label>
            <label>Tipo
              <select [(ngModel)]="f.type">
                @for (t of linkTypes; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
              </select>
            </label>
            <label class="wide">Enlace (URL)<input [(ngModel)]="f.url" placeholder="https://..."></label>
            <label>Usuario (opcional)<input [(ngModel)]="f.username" autocomplete="off"></label>
            <label>Contraseña (opcional)<input [(ngModel)]="f.password" autocomplete="off"></label>
          </div>
          <p class="hint">El usuario y la contraseña los verá el cliente junto al enlace. Usa credenciales de pruebas.</p>
          <div class="editor-actions">
            <span class="spacer"></span>
            <button type="button" class="btn-secondary" (click)="closeLinkForm()">Cancelar</button>
            <button type="button" class="btn-primary" [disabled]="saving() || !f.label.trim() || !f.url.trim()" (click)="saveLink()">
              {{ editingLinkId() ? 'Guardar cambios' : 'Agregar enlace' }}
            </button>
          </div>
        </div>
      }

      <div class="link-grid">
        @for (l of project().links; track l.id) {
          <div class="link-card">
            <div class="link-head">
              <span class="link-icon" [class]="l.type"><app-icon [name]="linkIcon(l.type)" [size]="18" /></span>
              <div class="link-title">
                <span class="link-label">{{ l.label }}</span>
                <span class="link-type">{{ linkTypeLabel(l.type) }}</span>
              </div>
              @if (canEdit()) {
                <button class="icon-btn" (click)="openLinkForm(l)" aria-label="Editar enlace"><app-icon name="edit" [size]="14" /></button>
                <button class="icon-btn danger" (click)="deleteLink(l)" aria-label="Eliminar enlace"><app-icon name="trash" [size]="14" /></button>
              }
            </div>
            @if (l.username || l.password) {
              <div class="creds">
                @if (l.username) {
                  <div class="cred-row">
                    <span class="cred-key">Usuario</span>
                    <code>{{ l.username }}</code>
                    <button class="icon-btn" (click)="copy(l.username)" aria-label="Copiar usuario"><app-icon name="copy" [size]="13" /></button>
                  </div>
                }
                @if (l.password) {
                  <div class="cred-row">
                    <span class="cred-key">Contraseña</span>
                    <code>{{ revealed().has(l.id) ? l.password : '••••••••' }}</code>
                    <button class="icon-btn" (click)="toggleReveal(l.id)" [attr.aria-label]="revealed().has(l.id) ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                      <app-icon [name]="revealed().has(l.id) ? 'eye-off' : 'eye'" [size]="13" />
                    </button>
                    <button class="icon-btn" (click)="copy(l.password)" aria-label="Copiar contraseña"><app-icon name="copy" [size]="13" /></button>
                  </div>
                }
              </div>
            }
            <a class="btn-open" [href]="l.url" target="_blank" rel="noopener noreferrer">
              Abrir <app-icon name="external-link" [size]="14" />
            </a>
            <span class="link-updated">Actualizado {{ l.updatedAt | date:'d MMM y' }}</span>
          </div>
        } @empty {
          @if (!linkForm()) {
            <p class="empty">{{ canEdit() ? 'Agrega un enlace para que el cliente vea el proyecto funcionando.' : 'Cuando haya una versión para revisar, aquí aparecerá el enlace.' }}</p>
          }
        }
      </div>
    </section>

    <!-- Últimos avances -->
    <section class="track-card updates-card">
      <div class="section-head">
        <h3><app-icon name="bell" [size]="17" /> Últimos avances</h3>
      </div>

      @if (canEdit()) {
        <div class="update-form">
          <textarea [(ngModel)]="newUpdate" rows="2" maxlength="500" placeholder="Ej. Terminamos el módulo de pagos; ya está en el sitio de pruebas." aria-label="Nuevo avance"></textarea>
          <button class="btn-primary" [disabled]="saving() || !newUpdate.trim()" (click)="publishUpdate()">
            <app-icon name="send" [size]="14" /> Publicar
          </button>
        </div>
      }

      <ul class="timeline">
        @for (u of project().updates; track u.id) {
          <li>
            <span class="tl-dot"></span>
            <div class="tl-body">
              <span class="tl-date">{{ u.createdAt | date:'d MMM y, HH:mm' }} · {{ u.authorName }}</span>
              <p>{{ u.content }}</p>
            </div>
            @if (canEdit()) {
              <button class="icon-btn danger" (click)="deleteUpdate(u.id)" aria-label="Eliminar avance"><app-icon name="trash" [size]="13" /></button>
            }
          </li>
        } @empty {
          <p class="empty">Todavía no hay avances publicados.</p>
        }
      </ul>
    </section>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 16px; }
    /* Pantallas anchas: etapas a la izquierda; enlaces y avances a la derecha. */
    @media (min-width: 1200px) {
      :host { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); align-items: start; }
      .overview { grid-column: 1 / -1; }
      .stages-card { grid-column: 1; grid-row: 2 / span 2; }
      .links-card { grid-column: 2; }
      .updates-card { grid-column: 2; }
      .links-card .link-grid { grid-template-columns: 1fr; }
    }
    .track-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px 24px; }
    .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
    .section-head h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .section-head h3 app-icon { color: var(--color-primary-700, #0f4b92); }
    .empty { color: #64748b; font-size: 14px; text-align: center; padding: 12px; margin: 0; }
    .hint { font-size: 12.5px; color: #64748b; margin: 0 0 12px; }

    /* Avance general */
    .overview { background: #0f4b92; border: none; color: #fff; }
    .overview-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .eyebrow { font-size: 13px; font-weight: 600; opacity: 0.85; }
    .big-pct { font-size: 52px; font-weight: 800; line-height: 1.05; letter-spacing: -1px; }
    .big-pct small { font-size: 24px; opacity: 0.8; margin-left: 2px; }
    .schedule-badge { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; background: rgba(255,255,255,0.16); white-space: nowrap; }
    .schedule-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .schedule-badge.ok, .schedule-badge.done { color: #d9f99d; }
    .schedule-badge.risk { color: #fde68a; }
    .schedule-badge.late { color: #fecaca; }
    .schedule-badge.paused, .schedule-badge.upcoming { color: #e2e8f0; }
    .main-bar { position: relative; height: 14px; background: rgba(255,255,255,0.2); border-radius: 999px; margin: 16px 0 14px; }
    .main-fill { height: 100%; border-radius: 999px; background: #a9c238; transition: width 0.6s ease; }
    .expected-mark { position: absolute; top: -4px; bottom: -4px; width: 3px; margin-left: -1.5px; background: #fff; border-radius: 2px; opacity: 0.9; }
    .overview-meta { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: 13px; opacity: 0.95; }
    .overview-meta span { display: inline-flex; align-items: center; gap: 6px; }
    .meta-strong { font-weight: 700; }

    /* Etapas */
    .stage-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .stage { display: flex; gap: 14px; padding: 10px 0; position: relative; }
    .stage:not(:last-child)::after { content: ''; position: absolute; left: 14px; top: 42px; bottom: -6px; width: 2px; background: #e2e8f0; }
    .stage-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; background: #f1f5f9; color: #94a3b8; border: 2px solid #e2e8f0; }
    .stage.done .stage-icon { background: #a9c238; border-color: #a9c238; color: #fff; }
    .stage.active .stage-icon { background: #fff; border-color: #1465c5; color: #1465c5; box-shadow: 0 0 0 4px rgba(20,101,197,0.12); }
    .stage-body { flex: 1; min-width: 0; }
    .stage-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .stage-name { font-size: 14.5px; font-weight: 700; color: #0f172a; }
    .stage.pending .stage-name { color: #64748b; }
    .stage-pct { font-size: 13px; font-weight: 700; color: #0f172a; }
    .stage-bar { height: 8px; background: #f1f5f9; border-radius: 999px; margin: 7px 0 5px; overflow: hidden; }
    .stage-fill { height: 100%; border-radius: 999px; background: #0f4b92; transition: width 0.5s ease; }
    .stage.done .stage-fill { background: #a9c238; }
    .stage-meta { font-size: 12px; color: #64748b; }

    .stage-editor { display: flex; flex-direction: column; gap: 10px; }
    .stage-edit-row { display: grid; grid-template-columns: auto 1.4fr 1.6fr 1fr 1fr auto; gap: 8px; align-items: center; }
    .order-btns { display: flex; flex-direction: column; }
    .order-btns button { border: none; background: none; color: #64748b; cursor: pointer; font-size: 10px; line-height: 1.2; padding: 1px 4px; }
    .order-btns button:disabled { opacity: 0.3; cursor: default; }
    .pct-edit { display: flex; align-items: center; gap: 8px; }
    .pct-edit input[type=range] { flex: 1; accent-color: #0f4b92; }
    .pct-num { width: 58px; }

    input, textarea { padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 13.5px; font-family: inherit; outline: none; box-sizing: border-box; min-width: 0; }
    select { padding: 8px 10px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; min-width: 0; }
    input:focus, textarea:focus { border-color: #1465c5; }
    .editor-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .spacer { flex: 1; }
    .preview { font-size: 13px; color: #475569; }

    .btn-primary, .btn-secondary, .btn-ghost, .btn-open { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; padding: 8px 14px; border: none; text-decoration: none; }
    .btn-primary { background: #0f4b92; color: #fff; }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #334155; }
    .btn-ghost { background: #eef4fc; color: #0f4b92; }
    .icon-btn { border: none; background: transparent; color: #64748b; cursor: pointer; padding: 5px; border-radius: 7px; display: inline-flex; }
    .icon-btn:hover { background: #f1f5f9; color: #0f172a; }
    .icon-btn.danger:hover { background: #fee2e2; color: #dc2626; }

    /* Enlaces */
    .link-form { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; margin-bottom: 10px; }
    .form-grid label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; }
    .form-grid .wide { grid-column: 1 / -1; }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
    .link-grid > .empty { grid-column: 1 / -1; }
    .link-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: box-shadow 0.2s, border-color 0.2s; }
    .link-card:hover { border-color: #c7d7ee; box-shadow: 0 6px 18px rgba(15,75,146,0.08); }
    .link-head { display: flex; align-items: center; gap: 10px; }
    .link-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: #eef4fc; color: #0f4b92; flex-shrink: 0; }
    .link-icon.production { background: #f2f7e1; color: #6b7d1c; }
    .link-icon.design { background: #fdf3e6; color: #c47a14; }
    .link-icon.video { background: #fee2e2; color: #dc2626; }
    .link-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .link-label { font-size: 14.5px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .link-type { font-size: 12px; color: #64748b; }
    .creds { background: #f8fafc; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
    .cred-row { display: flex; align-items: center; gap: 6px; font-size: 12.5px; }
    .cred-key { color: #64748b; width: 74px; flex-shrink: 0; }
    .cred-row code { flex: 1; font-family: ui-monospace, Consolas, monospace; color: #0f172a; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; }
    .btn-open { justify-content: center; background: #e99d34; color: #fff; padding: 10px; font-size: 14px; }
    .btn-open:hover { background: #d48a22; }
    .link-updated { font-size: 11.5px; color: #94a3b8; text-align: center; margin-top: -4px; }

    /* Últimos avances */
    .update-form { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 16px; }
    .update-form textarea { flex: 1; resize: vertical; }
    .timeline { list-style: none; margin: 0; padding: 0; }
    .timeline li { display: flex; gap: 12px; padding: 0 0 16px; position: relative; }
    .timeline li:not(:last-child)::before { content: ''; position: absolute; left: 5px; top: 14px; bottom: 0; width: 2px; background: #e2e8f0; }
    .tl-dot { width: 12px; height: 12px; border-radius: 50%; background: #a9c238; margin-top: 4px; flex-shrink: 0; box-shadow: 0 0 0 3px #f2f7e1; }
    .tl-body { flex: 1; }
    .tl-date { font-size: 12px; color: #64748b; }
    .tl-body p { margin: 3px 0 0; font-size: 14px; color: #1e293b; line-height: 1.5; }

    @media (max-width: 768px) {
      .stage-edit-row { grid-template-columns: auto 1fr auto; }
      .stage-edit-row .pct-edit, .stage-edit-row input[type=date] { grid-column: 2 / 3; }
      .form-grid { grid-template-columns: 1fr; }
      .update-form { flex-direction: column; align-items: stretch; }
      .big-pct { font-size: 42px; }
    }
  `]
})
export class ProjectTrackingComponent {
  project = input.required<Project>();
  /** Equipo de 3TECH: puede editar; el cliente solo ve. */
  canEdit = input(false);

  private projectService = inject(ProjectService);
  private notify = inject(NotificationService);

  linkTypes = LINK_TYPES;
  saving = signal(false);
  editingStages = signal(false);
  draftStages = signal<ProjectStage[]>([]);
  linkForm = signal<ProjectLinkInput | null>(null);
  editingLinkId = signal<string | null>(null);
  revealed = signal(new Set<string>());
  newUpdate = '';

  expectedProgress = computed(() => expectedProgress(this.project()));
  schedule = computed(() => projectSchedule(this.project()));

  // Método y no computed: ngModel muta las etapas del borrador sin emitir en la signal.
  draftAverage(): number {
    const st = this.draftStages();
    return st.length ? Math.round(st.reduce((s, x) => s + Number(x.progress || 0), 0) / st.length) : 0;
  }

  hasTasks(s: ProjectStage): boolean {
    return !!s.id && this.project().tasks.some(t => t.stageId === s.id && !t.isMilestone);
  }

  stageState(s: ProjectStage): 'done' | 'active' | 'pending' {
    return s.progress >= 100 ? 'done' : s.progress > 0 ? 'active' : 'pending';
  }

  stageStateLabel(s: ProjectStage): string {
    return { done: 'Terminada', active: 'En curso', pending: 'Pendiente' }[this.stageState(s)];
  }

  linkIcon(type: ProjectLinkType): IconName { return LINK_TYPES.find(t => t.value === type)?.icon ?? 'external-link'; }
  linkTypeLabel(type: ProjectLinkType): string { return LINK_TYPES.find(t => t.value === type)?.label ?? 'Enlace'; }

  private async run(action: Promise<unknown>, successMessage: string): Promise<boolean> {
    this.saving.set(true);
    try {
      await action;
      this.notify.success(successMessage);
      return true;
    } catch (err) {
      this.notify.error(apiErrorMessage(err));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  // ── Etapas ──
  startEditStages() {
    this.draftStages.set(this.project().stages.map(s => ({ ...s })));
    this.editingStages.set(true);
  }

  addStage() {
    this.draftStages.update(list => [...list, { name: '', progress: 0 }]);
  }

  removeStage(i: number) {
    this.draftStages.update(list => list.filter((_, idx) => idx !== i));
  }

  moveStage(i: number, dir: -1 | 1) {
    this.draftStages.update(list => {
      const copy = list.slice();
      [copy[i], copy[i + dir]] = [copy[i + dir], copy[i]];
      return copy;
    });
  }

  async saveStages() {
    const stages = this.draftStages().map(s => ({ ...s, name: s.name.trim(), progress: Math.max(0, Math.min(100, Math.round(Number(s.progress) || 0))) }));
    if (stages.some(s => !s.name)) { this.notify.error('Cada etapa necesita un nombre.'); return; }
    const keptIds = new Set(stages.map(s => s.id));
    const lostTasks = this.project().tasks.filter(t => !keptIds.has(t.stageId)).length;
    if (lostTasks && !confirm(`Las etapas que quitaste tienen ${lostTasks} tarea(s) en el cronograma que también se borrarán. ¿Continuar?`)) return;
    if (await this.run(this.projectService.saveStages(this.project().id, stages), 'Etapas actualizadas.')) {
      this.editingStages.set(false);
    }
  }

  // ── Enlaces ──
  openLinkForm(link?: ProjectLink) {
    this.editingLinkId.set(link?.id ?? null);
    this.linkForm.set(link
      ? { label: link.label, url: link.url, type: link.type, username: link.username ?? '', password: link.password ?? '' }
      : emptyLink());
  }

  closeLinkForm() {
    this.linkForm.set(null);
    this.editingLinkId.set(null);
  }

  async saveLink() {
    const f = this.linkForm();
    if (!f) return;
    const data: ProjectLinkInput = {
      label: f.label.trim(), url: f.url.trim(), type: f.type,
      username: f.username?.trim() || null, password: f.password || null,
    };
    const id = this.editingLinkId();
    const ok = await this.run(
      id ? this.projectService.updateLink(this.project().id, id, data) : this.projectService.addLink(this.project().id, data),
      id ? 'Enlace actualizado.' : 'Enlace agregado. El cliente ya puede verlo.',
    );
    if (ok) this.closeLinkForm();
  }

  deleteLink(link: ProjectLink) {
    if (!confirm(`¿Eliminar el enlace "${link.label}"?`)) return;
    this.run(this.projectService.deleteLink(this.project().id, link.id), 'Enlace eliminado.');
  }

  toggleReveal(id: string) {
    this.revealed.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async copy(text: string | undefined) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.notify.success('Copiado al portapapeles.');
    } catch {
      this.notify.error('No se pudo copiar.');
    }
  }

  // ── Últimos avances ──
  async publishUpdate() {
    const content = this.newUpdate.trim();
    if (!content) return;
    if (await this.run(this.projectService.addUpdate(this.project().id, content), 'Avance publicado. El cliente recibirá una notificación.')) {
      this.newUpdate = '';
    }
  }

  deleteUpdate(id: string) {
    if (!confirm('¿Eliminar este avance?')) return;
    this.run(this.projectService.deleteUpdate(this.project().id, id), 'Avance eliminado.');
  }
}
