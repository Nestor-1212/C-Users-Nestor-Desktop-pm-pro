import {
  ActivityLogEntry, AppNotification, Company, CompanyPlan, Invoice, Project, ProjectComment,
  ProjectDocument, ProjectRequirement, Ticket, TicketAttachment, TicketResponse, User,
} from '../models';
import { fileUrl } from '../config/api.config';

/**
 * Traducción entre el formato de la API (enums en MAYÚSCULA, relaciones
 * anidadas, rutas de archivo relativas) y los modelos que ya usan todos los
 * componentes. Mantenerla aquí evita que los templates conozcan la API.
 */
// Respuestas JSON de la API: se tipan al mapearlas a los modelos.
type Api = any;

const lower = <T extends string>(v: string) => v.toLowerCase() as T;
export const upper = (v: string) => v.toUpperCase();
const dateOnly = (iso: string) => iso.slice(0, 10);
const opt = <T>(v: T | null | undefined): T | undefined => v ?? undefined;
const extension = (name: string) => name.split('.').pop()?.toLowerCase() || 'file';

const PLAN_FROM_API: Record<string, CompanyPlan> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
export const planToApi = (plan: CompanyPlan) => plan.toUpperCase();

export function toUser(u: Api): User {
  return { id: u.id, username: u.username, role: lower(u.role), companyId: opt(u.companyId), name: u.name, email: u.email };
}

export function toCompany(c: Api): Company {
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, address: opt(c.address),
    status: lower(c.status), plan: PLAN_FROM_API[c.plan] ?? 'Standard',
    createdAt: dateOnly(c.createdAt), logo: fileUrl(c.logoPath),
  };
}

function toComment(c: Api): ProjectComment {
  return {
    id: c.id, projectId: c.projectId, authorId: c.authorId, authorName: c.authorName,
    authorRole: lower(c.authorRole), content: c.content, isInternal: c.isInternal, createdAt: c.createdAt,
  };
}

function toRequirement(r: Api): ProjectRequirement {
  return {
    id: r.id, projectId: r.projectId, title: r.title, description: r.description,
    status: lower(r.status), createdBy: r.createdBy, createdAt: r.createdAt,
  };
}

function toDocument(d: Api): ProjectDocument {
  return {
    id: d.id, projectId: d.projectId, name: d.name, type: extension(d.name), size: d.size,
    uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt, url: fileUrl(d.filePath)!,
  };
}

/** Sirve para la lista (sin detalle) y para el detalle (con comentarios, requerimientos y documentos). */
export function toProject(p: Api): Project {
  const isDetail = Array.isArray(p.requirements);
  const comments = isDetail ? (p.comments as Api[]).map(toComment) : [];
  return {
    id: p.id, name: p.name, description: p.description, companyId: p.companyId,
    status: lower(p.status), priority: lower(p.priority), progress: p.progress,
    startDate: dateOnly(p.startDate), endDate: dateOnly(p.endDate),
    budget: p.budget != null ? Number(p.budget) : undefined,
    internalNotes: opt(p.internalNotes), tags: p.tags ?? [],
    createdAt: p.createdAt, updatedAt: p.updatedAt,
    commentCount: p.comments?.length ?? 0,
    requirementCount: isDetail ? p.requirements.length : (p._count?.requirements ?? 0),
    documentCount: isDetail ? p.documents.length : (p._count?.documents ?? 0),
    comments,
    requirements: isDetail ? (p.requirements as Api[]).map(toRequirement) : [],
    documents: isDetail ? (p.documents as Api[]).map(toDocument) : [],
  };
}

function toAttachment(a: Api): TicketAttachment {
  return { id: a.id, name: a.name, type: extension(a.name), size: a.size, url: fileUrl(a.filePath)! };
}

function toResponse(r: Api): TicketResponse {
  return {
    id: r.id, ticketId: r.ticketId, authorId: r.authorId, authorName: r.authorName,
    authorRole: lower(r.authorRole), content: r.content, createdAt: r.createdAt,
    attachments: (r.attachments ?? []).map(toAttachment),
  };
}

export function toTicket(t: Api): Ticket {
  const responses = Array.isArray(t.responses) ? (t.responses as Api[]).map(toResponse) : [];
  return {
    id: t.id, companyId: t.companyId, companyName: t.company?.name ?? '',
    title: t.title, description: t.description,
    category: lower(t.category), status: lower(t.status), priority: lower(t.priority),
    createdAt: t.createdAt, updatedAt: t.updatedAt, slaDeadline: t.slaDeadline,
    resolvedAt: opt(t.resolvedAt),
    responseCount: t._count?.responses ?? responses.length,
    responses,
    attachments: (t.attachments ?? []).map(toAttachment),
    satisfactionRating: opt(t.satisfactionRating),
    satisfactionComment: opt(t.satisfactionComment),
    ratedAt: opt(t.ratedAt),
  };
}

export function toInvoice(i: Api): Invoice {
  return {
    id: i.id, companyId: i.companyId, companyName: i.company?.name ?? '',
    concept: i.concept, amount: Number(i.amount),
    issueDate: dateOnly(i.issueDate), dueDate: dateOnly(i.dueDate),
    status: lower(i.status), overdue: i.displayStatus === 'OVERDUE',
    paidAt: opt(i.paidAt), createdAt: i.createdAt,
  };
}

export function toNotification(n: Api): AppNotification {
  return {
    id: n.id, recipientRole: lower(n.recipientRole), recipientCompanyId: opt(n.recipientCompanyId),
    title: n.title, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt,
  };
}

export function toActivity(a: Api): ActivityLogEntry {
  return {
    id: a.id, actorId: a.actorId, actorName: a.actorName, entityType: lower(a.entityType),
    entityId: a.entityId, description: a.description, createdAt: a.createdAt,
  };
}

/** Reemplaza (o agrega) un elemento por id, sin mutar el arreglo. */
export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex(x => x.id === item.id);
  if (i === -1) return [...list, item];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}
