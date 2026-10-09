/**
 * Fuente unica de verdad para los colores de estado de proyectos y tickets.
 *
 * Antes, el dashboard usaba una paleta propia para las barras de "Proyectos
 * por Estado" (p.ej. morado para "planning") que no coincidia con los colores
 * de los `.status-badge` usados en el resto de la app (indigo para
 * "planning"). Cualquier elemento que necesite representar un estado con
 * color (dots, barras, graficos) debe leer de aqui para garantizar que
 * siempre coincide con el badge correspondiente.
 */
export const PROJECT_STATUS_COLORS: Record<string, string> = {
  planning: '#4338ca',
  in_progress: '#1d4ed8',
  review: '#d97706',
  completed: '#16a34a',
  on_hold: '#64748b',
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  open: '#d97706',
  in_review: '#1d4ed8',
  resolved: '#16a34a',
  escalated: '#dc2626',
  closed: '#64748b',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: '#16a34a',
  medium: '#d97706',
  high: '#ea580c',
  critical: '#dc2626',
};

export function projectStatusColor(status: string): string {
  return PROJECT_STATUS_COLORS[status] ?? '#64748b';
}

export function ticketStatusColor(status: string): string {
  return TICKET_STATUS_COLORS[status] ?? '#64748b';
}

export function priorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? '#64748b';
}
