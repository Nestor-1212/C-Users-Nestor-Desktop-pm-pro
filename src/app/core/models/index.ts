export interface User {
  id: string;
  username: string;
  role: 'owner' | 'client';
  companyId?: string;
  name: string;
  email: string;
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
  budget?: number;
  internalNotes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  /** Contadores: la lista de la API no trae los arreglos completos (solo el detalle). */
  commentCount: number;
  requirementCount: number;
  documentCount: number;
  comments: ProjectComment[];
  requirements: ProjectRequirement[];
  documents: ProjectDocument[];
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

export interface ActivityLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  entityType: 'company' | 'user' | 'project' | 'ticket' | 'invoice';
  entityId: string;
  description: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  companyName: string;
  concept: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'pending' | 'paid';
  /** Calculado por el servidor con la zona horaria del negocio. */
  overdue: boolean;
  paidAt?: string;
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
  resolvedAt?: string;
  responseCount: number;
  responses: TicketResponse[];
  attachments?: TicketAttachment[];
  satisfactionRating?: number;
  satisfactionComment?: string;
  ratedAt?: string;
}
