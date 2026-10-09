import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipes de etiquetas centralizadas.
 *
 * Antes, cada pantalla (dashboard, projects, project-detail, tickets,
 * ticket-detail) definia su propia funcion `statusLabel()`, `priorityLabel()`,
 * etc. con el mismo contenido copiado y pegado. Centralizarlo aqui evita que
 * una pantalla quede desincronizada si el texto cambia en el futuro.
 */

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planning: 'Planificación',
  in_progress: 'En Progreso',
  review: 'Revisión',
  completed: 'Completado',
  on_hold: 'En Espera',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  in_review: 'En Revisión',
  resolved: 'Resuelto',
  escalated: 'Escalado',
  closed: 'Cerrado',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Funcionalidad',
  support: 'Soporte',
  billing: 'Facturación',
  other: 'Otro',
};

const REQUIREMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

@Pipe({ name: 'projectStatusLabel', standalone: true })
export class ProjectStatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return PROJECT_STATUS_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'ticketStatusLabel', standalone: true })
export class TicketStatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return TICKET_STATUS_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'priorityLabel', standalone: true })
export class PriorityLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, withPrefix = false): string {
    if (!value) return '';
    const label = PRIORITY_LABELS[value] ?? value;
    return withPrefix ? `Prioridad ${label}` : label;
  }
}

@Pipe({ name: 'categoryLabel', standalone: true })
export class CategoryLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return CATEGORY_LABELS[value] ?? value;
  }
}

@Pipe({ name: 'reqStatusLabel', standalone: true })
export class RequirementStatusLabelPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return REQUIREMENT_STATUS_LABELS[value] ?? value;
  }
}
