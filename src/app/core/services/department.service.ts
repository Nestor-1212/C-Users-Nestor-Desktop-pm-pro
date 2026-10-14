import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Department } from '../models';
import { API_URL } from '../config/api.config';
import { toDepartment, upsert } from '../http/mappers';

export interface DepartmentInput { name: string; slaHours: number }

/** Departamentos internos (Tecnología, RR. HH., Call Center…) con su tiempo de respuesta. */
@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private http = inject(HttpClient);
  private _departments = signal<Department[]>([]);
  departments = this._departments.asReadonly();

  async load(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/departments`));
    this._departments.set(list.map(toDepartment));
  }

  getById(id: string | undefined): Department | undefined {
    return id ? this._departments().find(d => d.id === id) : undefined;
  }

  async create(data: DepartmentInput): Promise<Department> {
    const d = toDepartment(await firstValueFrom(this.http.post<any>(`${API_URL}/departments`, data)));
    this._departments.update(list => upsert(list, d).sort((a, b) => a.name.localeCompare(b.name)));
    return d;
  }

  async update(id: string, data: Partial<DepartmentInput & { active: boolean }>): Promise<void> {
    await firstValueFrom(this.http.patch<any>(`${API_URL}/departments/${id}`, data));
    // La respuesta no trae miembros: se conserva lo que ya había y se aplican los cambios.
    this._departments.update(list => list.map(d => (d.id === id ? { ...d, ...data } : d)));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/departments/${id}`));
    this._departments.update(list => list.filter(d => d.id !== id));
  }
}
