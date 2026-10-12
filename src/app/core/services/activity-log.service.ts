import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivityEntity, ActivityKind, ActivityLogEntry } from '../models';
import { API_URL } from '../config/api.config';
import { toActivity } from '../http/mappers';

export interface ActivityFilters {
  entityType?: ActivityEntity;
  kind?: ActivityKind;
  actorId?: string;
  /** ISO; incluye desde esta fecha. */
  from?: string;
  search?: string;
}

export interface ActivitySummary {
  total: number;
  byKind: Partial<Record<ActivityKind, number>>;
  actors: { id: string; name: string; role?: 'owner' | 'technician' | 'client'; count: number }[];
  /** 'YYYY-MM-DD' (zona horaria del negocio) → cantidad de eventos. */
  byDay: Record<string, number>;
}

/** Bitácora de auditoría (solo owner). La escribe el servidor en cada acción. */
@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private _entries = signal<ActivityLogEntry[]>([]);
  entries = this._entries.asReadonly();

  private params(f: ActivityFilters): HttpParams {
    let p = new HttpParams();
    if (f.entityType) p = p.set('entityType', f.entityType.toUpperCase());
    if (f.kind) p = p.set('kind', f.kind.toUpperCase());
    if (f.actorId) p = p.set('actorId', f.actorId);
    if (f.from) p = p.set('from', f.from);
    if (f.search?.trim()) p = p.set('search', f.search.trim());
    return p;
  }

  /** Últimos eventos (para el dashboard). */
  async load(limit = 40): Promise<void> {
    const res = await firstValueFrom(this.http.get<any>(`${API_URL}/activity`, { params: { limit } }));
    this._entries.set(res.items.map(toActivity));
  }

  /** Lo último que pasó en el negocio, sin los inicios de sesión (ruido para un resumen). */
  getRecent(limit: number): ActivityLogEntry[] {
    return this._entries().filter(e => e.kind !== 'access').slice(0, limit);
  }

  /** Una página de la bitácora con filtros; `cursor` = id del último evento ya mostrado. */
  async page(filters: ActivityFilters, cursor?: string, limit = 50): Promise<{ items: ActivityLogEntry[]; nextCursor: string | null }> {
    let params = this.params(filters).set('limit', limit);
    if (cursor) params = params.set('cursor', cursor);
    const res = await firstValueFrom(this.http.get<any>(`${API_URL}/activity`, { params }));
    return { items: res.items.map(toActivity), nextCursor: res.nextCursor };
  }

  async summary(filters: ActivityFilters): Promise<ActivitySummary> {
    const res = await firstValueFrom(this.http.get<any>(`${API_URL}/activity/summary`, { params: this.params(filters) }));
    const byKind: ActivitySummary['byKind'] = {};
    for (const [k, v] of Object.entries(res.byKind)) byKind[k.toLowerCase() as ActivityKind] = v as number;
    return {
      total: res.total,
      byKind,
      actors: res.actors.map((a: any) => ({ ...a, role: a.role ? a.role.toLowerCase() : undefined })),
      byDay: res.byDay,
    };
  }
}
