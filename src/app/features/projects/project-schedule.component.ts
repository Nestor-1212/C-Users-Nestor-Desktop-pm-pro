import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project, ProjectStage, ProjectTask, ScheduleVisibility, TaskOwner } from '../../core/models';
import { ProjectService, ProjectTaskInput } from '../../core/services/project.service';
import { apiErrorMessage } from '../../core/http/api-error';
import { IconComponent } from '../../shared/icon/icon.component';
import { NotificationService } from '../../shared/services/notification.service';
import { exportToExcel, exportToPdf, ExportColumn } from '../../shared/utils/export.util';
import { fileIcon, formatFileSize, MAX_DOCUMENT_SIZE } from '../../shared/utils/file.util';

type Zoom = 'weeks' | 'months';
type TaskState = 'done' | 'late' | 'active' | 'pending';

interface StageRow {
  stage: ProjectStage;
  key: string;
  start?: string;
  end?: string;
  tasks: ProjectTask[];
}

interface ExportRow { stage: string; task: ProjectTask | null; progress: number; start: string; end: string; }

const DAY = 24 * 60 * 60 * 1000;
const PX_PER_DAY: Record<Zoom, number> = { weeks: 16, months: 4.5 };
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** 'YYYY-MM-DD' como medianoche local (new Date('YYYY-MM-DD') sería UTC y movería el día). */
const localDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = () => toIso(new Date());
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

export const VISIBILITY_OPTIONS: { value: ScheduleVisibility; label: string; hint: string }[] = [
  { value: 'full', label: 'Todo', hint: 'Etapas, tareas e hitos (menos las tareas que marques como internas).' },
  { value: 'milestones', label: 'Etapas e hitos', hint: 'El cliente ve las etapas y las fechas clave, sin el detalle de tareas.' },
  { value: 'stages', label: 'Solo etapas', hint: 'El cliente ve únicamente las etapas con sus fechas y avance.' },
  { value: 'hidden', label: 'Nada', hint: 'El cliente no ve el cronograma (sí el archivo, si subes uno).' },
];

const emptyTask = (stageId: string): ProjectTaskInput => ({
  stageId, name: '', startDate: todayIso(), endDate: todayIso(), progress: 0,
  owner: 'team', isMilestone: false, visibleToClient: true,
});

