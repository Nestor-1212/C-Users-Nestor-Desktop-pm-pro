import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ActivityLogEntry, User } from '../models';

/**
 * Bitácora de auditoría: quién hizo qué sobre empresas, usuarios, proyectos
 * y tickets. Antes, borrar una empresa o resetear una contraseña no dejaba
 * ningún rastro de quién lo hizo. Independiente del centro de notificaciones
 * (ese es "para ti"; esto es "todo lo que pasó", solo visible para el owner).
 */
@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private storage = inject(StorageService);
  private _entries = signal<ActivityLogEntry[]>([]);
  entries = this._entries.asReadonly();

  private static readonly MAX_ENTRIES = 300;

  constructor() {
    this._entries.set(this.storage.get<ActivityLogEntry[]>('activity_log') || []);
  }

  private save(entries: ActivityLogEntry[]) {
    this._entries.set(entries);
    this.storage.set('activity_log', entries);
  }

  log(actor: User, entityType: ActivityLogEntry['entityType'], entityId: string, description: string): void {
    const entry: ActivityLogEntry = {
      id: 'al' + Date.now() + Math.random().toString(36).slice(2, 7),
      actorId: actor.id,
      actorName: actor.name,
      entityType,
      entityId,
      description,
      createdAt: new Date().toISOString()
    };
    this.save([entry, ...this._entries()].slice(0, ActivityLogService.MAX_ENTRIES));
  }

  getAll(): ActivityLogEntry[] { return this._entries(); }

  getRecent(limit: number): ActivityLogEntry[] { return this._entries().slice(0, limit); }
}
