import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { Company } from '../models';
import { MOCK_COMPANIES } from './mock-data';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private storage = inject(StorageService);
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
    return company;
  }

  update(id: string, data: Partial<Company>): void {
    const updated = this._companies().map(c => c.id === id ? { ...c, ...data } : c);
    this._companies.set(updated);
    this.storage.set('companies', updated);
  }

  delete(id: string): void {
    const updated = this._companies().filter(c => c.id !== id);
    this._companies.set(updated);
    this.storage.set('companies', updated);
  }
}
