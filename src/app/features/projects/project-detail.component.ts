import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { CompanyService } from '../../core/services/company.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { NotificationService } from '../../shared/services/notification.service';
import { ProjectStatusLabelPipe, PriorityLabelPipe, RequirementStatusLabelPipe } from '../../shared/pipes/labels.pipe';
import { fileIcon, formatFileSize } from '../../shared/utils/file.util';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe, IconComponent, ProjectStatusLabelPipe, PriorityLabelPipe, RequirementStatusLabelPipe],
  template: `
    @if (project()) {
      <div class="detail-page">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a routerLink="/projects"><app-icon name="chevron-left" [size]="14" /> Proyectos</a>
          <span>/</span>
          <span>{{ project()!.name }}</span>
        </div>

        <!-- Header -->
        <div class="project-hero">
          <div class="hero-left">
            <div class="hero-badges">
              <span class="status-badge" [class]="project()!.status">{{ project()!.status | projectStatusLabel }}</span>
              <span class="priority-badge" [class]="project()!.priority">{{ project()!.priority | priorityLabel }}</span>
            </div>
            <h1>{{ project()!.name }}</h1>
            <p class="project-description">{{ project()!.description }}</p>
            <div class="project-meta-chips">
              <span><app-icon name="building" [size]="14" /> {{ companyName() }}</span>
              <span><app-icon name="calendar" [size]="14" /> {{ project()!.startDate }} → {{ project()!.endDate }}</span>
              @if (project()!.budget) { <span><app-icon name="dollar-sign" [size]="14" /> Q{{ project()!.budget | number }}</span> }
            </div>
          </div>
          <div class="hero-right">
            <div class="progress-circle-container">
              <div class="progress-ring" [style.background]="progressRingBackground(project()!.progress)">
                <div class="progress-ring-inner">
                  <span class="progress-big-val">{{ project()!.progress }}%</span>
                </div>
              </div>
              <span class="progress-lbl">Progreso</span>
            </div>
            @if (auth.isOwner()) {
              <div class="status-update">
                <label for="project-status-select">Actualizar estado:</label>
                <select id="project-status-select" (change)="updateStatus($any($event.target).value)">
                  <option value="planning" [selected]="project()!.status === 'planning'">Planificación</option>
                  <option value="in_progress" [selected]="project()!.status === 'in_progress'">En Progreso</option>
                  <option value="review" [selected]="project()!.status === 'review'">Revisión</option>
                  <option value="completed" [selected]="project()!.status === 'completed'">Completado</option>
                  <option value="on_hold" [selected]="project()!.status === 'on_hold'">En Espera</option>
                </select>
                <label for="project-progress-input">Progreso (%):</label>
                <input id="project-progress-input" type="number" [value]="project()!.progress" min="0" max="100"
                  (change)="updateProgress(+$any($event.target).value)">
              </div>
            }
          </div>
        </div>

        <!-- Internal Notes (owner only) -->
        @if (auth.isOwner() && project()!.internalNotes) {
          <div class="internal-notes">
            <span class="internal-badge"><app-icon name="lock" [size]="12" /> Nota interna</span>
            <p>{{ project()!.internalNotes }}</p>
          </div>
        }

        <!-- Tabs -->
        <div class="tabs-nav" role="tablist">
          <button class="tab-btn" role="tab" [attr.aria-selected]="activeTab() === 'comments'" [class.active]="activeTab() === 'comments'" (click)="activeTab.set('comments')">
            <app-icon name="message-circle" [size]="15" /> Comentarios <span class="tab-count">{{ project()!.comments.length }}</span>
          </button>
          <button class="tab-btn" role="tab" [attr.aria-selected]="activeTab() === 'requirements'" [class.active]="activeTab() === 'requirements'" (click)="activeTab.set('requirements')">
            <app-icon name="clipboard" [size]="15" /> Requerimientos <span class="tab-count">{{ project()!.requirements.length }}</span>
          </button>
          <button class="tab-btn" role="tab" [attr.aria-selected]="activeTab() === 'documents'" [class.active]="activeTab() === 'documents'" (click)="activeTab.set('documents')">
            <app-icon name="paperclip" [size]="15" /> Documentos <span class="tab-count">{{ project()!.documents.length }}</span>
          </button>
        </div>

        <!-- Tab: Comments -->
        @if (activeTab() === 'comments') {
          <div class="tab-panel">
            <div class="comments-thread">
              @for (c of visibleComments(); track c.id) {
                <div class="comment-bubble" [class.owner-bubble]="c.authorRole === 'owner'" [class.internal]="c.isInternal">
                  <div class="comment-avatar">{{ c.authorName[0] }}</div>
                  <div class="comment-body">
                    <div class="comment-header">
                      <span class="comment-author">{{ c.authorName }}</span>
                      @if (c.isInternal) { <span class="internal-label"><app-icon name="lock" [size]="10" /> Interno</span> }
                      <span class="comment-date">{{ c.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                    </div>
                    <p class="comment-content">{{ c.content }}</p>
                  </div>
                </div>
              } @empty {
                <p class="empty-comments">No hay comentarios todavía. Sé el primero en comentar.</p>
              }
            </div>

            <div class="comment-form">
              <h4>Agregar comentario</h4>
              <form [formGroup]="commentForm" (ngSubmit)="addComment()" novalidate>
                <label for="comment-content" class="sr-only">Comentario</label>
                <textarea id="comment-content" formControlName="content" rows="3" placeholder="Escribe tu comentario..."></textarea>
                @if (auth.isOwner()) {
                  <label class="checkbox-label" for="comment-internal">
                    <input id="comment-internal" type="checkbox" formControlName="isInternal">
                    Comentario interno (no visible para el cliente)
                  </label>
                }
                <button type="submit" class="btn-primary" [disabled]="commentForm.invalid">Enviar comentario</button>
              </form>
            </div>
          </div>
        }

        <!-- Tab: Requirements -->
        @if (activeTab() === 'requirements') {
          <div class="tab-panel">
            <div class="req-list">
              @for (r of project()!.requirements; track r.id) {
                <div class="req-card">
                  <div class="req-header">
                    <h4>{{ r.title }}</h4>
                    <span class="req-status" [class]="r.status">{{ r.status | reqStatusLabel }}</span>
                  </div>
                  <p class="req-desc">{{ r.description }}</p>
                  <div class="req-footer">
                    <span class="req-date">{{ r.createdAt | date:'dd/MM/yyyy' }}</span>
                    @if (auth.isOwner() && r.status === 'pending') {
                      <div class="req-actions">
                        <button class="btn-approve" (click)="updateReqStatus(r.id, 'approved')">
                          <app-icon name="check" [size]="13" /> Aprobar
                        </button>
                        <button class="btn-reject" (click)="updateReqStatus(r.id, 'rejected')">
                          <app-icon name="x" [size]="13" /> Rechazar
                        </button>
                      </div>
                    }
                  </div>
                </div>
              } @empty {
                <p class="empty-msg">No hay requerimientos adjuntos.</p>
              }
            </div>

            @if (auth.isClient()) {
              <div class="add-req-form">
                <h4>Agregar requerimiento</h4>
                <form [formGroup]="reqForm" (ngSubmit)="addRequirement()" novalidate>
                  <label for="req-title" class="sr-only">Título del requerimiento</label>
                  <input id="req-title" type="text" formControlName="title" placeholder="Título del requerimiento">
                  <label for="req-description" class="sr-only">Descripción del requerimiento</label>
                  <textarea id="req-description" formControlName="description" rows="3" placeholder="Describe el requerimiento en detalle..."></textarea>
                  <button type="submit" class="btn-primary" [disabled]="reqForm.invalid">Enviar requerimiento</button>
                </form>
              </div>
            }
          </div>
        }

        <!-- Tab: Documents -->
        @if (activeTab() === 'documents') {
          <div class="tab-panel">
            <div class="docs-list">
              @for (d of project()!.documents; track d.id) {
                <div class="doc-card">
                  <div class="doc-icon"><app-icon [name]="fileIcon(d.type)" [size]="20" /></div>
                  <div class="doc-info">
                    <span class="doc-name">{{ d.name }}</span>
                    <span class="doc-meta">{{ d.uploadedBy }} · {{ d.uploadedAt | date:'dd/MM/yyyy' }} · {{ formatFileSize(d.size) }}</span>
                  </div>
                  @if (d.data) {
                    <button class="doc-download" (click)="downloadDoc(d)">
                      <app-icon name="download" [size]="13" /> Descargar
                    </button>
                  } @else {
                    <span class="doc-no-data">sin archivo</span>
                  }
                </div>
              } @empty {
                <p class="empty-msg">No hay documentos adjuntos.</p>
              }
            </div>

            <div class="add-doc-form">
              <h4>Subir documento</h4>
              <div class="file-drop-area" [class.has-file]="selectedFile()" [class.drag-over]="dragOver()"
                role="button" tabindex="0" aria-label="Seleccionar o arrastrar un archivo para subir"
                (click)="fileInput.click()" (keydown.enter)="fileInput.click()" (keydown.space)="$event.preventDefault(); fileInput.click()"
                (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
                @if (selectedFile()) {
                  <div class="file-selected">
                    <app-icon [name]="fileIcon(selectedFile()!.name.split('.').pop() || '')" [size]="22" class="file-icon" />
                    <div class="file-selected-info">
                      <span class="file-selected-name">{{ selectedFile()!.name }}</span>
                      <span class="file-selected-size">{{ formatFileSize(selectedFile()!.size) }}</span>
                    </div>
                    <button type="button" class="file-clear" (click)="$event.stopPropagation(); clearFile()" aria-label="Quitar archivo">
                      <app-icon name="x" [size]="14" />
                    </button>
                  </div>
                } @else {
                  <div class="file-placeholder">
                    <app-icon name="paperclip" [size]="26" class="file-placeholder-icon" />
                    <span class="file-placeholder-text">Haz clic o arrastra un archivo aquí</span>
                    <span class="file-placeholder-sub">PDF, Word, Excel, imágenes, ZIP...</span>
                  </div>
                }
              </div>
              <input #fileInput type="file" style="display:none"
                (change)="onFileSelected($event)">
              <button class="btn-primary" [disabled]="!selectedFile() || uploading()"
                (click)="uploadDocument()">
                @if (uploading()) {
                  <app-icon name="loader" [size]="15" class="spin" /> Subiendo...
                } @else {
                  <app-icon name="upload" [size]="15" /> Subir documento
                }
              </button>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="not-found">
        <h2>Proyecto no encontrado</h2>
        <a routerLink="/projects"><app-icon name="chevron-left" [size]="14" /> Volver a proyectos</a>
      </div>
    }
  `,
  styles: [`
    .detail-page { max-width: 900px; margin: 0 auto; }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
    }

    .project-hero { background: white; border-radius: 20px; padding: 28px; display: flex; gap: 24px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
    .hero-left { flex: 1; }
    .hero-badges { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .hero-left h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
    .project-description { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 14px; }
    .project-meta-chips { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .project-meta-chips span { display: inline-flex; align-items: center; gap: 5px; }
    .project-meta-chips app-icon { color: #94a3b8; }

    .hero-right { display: flex; flex-direction: column; align-items: center; gap: 16px; min-width: 160px; }
    .progress-ring { width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.4s ease; flex-shrink: 0; }
    .progress-ring-inner { width: 70px; height: 70px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px rgba(15,23,42,0.05); }
    .progress-big-val { font-size: 20px; font-weight: 800; color: var(--color-primary-700, #0f4b92); }
    .progress-lbl { font-size: 12px; color: #64748b; font-weight: 500; }
    .status-update { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    .status-update label { font-size: 12px; color: #64748b; font-weight: 600; }
    .status-update select, .status-update input { padding: 6px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
    .status-update select:focus, .status-update input:focus { border-color: var(--color-primary-500, #1465c5); }

    .internal-notes { background: #fef9e7; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; gap: 10px; align-items: flex-start; }
    .internal-badge { display: inline-flex; align-items: center; gap: 4px; background: #f59e0b; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .internal-notes p { margin: 0; font-size: 13px; color: #78350f; }

    .tabs-nav { display: flex; gap: 4px; background: white; border-radius: 14px; padding: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; background: transparent; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .tab-btn.active { background: var(--gradient-primary, linear-gradient(135deg, #0f4b92, #1465c5)); color: white; font-weight: 600; }
    .tab-btn:hover:not(.active) { background: #f1f5f9; }
    .tab-count { background: rgba(0,0,0,0.1); border-radius: 10px; padding: 1px 7px; font-size: 11px; }
    .tab-btn.active .tab-count { background: rgba(255,255,255,0.25); }

    .tab-panel { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }

    /* Comments */
    .comments-thread { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .comment-bubble { display: flex; gap: 12px; }
    .comment-bubble.owner-bubble { flex-direction: row-reverse; }
    .comment-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--gradient-primary, linear-gradient(135deg, #0f4b92, #1465c5)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .comment-bubble.owner-bubble .comment-avatar { background: linear-gradient(135deg, #059669, #10b981); }
    .comment-body { max-width: 70%; }
    .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .comment-author { font-size: 13px; font-weight: 700; color: #0f172a; }
    .internal-label { display: inline-flex; align-items: center; gap: 3px; background: #fef3c7; color: #d97706; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .comment-date { font-size: 11px; color: #64748b; }
    .comment-content { background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 10px 14px; font-size: 14px; color: #374151; margin: 0; }
    .comment-bubble.owner-bubble .comment-content { background: #eff6ff; border-radius: 12px 0 12px 12px; }
    .comment-bubble.internal .comment-content { background: #fef9e7; border: 1px dashed #fde68a; }
    .empty-comments { color: #64748b; text-align: center; padding: 20px; }

    .comment-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .comment-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .comment-form textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; margin-bottom: 10px; }
    .comment-form textarea:focus { border-color: var(--color-primary-500, #1465c5); }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; margin-bottom: 12px; cursor: pointer; font-weight: 400; }

    /* Requirements */
    .req-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
    .req-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .req-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .req-header h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0; }
    .req-status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .req-status.pending { background: #fef3c7; color: #d97706; }
    .req-status.approved { background: #dcfce7; color: #16a34a; }
    .req-status.rejected { background: #fee2e2; color: #dc2626; }
    .req-desc { font-size: 13px; color: #64748b; margin: 0 0 10px; }
    .req-footer { display: flex; justify-content: space-between; align-items: center; }
    .req-date { font-size: 12px; color: #64748b; }
    .req-actions { display: flex; gap: 8px; }
    .btn-approve, .btn-reject { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-approve { background: #dcfce7; color: #16a34a; }
    .btn-reject { background: #fee2e2; color: #dc2626; }
    .add-req-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .add-req-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .add-req-form input, .add-req-form textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; box-sizing: border-box; margin-bottom: 10px; font-family: inherit; resize: vertical; }
    .add-req-form input:focus, .add-req-form textarea:focus { border-color: var(--color-primary-500, #1465c5); }

    /* Documents */
    .docs-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .doc-card { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; transition: background 0.15s; }
    .doc-card:hover { background: #f8fafc; }
    .doc-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      background: #eff6ff; color: #1d4ed8;
      display: flex; align-items: center; justify-content: center;
    }
    .doc-info { flex: 1; }
    .doc-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .doc-meta { display: block; font-size: 12px; color: #64748b; margin-top: 2px; }
    .doc-download { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; background: #dbeafe; color: #1d4ed8; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
    .add-doc-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .add-doc-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }

    .file-drop-area {
      border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px;
      text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 14px;
      background: #f8fafc;
    }
    .file-drop-area:hover { border-color: var(--color-primary-500, #1465c5); background: var(--color-primary-50, #e8f1fd); }
    .file-drop-area.has-file { border-color: var(--color-primary-500, #1465c5); background: var(--color-primary-50, #e8f1fd); border-style: solid; }
    .file-drop-area.drag-over { border-color: var(--color-primary-700, #0f4b92); background: var(--color-primary-100, #d1e4fa); border-style: solid; }
    .file-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .file-placeholder-icon { color: #94a3b8; }
    .file-placeholder-text { font-size: 14px; font-weight: 600; color: #475569; }
    .file-placeholder-sub { font-size: 12px; color: #64748b; }
    .file-selected { display: flex; align-items: center; gap: 12px; text-align: left; }
    .file-icon { flex-shrink: 0; color: #1d4ed8; }
    .file-selected-info { flex: 1; }
    .file-selected-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-all; }
    .file-selected-size { font-size: 12px; color: #64748b; }
    .file-clear {
      background: #fee2e2; border: none; border-radius: 6px; color: #dc2626; cursor: pointer;
      width: 26px; height: 26px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .doc-no-data { font-size: 11px; color: #64748b; padding: 6px 10px; background: #f1f5f9; border-radius: 6px; }

    .spin { animation: icon-spin 0.9s linear infinite; }
    @keyframes icon-spin { to { transform: rotate(360deg); } }

    .empty-msg { color: #64748b; text-align: center; padding: 20px; }

    @media (max-width: 768px) {
      .project-hero { flex-direction: column; }
      .hero-right { width: 100%; align-items: stretch; }
      .tab-btn { font-size: 13px; padding: 10px 8px; }
      .comment-body { max-width: 85%; }
    }
    @media (max-width: 480px) {
      .tab-btn span.tab-count { display: none; }
      .doc-card { flex-wrap: wrap; }
    }
  `]
})
export class ProjectDetailComponent implements OnInit {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);
  private notify = inject(NotificationService);

  projectId = signal('');
  activeTab = signal<'comments' | 'requirements' | 'documents'>('comments');

  project = computed(() => this.projectService.getById(this.projectId()));
  companyName = computed(() => this.companyService.getById(this.project()?.companyId || '')?.name || 'N/A');

  visibleComments = computed(() => {
    const p = this.project();
    if (!p) return [];
    if (this.auth.isOwner()) return p.comments;
    return p.comments.filter(c => !c.isInternal);
  });

  commentForm = this.fb.group({
    content: ['', Validators.required],
    isInternal: [false]
  });
  reqForm = this.fb.group({
    title: ['', Validators.required],
    description: ['', Validators.required]
  });
  selectedFile = signal<File | null>(null);
  uploading = signal(false);
  dragOver = signal(false);

  ngOnInit() {
    this.projectId.set(this.route.snapshot.paramMap.get('id') || '');
  }

  progressRingBackground(progress: number): string {
    const clamped = Math.max(0, Math.min(100, progress));
    return `conic-gradient(var(--color-primary-500, #1465c5) 0% ${clamped}%, #e2e8f0 ${clamped}% 100%)`;
  }

  updateStatus(status: string) {
    this.projectService.update(this.projectId(), { status: status as any });
    this.notify.success('Estado del proyecto actualizado.');
  }

  updateProgress(progress: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    this.projectService.update(this.projectId(), { progress: clamped });
    this.notify.success('Progreso actualizado.');
  }

  addComment() {
    if (this.commentForm.invalid) { this.commentForm.markAllAsTouched(); return; }
    const user = this.auth.currentUser()!;
    this.projectService.addComment(this.projectId(), {
      projectId: this.projectId(),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: this.commentForm.value.content!,
      isInternal: this.commentForm.value.isInternal || false
    });
    this.commentForm.reset({ isInternal: false });
    this.notify.success('Comentario agregado.');
  }

  addRequirement() {
    if (this.reqForm.invalid) { this.reqForm.markAllAsTouched(); return; }
    const user = this.auth.currentUser()!;
    this.projectService.addRequirement(this.projectId(), {
      projectId: this.projectId(),
      title: this.reqForm.value.title!,
      description: this.reqForm.value.description!,
      status: 'pending',
      createdBy: user.id
    });
    this.reqForm.reset();
    this.notify.success('Requerimiento enviado.');
  }

  updateReqStatus(reqId: string, status: 'approved' | 'rejected') {
    this.projectService.updateRequirementStatus(this.projectId(), reqId, status);
    this.notify.success(status === 'approved' ? 'Requerimiento aprobado.' : 'Requerimiento rechazado.');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] || null);
  }

  clearFile() {
    this.selectedFile.set(null);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.selectedFile.set(file);
  }

  uploadDocument() {
    const file = this.selectedFile();
    if (!file) return;
    this.uploading.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const user = this.auth.currentUser()!;
      this.projectService.addDocument(this.projectId(), {
        projectId: this.projectId(),
        name: file.name,
        type: file.name.split('.').pop()?.toLowerCase() || 'file',
        size: file.size,
        uploadedBy: user.name,
        data: reader.result as string
      });
      this.selectedFile.set(null);
      this.uploading.set(false);
      this.notify.success('Documento subido correctamente.');
    };
    reader.onerror = () => {
      this.uploading.set(false);
      this.notify.error('No se pudo subir el documento. Intenta nuevamente.');
    };
    reader.readAsDataURL(file);
  }

  downloadDoc(doc: { name: string; data?: string; type: string }) {
    if (!doc.data) return;
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  }

  fileIcon = fileIcon;
  formatFileSize = formatFileSize;
}
