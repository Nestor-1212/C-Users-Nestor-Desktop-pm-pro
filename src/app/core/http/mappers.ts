import {
  ActivityLogEntry, AppNotification, Company, CompanyPlan, Department, InternalAttachment, InternalRequest, InternalResponse, Project, ProjectComment,
  ProjectDocument, ProjectLink, ProjectRequirement, ProjectStage, ProjectTask, ProjectUpdate, Ticket, TicketAttachment, TicketResponse, User,
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
/**
 * En conversaciones (comentarios, respuestas) solo importa de qué lado habla
 * el autor: el técnico escribe como parte de 3TECH, igual que el administrador.
 */
const side = (role: string): 'owner' | 'client' => (role === 'CLIENT' ? 'client' : 'owner');
export const upper = (v: string) => v.toUpperCase();
const dateOnly = (iso: string) => iso.slice(0, 10);
const opt = <T>(v: T | null | undefined): T | undefined => v ?? undefined;
const extension = (name: string) => name.split('.').pop()?.toLowerCase() || 'file';

const PLAN_FROM_API: Record<string, CompanyPlan> = { BASIC: 'Basic', STANDARD: 'Standard', PREMIUM: 'Premium' };
export const planToApi = (plan: CompanyPlan) => plan.toUpperCase();

export function toUser(u: Api): User {
  return {
    id: u.id, username: u.username, role: lower(u.role), companyId: opt(u.companyId), name: u.name, email: u.email,
    departmentId: opt(u.departmentId), lastLoginAt: opt(u.lastLoginAt),
  };
}

export function toCompany(c: Api): Company {
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, address: opt(c.address),
    status: lower(c.status), plan: PLAN_FROM_API[c.plan] ?? 'Standard',
    createdAt: c.createdAt, logo: fileUrl(c.logoPath),
  };
}

function toComment(c: Api): ProjectComment {
  return {
    id: c.id, projectId: c.projectId, authorId: c.authorId, authorName: c.authorName,
    authorRole: side(c.authorRole), content: c.content, isInternal: c.isInternal, createdAt: c.createdAt,
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
    uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt, url: fileUrl(d.filePath)!, isSchedule: !!d.isSchedule,
  };
}

function toStage(s: Api): ProjectStage {
  return {
    id: s.id, name: s.name, progress: s.progress,
    startDate: s.startDate ? dateOnly(s.startDate) : undefined,
    endDate: s.endDate ? dateOnly(s.endDate) : undefined,
  };
}

function toTask(t: Api): ProjectTask {
  return {
    id: t.id, stageId: t.stageId, name: t.name,
    startDate: dateOnly(t.startDate), endDate: dateOnly(t.endDate), progress: t.progress,
    owner: lower(t.owner), isMilestone: t.isMilestone, visibleToClient: t.visibleToClient, position: t.position,
  };
}

function toLink(l: Api): ProjectLink {
  return {
    id: l.id, label: l.label, url: l.url, type: lower(l.type),
    username: opt(l.username), password: opt(l.password), updatedAt: l.updatedAt,
  };
}

function toUpdate(u: Api): ProjectUpdate {
  return { id: u.id, content: u.content, authorName: u.authorName, createdAt: u.createdAt };
}

/** Sirve para la lista (sin detalle) y para el detalle (con comentarios, requerimientos y documentos). */
export function toProject(p: Api): Project {
  const isDetail = Array.isArray(p.requirements);
  const comments = isDetail ? (p.comments as Api[]).map(toComment) : [];
  return {
    id: p.id, name: p.name, description: p.description, companyId: p.companyId,
    status: lower(p.status), priority: lower(p.priority), progress: p.progress,
    startDate: dateOnly(p.startDate), endDate: dateOnly(p.endDate),
    internalNotes: opt(p.internalNotes), tags: p.tags ?? [],
    scheduleVisibility: lower(p.scheduleVisibility ?? 'FULL'),
    createdAt: p.createdAt, updatedAt: p.updatedAt,
    commentCount: p.comments?.length ?? 0,
    requirementCount: isDetail ? p.requirements.length : (p._count?.requirements ?? 0),
    documentCount: isDetail ? p.documents.length : (p._count?.documents ?? 0),
    comments,
    requirements: isDetail ? (p.requirements as Api[]).map(toRequirement) : [],
    documents: isDetail ? (p.documents as Api[]).map(toDocument) : [],
    stages: (p.stages ?? []).map(toStage),
    tasks: (p.tasks ?? []).map(toTask),
    links: (p.links ?? []).map(toLink),
    updates: (p.updates ?? []).map(toUpdate),
  };
}

