import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CompanyPlan, Ticket, TicketPriority, TicketStatus } from '../models';
import { API_URL } from '../config/api.config';
import { toTicket, upper, upsert } from '../http/mappers';
import { CompanyService } from './company.service';

/** Solo para mostrar el SLA esperado antes de crear el ticket; el plazo real lo calcula el servidor. */
const SLA_HOURS_BY_PLAN: Record<CompanyPlan, number> = { Premium: 4, Standard: 12, Basic: 24 };

export interface TicketInput {
  title: string;
  description: string;
  category: Ticket['category'];
  priority: TicketPriority;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private http = inject(HttpClient);
  private companyService = inject(CompanyService);
  private _tickets = signal<Ticket[]>([]);
  tickets = this._tickets.asReadonly();

  async load(): Promise<void> {
    const list = await firstValueFrom(this.http.get<any[]>(`${API_URL}/tickets`));
    const previous = new Map(this._tickets().map(t => [t.id, t]));
    // La API los devuelve del más reciente al más antiguo; los componentes esperan orden de creación.
    this._tickets.set(list.map(toTicket).reverse().map(fresh => {
      const old = previous.get(fresh.id);
      return old ? { ...fresh, responses: old.responses, attachments: old.attachments } : fresh;
    }));
  }

  /** Ticket completo con respuestas y adjuntos. */
  async loadDetail(id: string): Promise<Ticket> {
    const t = toTicket(await firstValueFrom(this.http.get<any>(`${API_URL}/tickets/${id}`)));
    this._tickets.update(list => upsert(list, t));
    return t;
  }

  getAll(): Ticket[] { return this._tickets(); }

  getByCompany(companyId: string): Ticket[] {
    return this._tickets().filter(t => t.companyId === companyId);
  }

  getById(id: string): Ticket | undefined {
    return this._tickets().find(t => t.id === id);
  }

  getSlaHoursForCompany(companyId: string): number {
    const plan = this.companyService.getById(companyId)?.plan;
    return plan ? SLA_HOURS_BY_PLAN[plan] : SLA_HOURS_BY_PLAN.Standard;
  }

  getSlaTotalHours(ticket: Ticket): number {
    return Math.round((new Date(ticket.slaDeadline).getTime() - new Date(ticket.createdAt).getTime()) / 36e5);
  }

  async create(data: TicketInput, attachment?: File): Promise<Ticket> {
    const form = new FormData();
    form.append('title', data.title);
    form.append('description', data.description);
    form.append('category', upper(data.category));
    form.append('priority', upper(data.priority));
    if (attachment) form.append('file', attachment);
    const created = await firstValueFrom(this.http.post<any>(`${API_URL}/tickets`, form));
    return this.loadDetail(created.id);
  }

  async updateStatus(id: string, status: TicketStatus): Promise<void> {
    await firstValueFrom(this.http.patch(`${API_URL}/tickets/${id}/status`, { status: upper(status) }));
    await this.loadDetail(id);
  }

  async addResponse(ticketId: string, content: string, attachment?: File): Promise<void> {
    const form = new FormData();
    form.append('content', content);
    if (attachment) form.append('file', attachment);
    await firstValueFrom(this.http.post(`${API_URL}/tickets/${ticketId}/responses`, form));
    await this.loadDetail(ticketId);
  }

  async rateSatisfaction(ticketId: string, rating: number, comment?: string): Promise<void> {
    await firstValueFrom(this.http.post(`${API_URL}/tickets/${ticketId}/rating`, { rating, comment }));
    await this.loadDetail(ticketId);
  }

  /** Promedio (1-5) de los tickets calificados, o null si ninguno lo está. */
  getAverageSatisfaction(tickets?: Ticket[]): number | null {
    const rated = (tickets ?? this._tickets()).filter(t => typeof t.satisfactionRating === 'number');
    if (!rated.length) return null;
    const sum = rated.reduce((acc, t) => acc + (t.satisfactionRating ?? 0), 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }

  isSlaBreached(ticket: Ticket): boolean {
    if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
    return new Date() > new Date(ticket.slaDeadline);
  }

  getSlaHoursLeft(ticket: Ticket): number {
    const diff = new Date(ticket.slaDeadline).getTime() - Date.now();
    return Math.max(0, Math.round(diff / 36e5));
  }
}
