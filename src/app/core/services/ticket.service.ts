import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { Ticket, TicketResponse, TicketStatus } from '../models';
import { MOCK_TICKETS } from './mock-data';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private storage = inject(StorageService);
  private _tickets = signal<Ticket[]>([]);
  tickets = this._tickets.asReadonly();

  constructor() {
    if (!this.storage.get('tickets')) {
      this.storage.set('tickets', MOCK_TICKETS);
    }
    this._tickets.set(this.storage.get<Ticket[]>('tickets') || []);
  }

  private save(tickets: Ticket[]) {
    this._tickets.set(tickets);
    this.storage.set('tickets', tickets);
  }

  getAll(): Ticket[] { return this._tickets(); }

  getByCompany(companyId: string): Ticket[] {
    return this._tickets().filter(t => t.companyId === companyId);
  }

  getById(id: string): Ticket | undefined {
    return this._tickets().find(t => t.id === id);
  }

  create(data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaDeadline' | 'responses' | 'status'>): Ticket {
    const createdAt = new Date().toISOString();
    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const ticket: Ticket = {
      ...data, id: 't' + Date.now(), status: 'open',
      createdAt, updatedAt: createdAt, slaDeadline, responses: []
    };
    this.save([...this._tickets(), ticket]);
    return ticket;
  }

  updateStatus(id: string, status: TicketStatus): void {
    const updatedAt = new Date().toISOString();
    const resolvedAt = (status === 'resolved' || status === 'closed') ? updatedAt : undefined;
    const updated = this._tickets().map(t =>
      t.id === id ? { ...t, status, updatedAt, ...(resolvedAt ? { resolvedAt } : {}) } : t
    );
    this.save(updated);
  }

  addResponse(ticketId: string, response: Omit<TicketResponse, 'id' | 'createdAt'>): void {
    const ticket = this.getById(ticketId);
    if (!ticket) return;
    const newResponse: TicketResponse = { ...response, id: 'tr' + Date.now(), createdAt: new Date().toISOString() };
    const updated = this._tickets().map(t =>
      t.id === ticketId
        ? { ...t, responses: [...t.responses, newResponse], updatedAt: new Date().toISOString() }
        : t
    );
    this.save(updated);
  }

  isSlaBreached(ticket: Ticket): boolean {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
    return new Date() > new Date(ticket.slaDeadline);
  }

  getSlaHoursLeft(ticket: Ticket): number {
    const diff = new Date(ticket.slaDeadline).getTime() - Date.now();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60)));
  }
}
