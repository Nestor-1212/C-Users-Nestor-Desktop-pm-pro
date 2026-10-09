import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Company, CompanyPlan } from '../models';
import { API_URL } from '../config/api.config';
import { toCompany, planToApi, upper, upsert } from '../http/mappers';
import { AuthService } from './auth.service';

export interface CompanyInput {
  name: string;
  email: string;
  phone: string;
  address?: string;
  plan: CompanyPlan;
  status: 'active' | 'inactive';
}

const toApiBody = (d: Partial<CompanyInput>) => ({
  ...d,
  ...(d.plan && { plan: planToApi(d.plan) }),
  ...(d.status && { status: upper(d.status) }),
});

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private _companies = signal<Company[]>([]);
  companies = this._companies.asReadonly();

  /** El owner carga todas; un cliente solo la suya (para logo y plan → SLA). */
  async load(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) return;
    if (user.role === 'owner') {
      const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/companies`));
      this._companies.set(list.map(toCompany));
    } else if (user.companyId) {
      const c = await firstValueFrom(this.http.get<any>(`${API_URL}/companies/${user.companyId}`));
      this._companies.set([toCompany(c)]);
    }
  }

  getAll(): Company[] { return this._companies(); }

  getById(id: string): Company | undefined {
    return this._companies().find(c => c.id === id);
  }

  async create(data: CompanyInput, logo?: File): Promise<Company> {
    let c = toCompany(await firstValueFrom(this.http.post<any>(`${API_URL}/companies`, toApiBody(data))));
    if (logo) c = await this.uploadLogo(c.id, logo);
    this._companies.update(list => upsert(list, c));
    return c;
  }

  /** `logo`: File = reemplazar, null = quitar, undefined = no tocar. */
  async update(id: string, data: Partial<CompanyInput>, logo?: File | null): Promise<Company> {
    let c = toCompany(await firstValueFrom(this.http.patch<any>(`${API_URL}/companies/${id}`, toApiBody(data))));
    if (logo instanceof File) c = await this.uploadLogo(id, logo);
    else if (logo === null) c = toCompany(await firstValueFrom(this.http.delete<any>(`${API_URL}/companies/${id}/logo`)));
    this._companies.update(list => upsert(list, c));
    return c;
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/companies/${id}`));
    this._companies.update(list => list.filter(c => c.id !== id));
  }

  private async uploadLogo(id: string, file: File): Promise<Company> {
    const form = new FormData();
    form.append('file', file);
    return toCompany(await firstValueFrom(this.http.post<any>(`${API_URL}/companies/${id}/logo`, form)));
  }
}
