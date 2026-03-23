export interface User {
  id: string;
  username: string;
  password: string;
  role: 'owner' | 'client';
  companyId?: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  plan?: string;
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
  data?: string; // base64 para descarga real
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
  comments: ProjectComment[];
  requirements: ProjectRequirement[];
  documents: ProjectDocument[];
}

export type TicketStatus = 'open' | 'in_review' | 'resolved' | 'escalated' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TicketResponse {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorRole: 'owner' | 'client';
  content: string;
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
  responses: TicketResponse[];
}
