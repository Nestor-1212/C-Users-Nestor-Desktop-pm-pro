import { Project } from '../../core/models';

export type ScheduleTone = 'done' | 'ok' | 'risk' | 'late' | 'paused' | 'upcoming';
export interface ProjectSchedule { tone: ScheduleTone; label: string; detail: string }

const DAY = 24 * 60 * 60 * 1000;
/** 'YYYY-MM-DD' como medianoche local (new Date('YYYY-MM-DD') sería UTC y movería el día). */
export const localDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
const plural = (n: number) => (n === 1 ? 'día' : 'días');

type Dated = Pick<Project, 'startDate' | 'endDate'>;

/** Porcentaje que debería llevar el proyecto hoy si avanzara parejo entre inicio y entrega. */
export function expectedProgress(p: Dated): number | null {
  const start = localDate(p.startDate), end = localDate(p.endDate);
  const total = daysBetween(start, end);
  if (total <= 0) return null;
  const elapsed = Math.min(Math.max(daysBetween(start, today()), 0), total);
  return Math.round((elapsed / total) * 100);
}

/**
 * Salud del cronograma: compara el avance real con el esperado a la fecha.
 * Hasta 5 puntos por debajo es "a tiempo"; hasta 15, "en riesgo"; más, "atrasado".
 */
export function projectSchedule(p: Dated & Pick<Project, 'status' | 'progress'>): ProjectSchedule {
  const daysLeft = daysBetween(today(), localDate(p.endDate));
  const daysToStart = daysBetween(today(), localDate(p.startDate));
  if (p.status === 'completed' || p.progress >= 100) return { tone: 'done', label: 'Completado', detail: 'Proyecto entregado' };
  if (p.status === 'on_hold') return { tone: 'paused', label: 'En pausa', detail: 'El proyecto está detenido temporalmente' };
  if (daysToStart > 0) return { tone: 'upcoming', label: 'Por iniciar', detail: `Inicia en ${daysToStart} ${plural(daysToStart)}` };
  if (daysLeft < 0) return { tone: 'late', label: 'Atrasado', detail: `Entrega vencida hace ${-daysLeft} ${plural(-daysLeft)}` };
  const left = daysLeft === 0 ? 'La entrega es hoy' : `Faltan ${daysLeft} ${plural(daysLeft)}`;
  const gap = p.progress - (expectedProgress(p) ?? 0);
  if (gap >= -5) return { tone: 'ok', label: 'A tiempo', detail: left };
  if (gap >= -15) return { tone: 'risk', label: 'En riesgo', detail: left };
  return { tone: 'late', label: 'Atrasado', detail: left };
}
