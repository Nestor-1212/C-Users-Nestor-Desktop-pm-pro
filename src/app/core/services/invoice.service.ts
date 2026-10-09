import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { ActivityLogService } from './activity-log.service';
import { Invoice } from '../models';
import { MOCK_INVOICES } from './mock-data';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private activityLog = inject(ActivityLogService);
  private _invoices = signal<Invoice[]>([]);
  invoices = this._invoices.asReadonly();

  constructor() {
    if (!this.storage.get('invoices')) {
      this.storage.set('invoices', MOCK_INVOICES);
    }
    this._invoices.set(this.storage.get<Invoice[]>('invoices') || []);
  }

  private save(invoices: Invoice[]) {
    this._invoices.set(invoices);
    this.storage.set('invoices', invoices);
  }

  getAll(): Invoice[] { return this._invoices(); }

  getByCompany(companyId: string): Invoice[] {
    return this._invoices().filter(i => i.companyId === companyId);
  }

  getById(id: string): Invoice | undefined {
    return this._invoices().find(i => i.id === id);
  }

  create(data: Omit<Invoice, 'id' | 'createdAt' | 'status' | 'paidAt'>): Invoice {
    const invoice: Invoice = { ...data, id: 'inv' + Date.now(), status: 'pending', createdAt: new Date().toISOString() };
    this.save([...this._invoices(), invoice]);
    this.logActivity(invoice.id, `creó una factura de Q${invoice.amount.toLocaleString('es-GT')} para "${invoice.companyName}"`);
    return invoice;
  }

  markPaid(id: string): void {
    const invoice = this.getById(id);
    this.save(this._invoices().map(i => i.id === id ? { ...i, status: 'paid' as const, paidAt: new Date().toISOString() } : i));
    if (invoice) this.logActivity(id, `marcó como pagada la factura de "${invoice.companyName}" (Q${invoice.amount.toLocaleString('es-GT')})`);
  }

  delete(id: string): void {
    const invoice = this.getById(id);
    this.save(this._invoices().filter(i => i.id !== id));
    if (invoice) this.logActivity(id, `eliminó una factura de "${invoice.companyName}" (Q${invoice.amount.toLocaleString('es-GT')})`);
  }

  isOverdue(invoice: Invoice): boolean {
    return invoice.status === 'pending' && new Date(invoice.dueDate) < new Date();
  }

  totalPending(invoices?: Invoice[]): number {
    return (invoices ?? this._invoices()).filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
  }

  private logActivity(entityId: string, description: string) {
    const actor = this.auth.currentUser();
    if (actor) this.activityLog.log(actor, 'invoice', entityId, description);
  }
}
