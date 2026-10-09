import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ActivityLogEntry } from '../models';
import { API_URL } from '../config/api.config';
import { toActivity } from '../http/mappers';

/** Bitácora de auditoría (solo owner). La escribe el servidor en cada acción. */
@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private http = inject(HttpClient);
  private _entries = signal<ActivityLogEntry[]>([]);
  entries = this._entries.asReadonly();

  async load(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/activity?limit=300`));
    this._entries.set(list.map(toActivity));
  }

  getAll(): ActivityLogEntry[] { return this._entries(); }

  getRecent(limit: number): ActivityLogEntry[] { return this._entries().slice(0, limit); }
}
