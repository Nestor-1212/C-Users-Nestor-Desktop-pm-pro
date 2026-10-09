import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Invoice } from '../models';
import { API_URL } from '../config/api.config';
import { toInvoice, upsert } from '../http/mappers';

export interface InvoiceInput {
  companyId: string;
  concept: string;
  amount: number;
  dueDate: string;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);
  private _invoices = signal<Invoice[]>([]);
  invoices = this._invoices.asReadonly();

  async load(): Promise<void> {
    const res = await firstValueFrom(this.http.get<{ invoices: any[] }>(`${API_URL}/invoices`));
    this._invoices.set(res.invoices.map(toInvoice));
  }

  getAll(): Invoice[] { return this._invoices(); }

  getByCompany(companyId: string): Invoice[] {
    return this._invoices().filter(i => i.companyId === companyId);
  }

  getById(id: string): Invoice | undefined {
    return this._invoices().find(i => i.id === id);
  }

  async create(data: InvoiceInput): Promise<Invoice> {
    const inv = toInvoice(await firstValueFrom(this.http.post<any>(`${API_URL}/invoices`, data)));
    this._invoices.update(list => upsert(list, inv));
    return inv;
  }

  async markPaid(id: string): Promise<void> {
    const inv = toInvoice(await firstValueFrom(this.http.post<any>(`${API_URL}/invoices/${id}/pay`, {})));
    this._invoices.update(list => upsert(list, inv));
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${API_URL}/invoices/${id}`));
    this._invoices.update(list => list.filter(i => i.id !== id));
  }

  /** "Vencida" lo decide el servidor comparando fechas en la zona horaria del negocio. */
  isOverdue(invoice: Invoice): boolean {
    return invoice.overdue;
  }

  totalPending(invoices?: Invoice[]): number {
    return (invoices ?? this._invoices()).filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
  }
}
