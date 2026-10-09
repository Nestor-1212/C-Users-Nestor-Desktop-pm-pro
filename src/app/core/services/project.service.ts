import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ActivityLogService } from './activity-log.service';
import { Project, ProjectComment, ProjectRequirement, ProjectDocument } from '../models';
import { MOCK_PROJECTS } from './mock-data';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private activityLog = inject(ActivityLogService);
  private _projects = signal<Project[]>([]);
  projects = this._projects.asReadonly();

  constructor() {
    if (!this.storage.get('projects')) {
      this.storage.set('projects', MOCK_PROJECTS);
    }
    this._projects.set(this.storage.get<Project[]>('projects') || []);
  }

  private save(projects: Project[]) {
    this._projects.set(projects);
    this.storage.set('projects', projects);
  }

  getAll(): Project[] { return this._projects(); }

  getByCompany(companyId: string): Project[] {
    return this._projects().filter(p => p.companyId === companyId);
  }

  getById(id: string): Project | undefined {
    return this._projects().find(p => p.id === id);
  }

  create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'comments' | 'requirements' | 'documents'>): Project {
    const project: Project = {
      ...data,
      id: 'p' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: [], requirements: [], documents: []
    };
    this.save([...this._projects(), project]);
    this.logActivity(project.id, `creó el proyecto "${project.name}"`);
    return project;
  }

  update(id: string, data: Partial<Project>): void {
    const updated = this._projects().map(p =>
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    );
    this.save(updated);
  }

  /** Como update(), pero registra la edición en la bitácora. Úsalo para ediciones reales desde el formulario, no para sub-mutaciones internas (comentarios, requerimientos, documentos). */
  editProject(id: string, data: Partial<Project>): void {
    this.update(id, data);
    const project = this.getById(id);
    if (project) this.logActivity(id, `editó el proyecto "${project.name}"`);
  }

  delete(id: string): void {
    const project = this.getById(id);
    this.save(this._projects().filter(p => p.id !== id));
    if (project) this.logActivity(id, `eliminó el proyecto "${project.name}"`);
  }

  private logActivity(entityId: string, description: string) {
    const actor = this.auth.currentUser();
    if (actor) this.activityLog.log(actor, 'project', entityId, description);
  }

  addComment(projectId: string, comment: Omit<ProjectComment, 'id' | 'createdAt'>): void {
    const project = this.getById(projectId);
    if (!project) return;
    const newComment: ProjectComment = { ...comment, id: 'cm' + Date.now(), createdAt: new Date().toISOString() };
    this.update(projectId, { comments: [...project.comments, newComment] });
  }

  addRequirement(projectId: string, req: Omit<ProjectRequirement, 'id' | 'createdAt'>): void {
    const project = this.getById(projectId);
    if (!project) return;
    const newReq: ProjectRequirement = { ...req, id: 'r' + Date.now(), createdAt: new Date().toISOString() };
    this.update(projectId, { requirements: [...project.requirements, newReq] });
  }

  updateRequirementStatus(projectId: string, reqId: string, status: 'pending' | 'approved' | 'rejected'): void {
    const project = this.getById(projectId);
    if (!project) return;
    const requirements = project.requirements.map(r => r.id === reqId ? { ...r, status } : r);
    this.update(projectId, { requirements });
  }

  addDocument(projectId: string, doc: Omit<ProjectDocument, 'id' | 'uploadedAt'>): void {
    const project = this.getById(projectId);
    if (!project) return;
    const newDoc: ProjectDocument = { ...doc, id: 'd' + Date.now(), uploadedAt: new Date().toISOString() };
    this.update(projectId, { documents: [...project.documents, newDoc] });
  }
}
