import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { CompanyService } from './company.service';
import { AuthService } from './auth.service';
import { NotificationCenterService } from './notification-center.service';
import { ActivityLogService } from './activity-log.service';
import { Ticket, TicketResponse, TicketStatus } from '../models';
import { MOCK_TICKETS } from './mock-data';
import { TICKET_STATUS_LABELS } from '../../shared/pipes/labels.pipe';

/** Horas de SLA de primera respuesta según el plan contratado por la empresa. */
const SLA_HOURS_BY_PLAN: Record<string, number> = {
  Premium: 4,
  Standard: 12,
  Basic: 24,
};
const DEFAULT_SLA_HOURS = 24;

@Injectable({ providedIn: 'root' })
export class TicketService {
  private storage = inject(StorageService);
  private companyService = inject(CompanyService);
  private auth = inject(AuthService);
  private notificationCenter = inject(NotificationCenterService);
  private activityLog = inject(ActivityLogService);
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

  /** Horas de SLA que le corresponden a una empresa según su plan contratado. */
  getSlaHoursForCompany(companyId: string): number {
    const plan = this.companyService.getById(companyId)?.plan;
    return (plan ? SLA_HOURS_BY_PLAN[plan] : undefined) ?? DEFAULT_SLA_HOURS;
  }

  /** Horas de SLA originalmente asignadas a un ticket ya creado (derivado de sus propias fechas). */
  getSlaTotalHours(ticket: Ticket): number {
    const diff = new Date(ticket.slaDeadline).getTime() - new Date(ticket.createdAt).getTime();
    return Math.round(diff / (1000 * 60 * 60));
  }

  create(data: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'slaDeadline' | 'responses' | 'status'>): Ticket {
    const createdAt = new Date().toISOString();
    const slaHours = this.getSlaHoursForCompany(data.companyId);
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
    const ticket: Ticket = {
      ...data, id: 't' + Date.now(), status: 'open',
      createdAt, updatedAt: createdAt, slaDeadline, responses: []
    };
    this.save([...this._tickets(), ticket]);
    this.notificationCenter.notifyOwner(
      'Nuevo ticket de soporte',
      `${ticket.companyName}: ${ticket.title}`,
      `/tickets/${ticket.id}`
    );
    this.logActivity(ticket.id, `creó el ticket "${ticket.title}" (${ticket.companyName})`);
    return ticket;
  }

  updateStatus(id: string, status: TicketStatus): void {
    const updatedAt = new Date().toISOString();
    const resolvedAt = (status === 'resolved' || status === 'closed') ? updatedAt : undefined;
    const updated = this._tickets().map(t =>
      t.id === id ? { ...t, status, updatedAt, ...(resolvedAt ? { resolvedAt } : {}) } : t
    );
    this.save(updated);
    const ticket = updated.find(t => t.id === id);
    if (ticket) {
      this.notificationCenter.notifyCompany(
        ticket.companyId,
        'Tu ticket cambió de estado',
        `${ticket.title} → ${TICKET_STATUS_LABELS[status] ?? status}`,
        `/tickets/${ticket.id}`
      );
      this.logActivity(id, `cambió el ticket "${ticket.title}" a estado "${TICKET_STATUS_LABELS[status] ?? status}"`);
    }
  }

  private logActivity(entityId: string, description: string) {
    const actor = this.auth.currentUser();
    if (actor) this.activityLog.log(actor, 'ticket', entityId, description);
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
    if (response.authorRole === 'owner') {
      this.notificationCenter.notifyCompany(
        ticket.companyId,
        'Nueva respuesta de soporte',
        ticket.title,
        `/tickets/${ticket.id}`
      );
    } else {
      this.notificationCenter.notifyOwner(
        'Nueva respuesta de cliente',
        `${ticket.companyName}: ${ticket.title}`,
        `/tickets/${ticket.id}`
      );
    }
  }

  rateSatisfaction(ticketId: string, rating: number, comment?: string): void {
    const ticket = this.getById(ticketId);
    if (!ticket) return;
    const ratedAt = new Date().toISOString();
    const updated = this._tickets().map(t =>
      t.id === ticketId ? { ...t, satisfactionRating: rating, satisfactionComment: comment, ratedAt } : t
    );
    this.save(updated);
    this.notificationCenter.notifyOwner(
      'Nueva calificación de satisfacción',
      `${ticket.companyName} calificó "${ticket.title}" con ${rating}/5`,
      `/tickets/${ticket.id}`
    );
  }

  /** Promedio de satisfacción (1-5) de una lista de tickets, o de todos si no se especifica. null si ninguno fue calificado. */
  getAverageSatisfaction(tickets?: Ticket[]): number | null {
    const rated = (tickets ?? this._tickets()).filter((t): t is Ticket & { satisfactionRating: number } => typeof t.satisfactionRating === 'number');
    if (!rated.length) return null;
    const sum = rated.reduce((acc, t) => acc + t.satisfactionRating, 0);
    return Math.round((sum / rated.length) * 10) / 10;
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
