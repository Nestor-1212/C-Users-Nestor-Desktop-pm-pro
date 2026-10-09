import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ActivityLogService } from './activity-log.service';
import { Company } from '../models';
import { MOCK_COMPANIES } from './mock-data';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private activityLog = inject(ActivityLogService);
  private _companies = signal<Company[]>([]);
  companies = this._companies.asReadonly();

  constructor() {
    if (!this.storage.get('companies')) {
      this.storage.set('companies', MOCK_COMPANIES);
    }
    this._companies.set(this.storage.get<Company[]>('companies') || []);
  }

  getAll(): Company[] { return this._companies(); }

  getById(id: string): Company | undefined {
    return this._companies().find(c => c.id === id);
  }

  create(data: Omit<Company, 'id' | 'createdAt'>): Company {
    const company: Company = {
      ...data,
      id: 'c' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [...this._companies(), company];
    this._companies.set(updated);
    this.storage.set('companies', updated);
    this.logActivity('company', company.id, `creó la empresa "${company.name}"`);
    return company;
  }

  update(id: string, data: Partial<Company>): void {
    const updated = this._companies().map(c => c.id === id ? { ...c, ...data } : c);
    this._companies.set(updated);
    this.storage.set('companies', updated);
    const company = updated.find(c => c.id === id);
    if (company) this.logActivity('company', id, `editó la empresa "${company.name}"`);
  }

  delete(id: string): void {
    const company = this.getById(id);
    const updated = this._companies().filter(c => c.id !== id);
    this._companies.set(updated);
    this.storage.set('companies', updated);
    if (company) this.logActivity('company', id, `eliminó la empresa "${company.name}"`);
  }

  private logActivity(entityType: 'company', entityId: string, description: string) {
    const actor = this.auth.currentUser();
    if (actor) this.activityLog.log(actor, entityType, entityId, description);
  }
}
