import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { InternalCategory, InternalRequest, TicketPriority, TicketStatus } from '../models';
import { API_URL } from '../config/api.config';
import { toInternalRequest, upper, upsert } from '../http/mappers';
import { AuthService } from './auth.service';

export interface InternalRequestInput {
  toDepartmentId: string;
  /** Solo el Propietario elige desde qué departamento envía. */
  fromDepartmentId?: string;
  title: string;
  description: string;
  category: InternalCategory;
  priority: TicketPriority;
}

export const INTERNAL_CATEGORY_LABELS: Record<InternalCategory, string> = {
  request: 'Solicitud', incident: 'Incidencia', question: 'Consulta', other: 'Otro',
};

const isOpen = (r: InternalRequest) => r.status !== 'resolved' && r.status !== 'closed';

/**
 * Solicitudes internas visibles para el usuario (el servidor ya filtra por
 * departamento). Las bandejas se calculan aquí sobre la misma lista.
 */
@Injectable({ providedIn: 'root' })
export class InternalRequestService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private _items = signal<InternalRequest[]>([]);
  items = this._items.asReadonly();

  /** Lo que espera al usuario: recibidas por su departamento, abiertas y todavía sin respuesta. */
  pendingForMe = computed(() => {
    const dep = this.auth.currentUser()?.departmentId;
    return dep ? this._items().filter(r => r.toDepartment.id === dep && isOpen(r) && !r.firstResponseAt).length : 0;
  });

  async load(): Promise<void> {
    const list = (await firstValueFrom(this.http.get<any[]>(`${API_URL}/internal-requests`))).map(toInternalRequest);
    const previous = new Map(this._items().map(r => [r.id, r]));
    this._items.set(list.map(fresh => {
      const old = previous.get(fresh.id);
      return old ? { ...fresh, responses: old.responses, attachments: old.attachments } : fresh;
    }));
  }

  async loadDetail(id: string): Promise<InternalRequest> {
    const r = toInternalRequest(await firstValueFrom(this.http.get<any>(`${API_URL}/internal-requests/${id}`)));
    this._items.update(list => upsert(list, r));
    return r;
  }

  getById(id: string | null): InternalRequest | undefined {
    return id ? this._items().find(r => r.id === id) : undefined;
  }

  async create(data: InternalRequestInput, file?: File): Promise<InternalRequest> {
    const fd = new FormData();
    fd.append('toDepartmentId', data.toDepartmentId);
    if (data.fromDepartmentId) fd.append('fromDepartmentId', data.fromDepartmentId);
    fd.append('title', data.title);
    fd.append('description', data.description);
    fd.append('category', upper(data.category));
    fd.append('priority', upper(data.priority));
    if (file) fd.append('file', file);
    const r = toInternalRequest(await firstValueFrom(this.http.post<any>(`${API_URL}/internal-requests`, fd)));
    this._items.update(list => [r, ...list]);
    return r;
  }

  async respond(id: string, content: string, file?: File): Promise<void> {
    const fd = new FormData();
    fd.append('content', content);
    if (file) fd.append('file', file);
    await firstValueFrom(this.http.post(`${API_URL}/internal-requests/${id}/responses`, fd));
    await this.loadDetail(id);
  }

  async setStatus(id: string, status: TicketStatus): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/internal-requests/${id}/status`, { status: upper(status) }));
    await this.loadDetail(id);
  }

  async assign(id: string, assignedToId: string | null): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/internal-requests/${id}/assign`, { assignedToId }));
    await this.loadDetail(id);
  }
}
