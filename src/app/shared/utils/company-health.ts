import { Project, Ticket } from '../../core/models';
import { projectSchedule } from './project-health';

export type HealthLevel = 'good' | 'watch' | 'danger';

export interface CompanyHealth {
  score: number;
  level: HealthLevel;
  levelLabel: string;
  /** Motivos legibles de lo que baja el puntaje ("2 tickets vencidos · 1 en riesgo"). */
  reasons: string;
  breached: number;
  late: number;
  risk: number;
  csat: number | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Puntaje 0–100 de un cliente: parte de 100 y resta 15 por ticket con SLA
 * vencido, 20 por proyecto atrasado, 10 por proyecto en riesgo y 15 si la
 * satisfacción promedio es menor a 3.5. 80+ sano, 50–79 vigilar, <50 en riesgo.
 */
export function companyHealth(
  tickets: Ticket[],
  projects: Pick<Project, 'status' | 'progress' | 'startDate' | 'endDate'>[],
  isBreached: (t: Ticket) => boolean,
): CompanyHealth {
  const breached = tickets.filter(isBreached).length;
  const tones = projects.map(p => projectSchedule(p).tone);
  const late = tones.filter(t => t === 'late').length;
  const risk = tones.filter(t => t === 'risk').length;
  const rated = tickets.filter(t => typeof t.satisfactionRating === 'number');
  const csat = rated.length ? Math.round((rated.reduce((s, t) => s + t.satisfactionRating!, 0) / rated.length) * 10) / 10 : null;

  let score = 100 - breached * 15 - late * 20 - risk * 10;
  if (csat !== null && csat < 3.5) score -= 15;
  score = Math.max(0, Math.min(100, score));

  const reasons = [
    breached && plural(breached, 'ticket vencido', 'tickets vencidos'),
    late && plural(late, 'proyecto atrasado', 'proyectos atrasados'),
    risk && `${risk} en riesgo`,
    csat !== null && csat < 3.5 && `satisfacción ${csat}/5`,
  ].filter(Boolean).join(' · ');

  const level: HealthLevel = score >= 80 ? 'good' : score >= 50 ? 'watch' : 'danger';
  const levelLabel = level === 'good' ? 'Sana' : level === 'watch' ? 'Vigilar' : 'En riesgo';
  return { score, level, levelLabel, reasons, breached, late, risk, csat };
}
