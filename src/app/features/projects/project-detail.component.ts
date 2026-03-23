import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProjectService } from '../../core/services/project.service';
import { CompanyService } from '../../core/services/company.service';
import { Project } from '../../core/models';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    @if (project()) {
      <div class="detail-page">
        <!-- Breadcrumb -->
        <div class="breadcrumb">
          <a routerLink="/projects">← Proyectos</a>
          <span>/</span>
          <span>{{ project()!.name }}</span>
        </div>

        <!-- Header -->
        <div class="project-hero">
          <div class="hero-left">
            <div class="hero-badges">
              <span class="status-badge" [class]="project()!.status">{{ statusLabel(project()!.status) }}</span>
              <span class="priority-badge" [class]="project()!.priority">{{ priorityLabel(project()!.priority) }}</span>
            </div>
            <h1>{{ project()!.name }}</h1>
            <p class="project-description">{{ project()!.description }}</p>
            <div class="project-meta-chips">
              <span>🏢 {{ companyName() }}</span>
              <span>📅 {{ project()!.startDate }} → {{ project()!.endDate }}</span>
              @if (project()!.budget) { <span>💰 Q{{ project()!.budget | number }}</span> }
            </div>
          </div>
          <div class="hero-right">
            <div class="progress-circle-container">
              <div class="big-progress">
                <div class="progress-ring-bg"></div>
                <span class="progress-big-val">{{ project()!.progress }}%</span>
              </div>
              <span class="progress-lbl">Progreso</span>
            </div>
            @if (auth.isOwner()) {
              <div class="status-update">
                <label>Actualizar estado:</label>
                <select (change)="updateStatus($any($event.target).value)">
                  <option value="planning" [selected]="project()!.status === 'planning'">Planificación</option>
                  <option value="in_progress" [selected]="project()!.status === 'in_progress'">En Progreso</option>
                  <option value="review" [selected]="project()!.status === 'review'">Revisión</option>
                  <option value="completed" [selected]="project()!.status === 'completed'">Completado</option>
                  <option value="on_hold" [selected]="project()!.status === 'on_hold'">En Espera</option>
                </select>
                <label>Progreso (%):</label>
                <input type="number" [value]="project()!.progress" min="0" max="100"
                  (change)="updateProgress(+$any($event.target).value)">
              </div>
            }
          </div>
        </div>

        <!-- Internal Notes (owner only) -->
        @if (auth.isOwner() && project()!.internalNotes) {
          <div class="internal-notes">
            <span class="internal-badge">🔒 Nota interna</span>
            <p>{{ project()!.internalNotes }}</p>
          </div>
        }

        <!-- Tabs -->
        <div class="tabs-nav">
          <button class="tab-btn" [class.active]="activeTab() === 'comments'" (click)="activeTab.set('comments')">
            💬 Comentarios <span class="tab-count">{{ project()!.comments.length }}</span>
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'requirements'" (click)="activeTab.set('requirements')">
            📋 Requerimientos <span class="tab-count">{{ project()!.requirements.length }}</span>
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'documents'" (click)="activeTab.set('documents')">
            📎 Documentos <span class="tab-count">{{ project()!.documents.length }}</span>
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
                      @if (c.isInternal) { <span class="internal-label">🔒 Interno</span> }
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
              <form [formGroup]="commentForm" (ngSubmit)="addComment()">
                <textarea formControlName="content" rows="3" placeholder="Escribe tu comentario..."></textarea>
                @if (auth.isOwner()) {
                  <label class="checkbox-label">
                    <input type="checkbox" formControlName="isInternal">
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
                    <span class="req-status" [class]="r.status">{{ reqStatusLabel(r.status) }}</span>
                  </div>
                  <p class="req-desc">{{ r.description }}</p>
                  <div class="req-footer">
                    <span class="req-date">{{ r.createdAt | date:'dd/MM/yyyy' }}</span>
                    @if (auth.isOwner() && r.status === 'pending') {
                      <div class="req-actions">
                        <button class="btn-approve" (click)="updateReqStatus(r.id, 'approved')">✅ Aprobar</button>
                        <button class="btn-reject" (click)="updateReqStatus(r.id, 'rejected')">❌ Rechazar</button>
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
                <form [formGroup]="reqForm" (ngSubmit)="addRequirement()">
                  <input type="text" formControlName="title" placeholder="Título del requerimiento">
                  <textarea formControlName="description" rows="3" placeholder="Describe el requerimiento en detalle..."></textarea>
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
                  <div class="doc-icon">{{ docIcon(d.type) }}</div>
                  <div class="doc-info">
                    <span class="doc-name">{{ d.name }}</span>
                    <span class="doc-meta">{{ d.uploadedBy }} · {{ d.uploadedAt | date:'dd/MM/yyyy' }} · {{ formatSize(d.size) }}</span>
                  </div>
                  @if (d.data) {
                    <button class="doc-download" (click)="downloadDoc(d)">⬇️ Descargar</button>
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
              <div class="file-drop-area" [class.has-file]="selectedFile()" (click)="fileInput.click()">
                @if (selectedFile()) {
                  <div class="file-selected">
                    <span class="file-icon">{{ docIcon(selectedFile()!.name.split('.').pop() || '') }}</span>
                    <div class="file-selected-info">
                      <span class="file-selected-name">{{ selectedFile()!.name }}</span>
                      <span class="file-selected-size">{{ formatSize(selectedFile()!.size) }}</span>
                    </div>
                    <button type="button" class="file-clear" (click)="$event.stopPropagation(); clearFile()">✕</button>
                  </div>
                } @else {
                  <div class="file-placeholder">
                    <span class="file-placeholder-icon">📎</span>
                    <span class="file-placeholder-text">Haz clic para seleccionar archivo</span>
                    <span class="file-placeholder-sub">PDF, Word, Excel, imágenes, ZIP...</span>
                  </div>
                }
              </div>
              <input #fileInput type="file" style="display:none"
                (change)="onFileSelected($event)">
              <button class="btn-primary" [disabled]="!selectedFile() || uploading()"
                (click)="uploadDocument()">
                {{ uploading() ? '⏳ Subiendo...' : '📤 Subir documento' }}
              </button>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="not-found">
        <h2>Proyecto no encontrado</h2>
        <a routerLink="/projects">← Volver a proyectos</a>
      </div>
    }
  `,
  styles: [`
    .detail-page { max-width: 900px; }
    .breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 14px; color: #64748b; }
    .breadcrumb a { color: #3b82f6; text-decoration: none; font-weight: 500; }
    .breadcrumb a:hover { text-decoration: underline; }

    .project-hero { background: white; border-radius: 20px; padding: 28px; display: flex; gap: 24px; border: 1px solid #e2e8f0; margin-bottom: 16px; }
    .hero-left { flex: 1; }
    .hero-badges { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .hero-left h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 10px; }
    .project-description { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 14px; }
    .project-meta-chips { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #475569; }

    .hero-right { display: flex; flex-direction: column; align-items: center; gap: 16px; min-width: 160px; }
    .big-progress { display: flex; align-items: center; justify-content: center; width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, #dbeafe, #bfdbfe); border: 4px solid #3b82f6; }
    .progress-big-val { font-size: 22px; font-weight: 800; color: #1e40af; }
    .progress-lbl { font-size: 12px; color: #94a3b8; font-weight: 500; }
    .status-update { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    .status-update label { font-size: 12px; color: #64748b; font-weight: 600; }
    .status-update select, .status-update input { padding: 6px 10px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
    .status-update select:focus, .status-update input:focus { border-color: #3b82f6; }

    .internal-notes { background: #fef9e7; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; gap: 10px; align-items: flex-start; }
    .internal-badge { background: #f59e0b; color: white; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .internal-notes p { margin: 0; font-size: 13px; color: #78350f; }

    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-badge.planning { background: #e0e7ff; color: #4338ca; }
    .status-badge.in_progress { background: #dbeafe; color: #1d4ed8; }
    .status-badge.review { background: #fef3c7; color: #d97706; }
    .status-badge.completed { background: #dcfce7; color: #16a34a; }
    .status-badge.on_hold { background: #f1f5f9; color: #64748b; }
    .priority-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .priority-badge.low { background: #dcfce7; color: #16a34a; }
    .priority-badge.medium { background: #fef3c7; color: #d97706; }
    .priority-badge.high { background: #fed7aa; color: #ea580c; }
    .priority-badge.critical { background: #fee2e2; color: #dc2626; }

    .tabs-nav { display: flex; gap: 4px; background: white; border-radius: 14px; padding: 6px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
    .tab-btn { flex: 1; padding: 10px 16px; border: none; border-radius: 10px; background: transparent; color: #64748b; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .tab-btn.active { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; font-weight: 600; }
    .tab-btn:hover:not(.active) { background: #f1f5f9; }
    .tab-count { background: rgba(0,0,0,0.1); border-radius: 10px; padding: 1px 7px; font-size: 11px; }
    .tab-btn.active .tab-count { background: rgba(255,255,255,0.25); }

    .tab-panel { background: white; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; }

    /* Comments */
    .comments-thread { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
    .comment-bubble { display: flex; gap: 12px; }
    .comment-bubble.owner-bubble { flex-direction: row-reverse; }
    .comment-avatar { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .comment-bubble.owner-bubble .comment-avatar { background: linear-gradient(135deg, #059669, #10b981); }
    .comment-body { max-width: 70%; }
    .comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .comment-author { font-size: 13px; font-weight: 700; color: #0f172a; }
    .internal-label { background: #fef3c7; color: #d97706; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .comment-date { font-size: 11px; color: #94a3b8; }
    .comment-content { background: #f8fafc; border-radius: 0 12px 12px 12px; padding: 10px 14px; font-size: 14px; color: #374151; margin: 0; }
    .comment-bubble.owner-bubble .comment-content { background: #eff6ff; border-radius: 12px 0 12px 12px; }
    .comment-bubble.internal .comment-content { background: #fef9e7; border: 1px dashed #fde68a; }
    .empty-comments { color: #94a3b8; text-align: center; padding: 20px; }

    .comment-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .comment-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .comment-form textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; resize: vertical; font-family: inherit; box-sizing: border-box; margin-bottom: 10px; }
    .comment-form textarea:focus { border-color: #3b82f6; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; margin-bottom: 12px; cursor: pointer; }
    .btn-primary { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

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
    .req-date { font-size: 12px; color: #94a3b8; }
    .req-actions { display: flex; gap: 8px; }
    .btn-approve { padding: 5px 12px; background: #dcfce7; color: #16a34a; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-reject { padding: 5px 12px; background: #fee2e2; color: #dc2626; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .add-req-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .add-req-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
    .add-req-form input, .add-req-form textarea { width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; box-sizing: border-box; margin-bottom: 10px; font-family: inherit; resize: vertical; }
    .add-req-form input:focus, .add-req-form textarea:focus { border-color: #3b82f6; }

    /* Documents */
    .docs-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .doc-card { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 12px; transition: background 0.15s; }
    .doc-card:hover { background: #f8fafc; }
    .doc-icon { font-size: 28px; }
    .doc-info { flex: 1; }
    .doc-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; }
    .doc-meta { display: block; font-size: 12px; color: #94a3b8; margin-top: 2px; }
    .doc-download { padding: 6px 14px; background: #dbeafe; color: #1d4ed8; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .add-doc-form { border-top: 1px solid #f1f5f9; padding-top: 20px; }
    .add-doc-form h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }

    .file-drop-area {
      border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px;
      text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 14px;
      background: #f8fafc;
    }
    .file-drop-area:hover { border-color: #3b82f6; background: #eff6ff; }
    .file-drop-area.has-file { border-color: #3b82f6; background: #eff6ff; border-style: solid; }
    .file-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .file-placeholder-icon { font-size: 32px; }
    .file-placeholder-text { font-size: 14px; font-weight: 600; color: #475569; }
    .file-placeholder-sub { font-size: 12px; color: #94a3b8; }
    .file-selected { display: flex; align-items: center; gap: 12px; text-align: left; }
    .file-icon { font-size: 28px; flex-shrink: 0; }
    .file-selected-info { flex: 1; }
    .file-selected-name { display: block; font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-all; }
    .file-selected-size { font-size: 12px; color: #64748b; }
    .file-clear { background: #fee2e2; border: none; border-radius: 6px; color: #dc2626; cursor: pointer; padding: 4px 8px; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .doc-no-data { font-size: 11px; color: #94a3b8; padding: 6px 10px; background: #f1f5f9; border-radius: 6px; }

    .empty-msg { color: #94a3b8; text-align: center; padding: 20px; }
    .not-found { text-align: center; padding: 60px; }
  `]
})
export class ProjectDetailComponent implements OnInit {
  auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  private companyService = inject(CompanyService);
  private fb = inject(FormBuilder);

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

  ngOnInit() {
    this.projectId.set(this.route.snapshot.paramMap.get('id') || '');
  }

  updateStatus(status: string) {
    this.projectService.update(this.projectId(), { status: status as any });
  }
  updateProgress(progress: number) {
    this.projectService.update(this.projectId(), { progress });
  }

  addComment() {
    if (this.commentForm.invalid) return;
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
  }

  addRequirement() {
    if (this.reqForm.invalid) return;
    const user = this.auth.currentUser()!;
    this.projectService.addRequirement(this.projectId(), {
      projectId: this.projectId(),
      title: this.reqForm.value.title!,
      description: this.reqForm.value.description!,
      status: 'pending',
      createdBy: user.id
    });
    this.reqForm.reset();
  }

  updateReqStatus(reqId: string, status: 'approved' | 'rejected') {
    this.projectService.updateRequirementStatus(this.projectId(), reqId, status);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] || null);
  }

  clearFile() {
    this.selectedFile.set(null);
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
    };
    reader.onerror = () => this.uploading.set(false);
    reader.readAsDataURL(file);
  }

  downloadDoc(doc: { name: string; data?: string; type: string }) {
    if (!doc.data) return;
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  }

  statusLabel(s: string) {
    const m: any = { planning: 'Planificación', in_progress: 'En Progreso', review: 'Revisión', completed: 'Completado', on_hold: 'En Espera' };
    return m[s] || s;
  }
  priorityLabel(p: string) {
    const m: any = { low: 'Prioridad Baja', medium: 'Prioridad Media', high: 'Prioridad Alta', critical: 'Prioridad Crítica' };
    return m[p] || p;
  }
  reqStatusLabel(s: string) {
    const m: any = { pending: 'Pendiente', approved: '✅ Aprobado', rejected: '❌ Rechazado' };
    return m[s] || s;
  }
  docIcon(type: string) {
    const m: any = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', png: '🖼️', jpg: '🖼️', zip: '🗜️' };
    return m[type] || '📎';
  }
  formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
