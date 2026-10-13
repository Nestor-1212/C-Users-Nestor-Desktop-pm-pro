import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectLink, ProjectLinkType, ProjectPriority, ProjectStage, ProjectStatus, ProjectTask, ScheduleVisibility } from '../models';
import { API_URL } from '../config/api.config';
import { toProject, upper, upsert } from '../http/mappers';

export interface ProjectInput {
  name: string;
  description: string;
  companyId: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  progress: number;
  startDate: string;
  endDate: string;
  internalNotes?: string | null;
  tags?: string[];
  scheduleVisibility?: ScheduleVisibility;
}

export type ProjectTaskInput = Omit<ProjectTask, 'id' | 'position'>;

export interface ProjectLinkInput {
  label: string;
  url: string;
  type: ProjectLinkType;
  username?: string | null;
  password?: string | null;
}

const toApiBody = (d: Partial<ProjectInput>) => ({
  ...d,
  ...(d.status && { status: upper(d.status) }),
  ...(d.priority && { priority: upper(d.priority) }),
  ...(d.scheduleVisibility && { scheduleVisibility: upper(d.scheduleVisibility) }),
});

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private http = inject(HttpClient);
  private _projects = signal<Project[]>([]);
  projects = this._projects.asReadonly();

  async load(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/projects`));
    // Conserva el detalle ya cargado (comentarios, documentos...) de los proyectos que no cambiaron de forma.
    const previous = new Map(this._projects().map(p => [p.id, p]));
    this._projects.set(list.map(raw => {
      const fresh = toProject(raw);
      const old = previous.get(fresh.id);
      return old
        ? { ...fresh, comments: old.comments, requirements: old.requirements, documents: old.documents, stages: old.stages, tasks: old.tasks, links: old.links, updates: old.updates }
        : fresh;
    }));
  }

  /** Trae el proyecto completo (comentarios, requerimientos, documentos) y lo guarda en la caché. */
  async loadDetail(id: string): Promise<Project> {
    const p = toProject(await firstValueFrom(this.http.get<any>(`${API_URL}/projects/${id}`)));
    this._projects.update(list => upsert(list, p));
    return p;
  }

  getAll(): Project[] { return this._projects(); }

  getByCompany(companyId: string): Project[] {
    return this._projects().filter(p => p.companyId === companyId);
  }

  getById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  async create(data: ProjectInput): Promise<void> {
    await firstValueFrom(this.http.post<any>(`${API_URL}/projects`, toApiBody(data)));
    await this.load();
  }

  /** Edición desde el formulario o cambios rápidos (estado, progreso); el servidor lo registra en la bitácora. */
  async update(id: string, data: Partial<ProjectInput>): Promise<void> {
    await firstValueFrom(this.http.patch<any>(`${API_URL}/projects/${id}`, toApiBody(data)));
    await this.loadDetail(id);
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/projects/${id}`));
    this._projects.update(list => list.filter(p => p.id !== id));
  }

  async addComment(projectId: string, content: string, isInternal: boolean): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/comments`, { content, isInternal }));
    await this.loadDetail(projectId);
  }

  async addRequirement(projectId: string, title: string, description: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/requirements`, { title, description }));
    await this.loadDetail(projectId);
  }

  async updateRequirementStatus(projectId: string, reqId: string, status: 'pending' | 'approved' | 'rejected'): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/projects/${projectId}/requirements/${reqId}`, { status: upper(status) }));
    await this.loadDetail(projectId);
  }

  /** isSchedule: lo sube como el archivo de cronograma destacado (solo owner). */
  async addDocument(projectId: string, file: File, isSchedule = false): Promise<void> {
    const form = new FormData();
    if (isSchedule) form.append('isSchedule', 'true');
    form.append('file', file);
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/documents`, form));
    await this.loadDetail(projectId);
  }

  // ── Seguimiento (solo owner) ──

  /** Guarda la lista completa de etapas; el servidor recalcula el progreso del proyecto. */
  async saveStages(projectId: string, stages: ProjectStage[]): Promise<void> {
    const body = stages.map(s => ({
      id: s.id, name: s.name, progress: s.progress,
      startDate: s.startDate || null, endDate: s.endDate || null,
    }));
    await firstValueFrom(this.http.put(`${API_URL}/projects/${projectId}/stages`, body));
    await this.loadDetail(projectId);
  }

  async addLink(projectId: string, link: ProjectLinkInput): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/links`, { ...link, type: upper(link.type) }));
    await this.loadDetail(projectId);
  }

  async updateLink(projectId: string, linkId: ProjectLink['id'], link: ProjectLinkInput): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/projects/${projectId}/links/${linkId}`, { ...link, type: upper(link.type) }));
    await this.loadDetail(projectId);
  }

  async deleteLink(projectId: string, linkId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/projects/${projectId}/links/${linkId}`));
    await this.loadDetail(projectId);
  }

  async addUpdate(projectId: string, content: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/updates`, { content }));
    await this.loadDetail(projectId);
  }

  async deleteUpdate(projectId: string, updateId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/projects/${projectId}/updates/${updateId}`));
    await this.loadDetail(projectId);
  }

  // ── Cronograma (solo owner) ──

  async addTask(projectId: string, task: ProjectTaskInput): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/tasks`, { ...task, owner: upper(task.owner) }));
    await this.loadDetail(projectId);
  }

  async updateTask(projectId: string, taskId: string, task: Partial<ProjectTaskInput>): Promise<void> {
    const body = { ...task, ...(task.owner && { owner: upper(task.owner) }) };
    await firstValueFrom(this.http.patch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, body));
    await this.loadDetail(projectId);
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/projects/${projectId}/tasks/${taskId}`));
    await this.loadDetail(projectId);
  }

  /** Marca (o desmarca) un documento como el archivo de cronograma del proyecto. */
  async setScheduleDocument(projectId: string, docId: string, isSchedule: boolean): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/projects/${projectId}/documents/${docId}`, { isSchedule }));
    await this.loadDetail(projectId);
  }
}
