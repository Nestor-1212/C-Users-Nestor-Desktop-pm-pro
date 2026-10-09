import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Project, ProjectPriority, ProjectStatus } from '../models';
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
  budget?: number | null;
  internalNotes?: string | null;
  tags?: string[];
}

const toApiBody = (d: Partial<ProjectInput>) => ({
  ...d,
  ...(d.status && { status: upper(d.status) }),
  ...(d.priority && { priority: upper(d.priority) }),
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
      return old ? { ...fresh, comments: old.comments, requirements: old.requirements, documents: old.documents } : fresh;
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

  async addDocument(projectId: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    await firstValueFrom(this.http.post(`${API_URL}/projects/${projectId}/documents`, form));
    await this.loadDetail(projectId);
  }
}