function toAttachment(a: Api): TicketAttachment {
  return { id: a.id, name: a.name, type: extension(a.name), size: a.size, url: fileUrl(a.filePath)! };
}

function toResponse(r: Api): TicketResponse {
  return {
    id: r.id, ticketId: r.ticketId, authorId: r.authorId, authorName: r.authorName,
    authorRole: side(r.authorRole), content: r.content, createdAt: r.createdAt,
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
    firstResponseAt: opt(t.firstResponseAt),
    resolvedAt: opt(t.resolvedAt),
    responseCount: t._count?.responses ?? responses.length,
    responses,
    attachments: (t.attachments ?? []).map(toAttachment),
    satisfactionRating: opt(t.satisfactionRating),
    satisfactionComment: opt(t.satisfactionComment),
    ratedAt: opt(t.ratedAt),
    createdById: opt(t.createdById),
    createdByName: opt(t.createdByName),
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name, role: lower(t.assignedTo.role) } : undefined,
    resolvedByName: opt(t.resolvedByName),
    lastResponse: t.lastResponse
      ? { authorName: t.lastResponse.authorName, authorRole: side(t.lastResponse.authorRole), createdAt: t.lastResponse.createdAt, content: t.lastResponse.content }
      : responses.length
        ? { authorName: responses[responses.length - 1].authorName, authorRole: responses[responses.length - 1].authorRole, createdAt: responses[responses.length - 1].createdAt, content: responses[responses.length - 1].content.slice(0, 160) }
        : undefined,
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
    id: a.id, actorId: a.actorId, actorName: a.actorName, actorRole: a.actorRole ? lower<'owner' | 'technician' | 'client'>(a.actorRole) : undefined,
    entityType: lower(a.entityType), entityId: a.entityId, description: a.description,
    kind: lower(a.kind ?? 'UPDATE'), ip: opt(a.ip), createdAt: a.createdAt,
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

// ───────────── Solicitudes internas ─────────────

export function toDepartment(d: Api): Department {
  return {
    id: d.id, name: d.name, slaHours: d.slaHours, active: d.active, openReceived: d.openReceived ?? 0,
    members: (d.members ?? []).map((m: Api) => ({ id: m.id, name: m.name, role: lower(m.role) })),
  };
}

const toInternalAttachment = (a: Api): InternalAttachment => ({
  id: a.id, name: a.name, type: extension(a.name), size: a.size, url: fileUrl(a.filePath)!,
});

const toInternalResponse = (r: Api): InternalResponse => ({
  id: r.id, authorId: r.authorId, authorName: r.authorName, authorRole: lower(r.authorRole),
  authorDepartmentId: opt(r.authorDepartmentId), content: r.content, createdAt: r.createdAt,
  attachments: (r.attachments ?? []).map(toInternalAttachment),
});

export function toInternalRequest(r: Api): InternalRequest {
  return {
    id: r.id, number: r.number, title: r.title, description: r.description,
    category: lower(r.category), status: lower(r.status), priority: lower(r.priority),
    fromDepartment: r.fromDepartment, toDepartment: r.toDepartment,
    createdById: opt(r.createdById), createdByName: r.createdByName,
    assignedTo: r.assignedTo ? { id: r.assignedTo.id, name: r.assignedTo.name, role: lower(r.assignedTo.role) } : undefined,
    slaDeadline: r.slaDeadline, firstResponseAt: opt(r.firstResponseAt), resolvedAt: opt(r.resolvedAt), resolvedByName: opt(r.resolvedByName),
    slaBreached: !!r.slaBreached, slaMet: r.slaMet ?? null,
    createdAt: r.createdAt, updatedAt: r.updatedAt,
    responseCount: r._count?.responses ?? r.responses?.length ?? 0,
    lastResponse: r.lastResponse ? { ...r.lastResponse, authorDepartmentId: opt(r.lastResponse.authorDepartmentId) } : undefined,
    responses: r.responses ? r.responses.map(toInternalResponse) : undefined,
    attachments: r.attachments ? r.attachments.map(toInternalAttachment) : undefined,
  };
}