@Component({
  selector: 'app-project-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, IconComponent],
  template: `
    <!-- Archivo de cronograma -->
    @if (scheduleDoc(); as doc) {
      <section class="file-card">
        <span class="file-icon"><app-icon [name]="fileIcon(doc.type)" [size]="22" /></span>
        <div class="file-info">
          <span class="file-title">Cronograma del proyecto</span>
          <span class="file-meta">{{ doc.name }} · {{ formatFileSize(doc.size) }} · {{ doc.uploadedAt | date:'d MMM y' }}</span>
        </div>
        @if (canEdit()) {
          <button class="btn-ghost small" (click)="unmarkScheduleDoc(doc.id)">Quitar de aquí</button>
        }
        <a class="btn-download" [href]="doc.url" target="_blank" rel="noopener noreferrer">
          <app-icon name="download" [size]="15" /> Descargar cronograma
        </a>
      </section>
    }

    <section class="sched-card">
      <!-- Barra de herramientas -->
      <div class="toolbar">
        <div class="zoom" role="group" aria-label="Escala del cronograma">
          <button [class.active]="zoom() === 'weeks'" (click)="zoom.set('weeks')">Semanas</button>
          <button [class.active]="zoom() === 'months'" (click)="zoom.set('months')">Meses</button>
        </div>
        <span class="spacer"></span>
        @if (canEdit()) {
          <label class="file-upload btn-ghost">
            <app-icon name="upload" [size]="14" /> {{ scheduleDoc() ? 'Reemplazar archivo' : 'Subir archivo de cronograma' }}
            <input type="file" (change)="uploadScheduleFile($event)" hidden>
          </label>
        }
        <button class="btn-ghost" (click)="exportExcel()" [disabled]="!rows().length"><app-icon name="download" [size]="14" /> Excel</button>
        <button class="btn-ghost" (click)="exportPdf()" [disabled]="!rows().length"><app-icon name="download" [size]="14" /> PDF</button>
        @if (canEdit() && project().stages.length) {
          <button class="btn-primary" (click)="openTaskForm()"><app-icon name="plus" [size]="14" /> Agregar tarea o hito</button>
        }
      </div>

      <!-- Qué ve el cliente (solo owner) -->
      @if (canEdit()) {
        <div class="visibility">
          <span class="vis-label"><app-icon name="eye" [size]="15" /> El cliente ve:</span>
          <div class="vis-options" role="radiogroup" aria-label="Qué parte del cronograma ve el cliente">
            @for (o of visibilityOptions; track o.value) {
              <button role="radio" [attr.aria-checked]="project().scheduleVisibility === o.value"
                [class.active]="project().scheduleVisibility === o.value" (click)="setVisibility(o.value)">{{ o.label }}</button>
            }
          </div>
          <span class="vis-hint">{{ visibilityHint() }}</span>
        </div>
      }

      <!-- Formulario de tarea (solo owner) -->
      @if (taskForm(); as f) {
        <div class="task-form">
          <h4>{{ editingTaskId() ? 'Editar' : 'Nueva' }} {{ f.isMilestone ? 'hito' : 'tarea' }}</h4>
          <div class="form-grid">
            <label class="wide">Nombre<input [(ngModel)]="f.name" [placeholder]="f.isMilestone ? 'Ej. Diseño aprobado' : 'Ej. Módulo de pagos'"></label>
            <label>Etapa
              <select [(ngModel)]="f.stageId">
                @for (s of project().stages; track s.id) { <option [value]="s.id">{{ s.name }}</option> }
              </select>
            </label>
            <label>Tipo
              <select [(ngModel)]="f.isMilestone">
                <option [ngValue]="false">Tarea</option>
                <option [ngValue]="true">Hito (fecha clave)</option>
              </select>
            </label>
            <label>{{ f.isMilestone ? 'Fecha' : 'Inicio' }}<input type="date" [(ngModel)]="f.startDate"></label>
            @if (!f.isMilestone) {
              <label>Fin<input type="date" [(ngModel)]="f.endDate"></label>
            }
            <label>Responsable
              <select [(ngModel)]="f.owner">
                <option value="team">3TECH</option>
                <option value="client">Cliente</option>
              </select>
            </label>
            @if (f.isMilestone) {
              <label>Estado
                <select [(ngModel)]="f.progress">
                  <option [ngValue]="0">Pendiente</option>
                  <option [ngValue]="100">Cumplido</option>
                </select>
              </label>
            } @else {
              <label>Avance: {{ f.progress }}%
                <input type="range" min="0" max="100" step="5" [(ngModel)]="f.progress">
              </label>
            }
            <label class="check wide">
              <input type="checkbox" [(ngModel)]="f.visibleToClient">
              Visible para el cliente <span class="muted">(desmárcalo para tareas internas)</span>
            </label>
          </div>
          <div class="form-actions">
            @if (editingTaskId()) {
              <button class="btn-danger" (click)="deleteTask()"><app-icon name="trash" [size]="14" /> Eliminar</button>
            }
            <span class="spacer"></span>
            <button class="btn-secondary" (click)="closeTaskForm()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving() || !f.name.trim()" (click)="saveTask()">Guardar</button>
          </div>
        </div>
      }

      @if (!canEdit() && project().scheduleVisibility === 'hidden') {
        <p class="empty">El cronograma detallado aún no está publicado.{{ scheduleDoc() ? ' Puedes descargar el archivo de arriba.' : '' }}</p>
      } @else if (!rows().length) {
        <p class="empty">{{ canEdit() ? 'Define primero las etapas en la pestaña Seguimiento.' : 'El cronograma aún no tiene etapas.' }}</p>
      } @else {
        <!-- Gantt (escritorio) -->
        <div class="gantt" [style.--day-px.px]="pxPerDay()">
          <div class="gantt-names">
            <div class="head-cell">Actividad</div>
            @for (r of rows(); track r.key) {
              <button class="name-cell stage-name" (click)="toggle(r.key)" [disabled]="!r.tasks.length" [attr.aria-expanded]="r.tasks.length ? !collapsed().has(r.key) : null">
                <span class="caret">{{ r.tasks.length ? (collapsed().has(r.key) ? '▸' : '▾') : '' }}</span>
                <span class="nm">{{ r.stage.name }}</span>
                <span class="pct">{{ r.stage.progress }}%</span>
              </button>
              @if (!collapsed().has(r.key)) {
                @for (t of r.tasks; track t.id) {
                  <div class="name-cell task-name" [class.hidden-task]="!t.visibleToClient" [class.clickable]="canEdit()" (click)="canEdit() && openTaskForm(t)">
                    @if (t.isMilestone) { <span class="mini-diamond" [class.done]="t.progress >= 100"></span> }
                    @else { <span class="owner-dot" [class]="t.owner"></span> }
                    <span class="nm" [title]="t.name">{{ t.name }}</span>
                    @if (!t.visibleToClient) { <app-icon name="eye-off" [size]="12" class="muted" /> }
                    @if (taskState(t) === 'late') { <span class="late-tag">Atrasada</span> }
                  </div>
                }
              }
            }
          </div>

          <div class="gantt-scroll">
            <div class="timeline" [style.width.px]="timelineWidth()">
              <div class="head-cell timeline-head">
                @for (m of monthTicks(); track m.left) {
                  <span class="month" [style.left.px]="m.left" [style.width.px]="m.width">{{ m.label }}</span>
                }
                @if (zoom() === 'weeks') {
                  @for (w of weekTicks(); track w.left) {
                    <span class="week" [style.left.px]="w.left">{{ w.label }}</span>
                  }
                }
              </div>
              @for (m of monthTicks(); track m.left) {
                <span class="grid-line" [style.left.px]="m.left"></span>
              }
              @if (todayLeft() !== null) {
                <span class="today-line" [style.left.px]="todayLeft()"><span class="today-tag">Hoy</span></span>
              }

              @for (r of rows(); track r.key) {
                <div class="bar-row stage-row">
                  @if (r.start && r.end) {
                    <div class="bar stage-bar" [style.left.px]="x(r.start)" [style.width.px]="w(r.start, r.end)"
                      [title]="r.stage.name + ' · ' + r.stage.progress + '%'">
                      <div class="fill" [style.width.%]="r.stage.progress"></div>
                    </div>
                  }
                </div>
                @if (!collapsed().has(r.key)) {
                  @for (t of r.tasks; track t.id) {
                    <div class="bar-row">
                      @if (t.isMilestone) {
                        <span class="diamond" [class.done]="t.progress >= 100" [class.client]="t.owner === 'client'"
                          [class.late]="taskState(t) === 'late'"
                          [style.left.px]="x(t.startDate) + pxPerDay() / 2"
                          [title]="t.name + ' · ' + (t.startDate | date:'d MMM y')"
                          (click)="canEdit() && openTaskForm(t)"></span>
                        <span class="ms-label" [style.left.px]="x(t.startDate) + pxPerDay() / 2 + 12">{{ t.startDate | date:'d MMM' }}</span>
                      } @else {
                        <div class="bar task-bar" [class]="t.owner + ' ' + taskState(t)" [class.hidden-task]="!t.visibleToClient"
                          [class.clickable]="canEdit()"
                          [style.left.px]="x(t.startDate)" [style.width.px]="w(t.startDate, t.endDate)"
                          [title]="t.name + ' · ' + (t.startDate | date:'d MMM') + ' – ' + (t.endDate | date:'d MMM') + ' · ' + t.progress + '%'"
                          (click)="canEdit() && openTaskForm(t)">
                          <div class="fill" [style.width.%]="t.progress"></div>
                          <span class="bar-pct">{{ t.progress }}%</span>
                        </div>
                      }
                    </div>
                  }
                }
              }
            </div>
          </div>
        </div>

        <!-- Lista (celular) -->
        <div class="mobile-list">
          @for (r of rows(); track r.key) {
            <div class="m-stage">
              <div class="m-stage-head">
                <strong>{{ r.stage.name }}</strong><span>{{ r.stage.progress }}%</span>
              </div>
              @if (r.start && r.end) { <span class="m-dates">{{ r.start | date:'d MMM' }} – {{ r.end | date:'d MMM y' }}</span> }
              <div class="m-bar"><div [style.width.%]="r.stage.progress"></div></div>
              @for (t of r.tasks; track t.id) {
                <div class="m-task" [class]="t.owner" (click)="canEdit() && openTaskForm(t)">
                  <span>{{ t.isMilestone ? '◆ ' : '' }}{{ t.name }}</span>
                  <span class="m-meta">
                    {{ t.startDate | date:'d MMM' }}{{ t.isMilestone ? '' : ' – ' + (t.endDate | date:'d MMM') }}
                    · {{ t.isMilestone ? (t.progress >= 100 ? 'Cumplido' : 'Pendiente') : t.progress + '%' }}
                    @if (taskState(t) === 'late') { · <b class="late-text">Atrasada</b> }
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- Leyenda -->
        <div class="legend">
          <span><i class="lg team"></i> 3TECH</span>
          <span><i class="lg client"></i> {{ canEdit() ? 'Cliente' : 'Depende de ustedes' }}</span>
          <span><i class="lg late"></i> Atrasada</span>
          <span><i class="lg-diamond"></i> Hito</span>
          <span><i class="lg-today"></i> Hoy</span>
          @if (canEdit()) { <span><app-icon name="eye-off" [size]="12" /> Interna (el cliente no la ve)</span> }
        </div>
      }
    </section>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 16px; }
    .sched-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 22px; }
    .spacer { flex: 1; }
    .muted { color: #94a3b8; font-weight: 400; }
    .empty { color: #64748b; text-align: center; padding: 28px 12px; margin: 0; font-size: 14px; }

    /* Archivo */
    .file-card { display: flex; align-items: center; gap: 14px; background: #0f4b92; color: #fff; border-radius: 16px; padding: 16px 20px; flex-wrap: wrap; }
    .file-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.16); display: flex; align-items: center; justify-content: center; }
    .file-info { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
    .file-title { font-weight: 700; font-size: 15px; }
    .file-meta { font-size: 12.5px; opacity: 0.85; }
    .btn-download { display: inline-flex; align-items: center; gap: 7px; background: #e99d34; color: #fff; padding: 10px 16px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; }
    .btn-download:hover { background: #d48a22; }
    .file-card .btn-ghost { background: rgba(255,255,255,0.14); color: #fff; }

    /* Toolbar */
    .toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .zoom { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
    .zoom button { border: none; background: none; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; }
    .zoom button.active { background: #fff; color: #0f4b92; box-shadow: 0 1px 3px rgba(15,23,42,0.1); }
    .btn-primary, .btn-secondary, .btn-ghost, .btn-danger { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; padding: 8px 13px; border: none; }
    .btn-primary { background: #0f4b92; color: #fff; }
    .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: #f1f5f9; color: #334155; }
    .btn-ghost { background: #eef4fc; color: #0f4b92; }
    .btn-ghost.small { padding: 6px 10px; font-size: 12px; }
    .btn-danger { background: #fee2e2; color: #dc2626; }
    .file-upload { cursor: pointer; }

    /* Visibilidad */
    .visibility { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; }
    .vis-label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #334155; }
    .vis-options { display: inline-flex; gap: 4px; flex-wrap: wrap; }
    .vis-options button { border: 1.5px solid #e2e8f0; background: #fff; padding: 5px 11px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; }
    .vis-options button.active { border-color: #0f4b92; background: #0f4b92; color: #fff; }
    .vis-hint { font-size: 12px; color: #64748b; flex-basis: 100%; }

    /* Formulario */
    .task-form { border: 1px solid #c7d7ee; background: #f8fbff; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .task-form h4 { margin: 0 0 12px; font-size: 14px; color: #0f172a; }
    .form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 12px; }
    .form-grid label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: #475569; }
    .form-grid .wide { grid-column: 1 / -1; }
    .form-grid .check { flex-direction: row; align-items: center; gap: 8px; font-weight: 500; }
    .form-grid input:not([type=checkbox]):not([type=range]) { padding: 8px 10px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 13.5px; font-family: inherit; outline: none; background: #fff; }
    .form-grid select { padding: 8px 10px; font-size: 13.5px; font-family: inherit; }
    .form-grid input[type=range] { accent-color: #0f4b92; }
    .form-actions { display: flex; gap: 8px; margin-top: 14px; align-items: center; }

    /* Gantt */
    .gantt { --row-h: 38px; display: flex; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .gantt-names { width: 250px; flex-shrink: 0; border-right: 1px solid #e2e8f0; background: #fff; z-index: 1; }
    .head-cell { height: 44px; box-sizing: border-box; border-bottom: 1px solid #e2e8f0; background: #f8fafc; font-size: 12px; font-weight: 700; color: #64748b; display: flex; align-items: flex-end; padding: 0 12px 8px; }
    .name-cell { height: var(--row-h); box-sizing: border-box; display: flex; align-items: center; gap: 7px; padding: 0 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; width: 100%; background: none; border-left: none; border-right: none; border-top: none; text-align: left; font-family: inherit; color: #334155; }
    .name-cell .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stage-name { font-weight: 700; color: #0f172a; background: #fbfcfe; cursor: pointer; }
    .stage-name:disabled { cursor: default; color: #0f172a; }
    .stage-name .pct { font-size: 12px; color: #0f4b92; }
    .caret { width: 10px; color: #94a3b8; font-size: 11px; }
    .task-name { padding-left: 30px; }
    .task-name.clickable { cursor: pointer; }
    .task-name.clickable:hover { background: #f8fafc; }
    .hidden-task { opacity: 0.6; }
    .owner-dot { width: 8px; height: 8px; border-radius: 50%; background: #1465c5; flex-shrink: 0; }
    .owner-dot.client { background: #e99d34; }
    .mini-diamond { width: 8px; height: 8px; transform: rotate(45deg); background: #fff; border: 2px solid #0f4b92; flex-shrink: 0; }
    .mini-diamond.done { background: #a9c238; border-color: #a9c238; }
    .late-tag { font-size: 10px; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 1px 6px; border-radius: 6px; flex-shrink: 0; }

    .gantt-scroll { flex: 1; overflow-x: auto; }
    .timeline { position: relative; min-width: 100%; }
    .timeline-head { position: relative; padding: 0; display: block; }
    .month { position: absolute; top: 6px; font-size: 12px; font-weight: 700; color: #334155; padding-left: 6px; box-sizing: border-box; white-space: nowrap; overflow: hidden; }
    .week { position: absolute; bottom: 6px; font-size: 10.5px; color: #94a3b8; transform: translateX(-50%); }
    .grid-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #eef2f7; }
    .today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 2; }
    .today-tag { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 6px; }
    .bar-row { position: relative; height: var(--row-h); border-bottom: 1px solid #f1f5f9; }
    .stage-row { background: #fbfcfe; }
    .bar { position: absolute; top: 9px; height: 20px; border-radius: 6px; overflow: hidden; box-sizing: border-box; }
    .bar .fill { height: 100%; }
    .stage-bar { top: 12px; height: 14px; background: #dbe5f3; }
    .stage-bar .fill { background: #0f4b92; }
    .task-bar { background: #d6e4f7; }
    .task-bar .fill { background: #1465c5; }
    .task-bar.client { background: #fbe3c2; }
    .task-bar.client .fill { background: #e99d34; }
    .task-bar.done.team .fill { background: #1465c5; }
    .task-bar.late { outline: 2px solid #ef4444; outline-offset: -2px; background-image: repeating-linear-gradient(45deg, transparent 0 5px, rgba(239,68,68,0.18) 5px 10px); }
    .task-bar.clickable { cursor: pointer; }
    .task-bar.hidden-task { opacity: 0.45; }
    .bar-pct { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 10.5px; font-weight: 700; color: #0f172a; }
    .diamond { position: absolute; top: 50%; width: 14px; height: 14px; transform: translate(-50%, -50%) rotate(45deg); background: #fff; border: 2.5px solid #0f4b92; z-index: 1; cursor: default; }
    .diamond.client { border-color: #e99d34; }
    .diamond.done { background: #a9c238; border-color: #8aa224; }
    .diamond.late { border-color: #ef4444; }
    .ms-label { position: absolute; top: 50%; transform: translateY(-50%); font-size: 11px; color: #64748b; white-space: nowrap; }

    .legend { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; font-size: 12px; color: #475569; align-items: center; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .lg { width: 16px; height: 10px; border-radius: 3px; display: inline-block; }
    .lg.team { background: #1465c5; }
    .lg.client { background: #e99d34; }
    .lg.late { outline: 2px solid #ef4444; outline-offset: -2px; background: repeating-linear-gradient(45deg, #fff 0 3px, rgba(239,68,68,0.3) 3px 6px); }
    .lg-diamond { width: 9px; height: 9px; transform: rotate(45deg); border: 2px solid #0f4b92; display: inline-block; }
    .lg-today { width: 2px; height: 14px; background: #ef4444; display: inline-block; }

    .mobile-list { display: none; }
    .m-stage { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
    .m-stage-head { display: flex; justify-content: space-between; font-size: 14px; }
    .m-dates { font-size: 12px; color: #64748b; }
    .m-bar { height: 7px; background: #f1f5f9; border-radius: 999px; margin: 8px 0; overflow: hidden; }
    .m-bar div { height: 100%; background: #0f4b92; }
    .m-task { display: flex; flex-direction: column; padding: 7px 0 7px 10px; border-left: 3px solid #1465c5; margin-top: 6px; font-size: 13px; }
    .m-task.client { border-left-color: #e99d34; }
    .m-meta { font-size: 11.5px; color: #64748b; }
    .late-text { color: #dc2626; }

    @media (max-width: 768px) {
      .gantt { display: none; }
      .mobile-list { display: block; }
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ProjectScheduleComponent {
  project = input.required<Project>();
  /** Equipo de 3TECH: puede editar; el cliente solo ve. */
  canEdit = input(false);

  private projectService = inject(ProjectService);
  private notify = inject(NotificationService);

  visibilityOptions = VISIBILITY_OPTIONS;
  zoom = signal<Zoom>('weeks');
  collapsed = signal(new Set<string>());
  saving = signal(false);
  taskForm = signal<ProjectTaskInput | null>(null);
  editingTaskId = signal<string | null>(null);

  scheduleDoc = computed(() => this.project().documents.find(d => d.isSchedule));
  visibilityHint = computed(() => VISIBILITY_OPTIONS.find(o => o.value === this.project().scheduleVisibility)?.hint ?? '');
  pxPerDay = computed(() => PX_PER_DAY[this.zoom()]);

  rows = computed<StageRow[]>(() => {
    const p = this.project();
    return p.stages.map((stage, i) => {
      const tasks = p.tasks
        .filter(t => t.stageId === stage.id)
        .sort((a, b) => a.position - b.position || a.startDate.localeCompare(b.startDate));
      const starts = [stage.startDate, ...tasks.map(t => t.startDate)].filter((d): d is string => !!d).sort();
      const ends = [stage.endDate, ...tasks.map(t => t.endDate)].filter((d): d is string => !!d).sort();
      return { stage, key: stage.id ?? `s${i}`, tasks, start: starts[0], end: ends[ends.length - 1] };
    });
  });

  /** Rango visible: del lunes anterior al inicio hasta fin de mes de la última fecha. */
  private range = computed(() => {
    const p = this.project();
    const dates = [p.startDate, p.endDate, ...this.rows().flatMap(r => [r.start, r.end])].filter((d): d is string => !!d).sort();
    const start = localDate(dates[0]);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7);
    const last = localDate(dates[dates.length - 1]);
    const end = new Date(last.getFullYear(), last.getMonth() + 1, 0);
    end.setDate(end.getDate() + 7);
    return { start, end };
  });

  timelineWidth = computed(() => (daysBetween(this.range().start, this.range().end) + 1) * this.pxPerDay());

  monthTicks = computed(() => {
    const { start, end } = this.range();
    const ticks: { left: number; width: number; label: string }[] = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const from = cursor < start ? start : cursor;
      const to = next > end ? end : next;
      const label = this.zoom() === 'months' ? MONTHS[cursor.getMonth()] : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
      ticks.push({ left: daysBetween(start, from) * this.pxPerDay(), width: daysBetween(from, to) * this.pxPerDay(), label });
      cursor = next;
    }
    return ticks;
  });

  weekTicks = computed(() => {
    const { start, end } = this.range();
    const ticks: { left: number; label: string }[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      ticks.push({ left: daysBetween(start, d) * this.pxPerDay(), label: `${d.getDate()}/${d.getMonth() + 1}` });
    }
    return ticks;
  });

  todayLeft = computed(() => {
    const t = localDate(todayIso());
    const { start, end } = this.range();
    return t < start || t > end ? null : daysBetween(start, t) * this.pxPerDay() + this.pxPerDay() / 2;
  });

  x(iso: string): number { return daysBetween(this.range().start, localDate(iso)) * this.pxPerDay(); }
  w(startIso: string, endIso: string): number { return Math.max(1, daysBetween(localDate(startIso), localDate(endIso)) + 1) * this.pxPerDay(); }

  taskState(t: ProjectTask): TaskState {
    const today = todayIso();
    if (t.progress >= 100) return 'done';
    if (t.endDate < today) return 'late';
    return t.startDate <= today ? 'active' : 'pending';
  }

  toggle(key: string) {
    this.collapsed.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

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

  // ── Visibilidad y archivo ──
  setVisibility(value: ScheduleVisibility) {
    if (value === this.project().scheduleVisibility) return;
    const label = VISIBILITY_OPTIONS.find(o => o.value === value)?.label;
    this.run(this.projectService.update(this.project().id, { scheduleVisibility: value }), `El cliente ahora ve: ${label}.`);
  }

  uploadScheduleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_DOCUMENT_SIZE) {
      this.notify.error(`El archivo es muy pesado (máximo ${formatFileSize(MAX_DOCUMENT_SIZE)}).`);
      return;
    }
    this.run(this.projectService.addDocument(this.project().id, file, true), 'Archivo de cronograma publicado.');
  }

  unmarkScheduleDoc(docId: string) {
    this.run(this.projectService.setScheduleDocument(this.project().id, docId, false), 'El archivo sigue disponible en Documentos.');
  }

  // ── Tareas ──
  openTaskForm(task?: ProjectTask) {
    this.editingTaskId.set(task?.id ?? null);
    if (task) {
      const { id, position, ...data } = task;
      this.taskForm.set({ ...data });
    } else {
      this.taskForm.set(emptyTask(this.project().stages.find(s => s.progress < 100)?.id ?? this.project().stages[0].id!));
    }
  }

  closeTaskForm() {
    this.taskForm.set(null);
    this.editingTaskId.set(null);
  }

  async saveTask() {
    const f = this.taskForm();
    if (!f) return;
    const data: ProjectTaskInput = {
      ...f, name: f.name.trim(),
      endDate: f.isMilestone ? f.startDate : f.endDate,
      progress: Math.max(0, Math.min(100, Math.round(Number(f.progress) || 0))),
    };
    if (!data.isMilestone && data.endDate < data.startDate) {
      this.notify.error('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    const id = this.editingTaskId();
    const ok = await this.run(
      id ? this.projectService.updateTask(this.project().id, id, data) : this.projectService.addTask(this.project().id, data),
      id ? 'Cronograma actualizado.' : `${data.isMilestone ? 'Hito agregado' : 'Tarea agregada'} al cronograma.`,
    );
    if (ok) this.closeTaskForm();
  }

  async deleteTask() {
    const id = this.editingTaskId();
    const f = this.taskForm();
    if (!id || !f || !confirm(`¿Eliminar "${f.name}" del cronograma?`)) return;
    if (await this.run(this.projectService.deleteTask(this.project().id, id), 'Eliminado del cronograma.')) this.closeTaskForm();
  }

  // ── Exportar ──
  private exportRows(): ExportRow[] {
    return this.rows().flatMap(r => [
      { stage: r.stage.name, task: null, progress: r.stage.progress, start: r.start ?? '', end: r.end ?? '' },
      ...r.tasks.map(t => ({ stage: r.stage.name, task: t, progress: t.progress, start: t.startDate, end: t.endDate })),
    ]);
  }

  private exportColumns(): ExportColumn<ExportRow>[] {
    const ownerLabel = (o: TaskOwner) => (o === 'client' ? 'Cliente' : '3TECH');
    const cols: ExportColumn<ExportRow>[] = [
      { header: 'Etapa', value: r => r.stage },
      { header: 'Actividad', value: r => r.task?.name ?? '(etapa completa)' },
      { header: 'Tipo', value: r => (!r.task ? 'Etapa' : r.task.isMilestone ? 'Hito' : 'Tarea') },
      { header: 'Responsable', value: r => (r.task ? ownerLabel(r.task.owner) : '') },
      { header: 'Inicio', value: r => r.start },
      { header: 'Fin', value: r => r.end },
      { header: 'Avance', value: r => `${r.progress}%` },
      { header: 'Estado', value: r => (r.task ? { done: 'Terminada', late: 'Atrasada', active: 'En curso', pending: 'Pendiente' }[this.taskState(r.task)] : '') },
    ];
    if (this.canEdit()) cols.push({ header: 'Visible al cliente', value: r => (r.task ? (r.task.visibleToClient ? 'Sí' : 'No') : '') });
    return cols;
  }

  private fileName() {
    return `cronograma-${this.project().name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`;
  }

  exportExcel() { exportToExcel(this.fileName(), this.exportColumns(), this.exportRows()); }
  exportPdf() { exportToPdf(`Cronograma · ${this.project().name}`, this.fileName(), this.exportColumns(), this.exportRows()); }

  fileIcon = fileIcon;
  formatFileSize = formatFileSize;
}
