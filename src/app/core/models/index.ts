/** Integrante del equipo de 3TECH al que se le pueden asignar tickets. */
export interface StaffMember {
  id: string;
  name: string;
  role: 'owner' | 'technician';
}

export interface User {
  id: string;
  username: string;
  role: 'owner' | 'technician' | 'client' | 'collaborator';
  companyId?: string;
  /** Departamento interno (colaboradores y equipo). */
  departmentId?: string;
  name: string;
  email: string;
  /** Último inicio de sesión (solo en la gestión de usuarios). */
  lastLoginAt?: string;
}

export type CompanyPlan = 'Basic' | 'Standard' | 'Premium';

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  plan: CompanyPlan;
  /** URL absoluta del logo servido por la API. */
  logo?: string;
}

export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'completed' | 'on_hold';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ProjectComment {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorRole: 'owner' | 'client';
  content: string;
  createdAt: string;
  isInternal: boolean;
}

export interface ProjectRequirement {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdAt: string;
  fileUrl?: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
  /** Archivo de cronograma destacado en la pestaña Cronograma. */
  isSchedule: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  companyId: string;
  status: ProjectStatus;
  progress: number;
  priority: ProjectPriority;
  startDate: string;
  endDate: string;
  internalNotes?: string;
  tags?: string[];
  scheduleVisibility: ScheduleVisibility;
  createdAt: string;
  updatedAt: string;
  /** Contadores: la lista de la API no trae los arreglos completos (solo el detalle). */
  commentCount: number;
  requirementCount: number;
  documentCount: number;
  comments: ProjectComment[];
  requirements: ProjectRequirement[];
  documents: ProjectDocument[];
  /** Seguimiento para el cliente (solo viene en el detalle). */
  stages: ProjectStage[];
  tasks: ProjectTask[];
  links: ProjectLink[];
  updates: ProjectUpdate[];
}

export interface ProjectStage {
  id?: string;
  name: string;
  progress: number;
  startDate?: string;
  endDate?: string;
}

/** Cuánto del cronograma ve el cliente: nada, solo etapas, etapas + hitos, o todo. */
export type ScheduleVisibility = 'hidden' | 'stages' | 'milestones' | 'full';
export type TaskOwner = 'team' | 'client';

export interface ProjectTask {
  id: string;
  stageId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  owner: TaskOwner;
  isMilestone: boolean;
  visibleToClient: boolean;
  position: number;
}

export type ProjectLinkType = 'staging' | 'production' | 'design' | 'video' | 'other';

export interface ProjectLink {
  id: string;
  label: string;
  url: string;
  type: ProjectLinkType;
  username?: string;
  password?: string;
  updatedAt: string;
}

export interface ProjectUpdate {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

export type TicketStatus = 'open' | 'in_review' | 'resolved' | 'escalated' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TicketAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: 'owner' | 'client';
  content: string;
  createdAt: string;
  attachments?: TicketAttachment[];
}

export type ActivityKind = 'create' | 'update' | 'delete' | 'status' | 'assign' | 'comment' | 'access' | 'security';
export type ActivityEntity = 'company' | 'user' | 'project' | 'ticket' | 'invoice' | 'internal_request' | 'department';

export interface ActivityLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  /** Rol de quien actuó; vacío en intentos de acceso con usuarios inexistentes. */
  actorRole?: 'owner' | 'technician' | 'client';
  entityType: ActivityEntity;
  entityId: string;
  description: string;
  kind: ActivityKind;
  ip?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  recipientRole: 'owner' | 'client';
  recipientCompanyId?: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  description: string;
  category: 'bug' | 'feature' | 'support' | 'billing' | 'other';
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  /** Primera respuesta del equipo (o resolución): ahí se detiene el reloj del SLA. */
  firstResponseAt?: string;
  resolvedAt?: string;
  responseCount: number;
  responses: TicketResponse[];
  attachments?: TicketAttachment[];
  satisfactionRating?: number;
  satisfactionComment?: string;
  ratedAt?: string;
  /** Persona de la empresa que lo creó. */
  createdById?: string;
  createdByName?: string;
  /** Persona de 3TECH a cargo (administrador o técnico). */
  assignedTo?: StaffMember;
  /** Quién lo marcó como resuelto/cerrado. */
  resolvedByName?: string;
  /** Última respuesta (viene en la lista): indica de quién es el turno. */
  lastResponse?: { authorName: string; authorRole: 'owner' | 'client'; createdAt: string; content?: string };
}

// ───────────── Solicitudes internas entre departamentos ─────────────

export interface DepartmentMember { id: string; name: string; role: User['role'] }

export interface Department {
  id: string;
  name: string;
  /** Horas de primera respuesta que el departamento se compromete a dar. */
  slaHours: number;
  active: boolean;
  members: DepartmentMember[];
  /** Solicitudes recibidas que siguen abiertas. */
  openReceived: number;
}

export type InternalCategory = 'request' | 'incident' | 'question' | 'other';

export interface InternalAttachment { id: string; name: string; type: string; size: number; url: string }

export interface InternalResponse {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: User['role'];
  authorDepartmentId?: string;
  content: string;
  createdAt: string;
  attachments: InternalAttachment[];
}

export interface InternalRequest {
  id: string;
  /** Número corto: SI-{number}. */
  number: number;
  title: string;
  description: string;
  category: InternalCategory;
  status: TicketStatus;
  priority: TicketPriority;
  fromDepartment: { id: string; name: string; slaHours: number };
  toDepartment: { id: string; name: string; slaHours: number };
  createdById?: string;
  createdByName: string;
  assignedTo?: { id: string; name: string; role: User['role'] };
  slaDeadline: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  resolvedByName?: string;
  slaBreached: boolean;
  slaMet: boolean | null;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  lastResponse?: { authorName: string; authorDepartmentId?: string; createdAt: string; content: string };
  /** Solo en el detalle. */
  responses?: InternalResponse[];
  attachments?: InternalAttachment[];
}
