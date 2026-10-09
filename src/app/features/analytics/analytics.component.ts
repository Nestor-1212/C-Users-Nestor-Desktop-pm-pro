import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../../core/services/ticket.service';
import { InvoiceService } from '../../core/services/invoice.service';
import { NotificationService } from '../../shared/services/notification.service';
import { loadPageData } from '../../core/http/api-error';
import { StatCardComponent } from '../../shared/stat-card/stat-card.component';
import { CATEGORY_LABELS } from '../../shared/pipes/labels.pipe';

interface BarPoint { label: string; value: number; pct: number; }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, StatCardComponent],
  template: `
    <div class="analytics-page">
      <div class="page-header">
        <div>
          <h1>Analíticas</h1>
          <p>Tendencias y métricas del sistema a lo largo del tiempo</p>
        </div>
      </div>

      <div class="quick-stats">
        <app-stat-card [value]="avgResolutionHours() !== null ? (avgResolutionHours() + 'h') : 'Sin datos'" label="Resolución Promedio" icon="clock" color="blue" />
        <app-stat-card [value]="slaComplianceRate() !== null ? (slaComplianceRate() + '%') : 'Sin datos'" label="SLA Cumplido" icon="check" color="green" />
        <app-stat-card [value]="avgSatisfaction() !== null ? (avgSatisfaction() + '/5') : 'Sin datos'" label="Satisfacción Promedio" icon="star" color="yellow" />
        <app-stat-card [value]="'Q' + totalRevenue().toLocaleString('es-GT')" label="Facturado (6 meses)" icon="dollar-sign" color="indigo" />
      </div>

      <div class="charts-grid">
        <div class="card">
          <div class="card-header"><h3>Tickets Creados (últimas 8 semanas)</h3></div>
          <div class="bar-chart">
            @for (b of weeklyVolume(); track b.label) {
              <div class="bar-col" [title]="b.value + ' tickets'">
                <span class="bar-count">{{ b.value }}</span>
                <div class="bar-track"><div class="bar primary" [style.height.%]="b.pct"></div></div>
                <span class="bar-label">{{ b.label }}</span>
              </div>
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Satisfacción por Semana</h3></div>
          <div class="bar-chart">
            @for (b of weeklySatisfaction(); track b.label) {
              <div class="bar-col" [title]="b.value ? b.value + '/5' : 'Sin calificaciones'">
                <span class="bar-count">{{ b.value || '—' }}</span>
                <div class="bar-track"><div class="bar amber" [style.height.%]="b.pct"></div></div>
                <span class="bar-label">{{ b.label }}</span>
              </div>
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Tickets por Categoría</h3></div>
          <div class="hbar-list">
            @for (c of ticketsByCategory(); track c.label) {
              <div class="hbar-row">
                <span class="hbar-label">{{ c.label }}</span>
                <div class="hbar-track"><div class="hbar-fill" [style.width.%]="c.pct"></div></div>
                <span class="hbar-value">{{ c.value }}</span>
              </div>
            } @empty {
              <p class="chart-empty">Sin tickets todavía.</p>
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Facturación Cobrada (últimos 6 meses)</h3></div>
          <div class="bar-chart">
            @for (b of monthlyRevenue(); track b.label) {
              <div class="bar-col" [title]="'Q' + b.value.toLocaleString('es-GT')">
                <span class="bar-count">Q{{ b.value | number:'1.0-0' }}</span>
                <div class="bar-track"><div class="bar green" [style.height.%]="b.pct"></div></div>
                <span class="bar-label">{{ b.label }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-page { max-width: 1100px; margin: 0 auto; }
    .quick-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 20px; }

    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); border: 1px solid #f1f5f9; }
    .card-header { margin-bottom: 18px; }
    .card-header h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 0; }

    .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 170px; }
    .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; min-width: 0; }
    .bar-count { font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .bar-track { flex: 1; width: 100%; max-width: 30px; display: flex; align-items: flex-end; }
    .bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.4s ease; }
    .bar.primary { background: var(--gradient-primary, linear-gradient(180deg, #1465c5, #0f4b92)); }
    .bar.amber { background: #f59e0b; }
    .bar.green { background: var(--color-success-text, #16a34a); }
    .bar-label { font-size: 10px; color: #94a3b8; margin-top: 6px; white-space: nowrap; }

    .hbar-list { display: flex; flex-direction: column; gap: 12px; }
    .hbar-row { display: flex; align-items: center; gap: 10px; }
    .hbar-label { font-size: 12.5px; color: #475569; width: 90px; flex-shrink: 0; }
    .hbar-track { flex: 1; height: 10px; background: var(--color-neutral-bg, #f1f5f9); border-radius: 10px; overflow: hidden; }
    .hbar-fill { height: 100%; background: var(--gradient-primary, linear-gradient(90deg, #0f4b92, #1465c5)); border-radius: 10px; transition: width 0.4s ease; }
    .hbar-value { font-size: 12.5px; font-weight: 700; color: #0f172a; width: 24px; text-align: right; flex-shrink: 0; }
    .chart-empty { font-size: 13px; color: #94a3b8; text-align: center; padding: 20px 0; margin: 0; }

    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
  `]
})
export class AnalyticsComponent {
  private ticketService = inject(TicketService);
  private invoiceService = inject(InvoiceService);
  private notify = inject(NotificationService);

  constructor() {
    loadPageData(this.notify, this.ticketService.load(), this.invoiceService.load());
  }

  private lastNWeeks(n: number): { start: Date; end: Date; label: string }[] {
    const weeks: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();
    const day = now.getDay() || 7;
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(now.getDate() - day + 1);
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(thisMonday);
      start.setDate(thisMonday.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      weeks.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` });
    }
    return weeks;
  }

  private lastNMonths(n: number): { start: Date; end: Date; label: string }[] {
    const months: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();
    const names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({ start, end, label: names[start.getMonth()] });
    }
    return months;
  }

  weeklyVolume = computed<BarPoint[]>(() => {
    const tickets = this.ticketService.getAll();
    const weeks = this.lastNWeeks(8);
    const counts = weeks.map(w => tickets.filter(t => {
      const d = new Date(t.createdAt);
      return d >= w.start && d < w.end;
    }).length);
    const max = Math.max(1, ...counts);
    return weeks.map((w, i) => ({ label: w.label, value: counts[i], pct: (counts[i] / max) * 100 }));
  });

  weeklySatisfaction = computed<BarPoint[]>(() => {
    const tickets = this.ticketService.getAll().filter(t => typeof t.satisfactionRating === 'number' && t.ratedAt);
    const weeks = this.lastNWeeks(8);
    const avgs = weeks.map(w => {
      const inWeek = tickets.filter(t => {
        const d = new Date(t.ratedAt!);
        return d >= w.start && d < w.end;
      });
      if (!inWeek.length) return 0;
      return Math.round((inWeek.reduce((s, t) => s + t.satisfactionRating!, 0) / inWeek.length) * 10) / 10;
    });
    return weeks.map((w, i) => ({ label: w.label, value: avgs[i], pct: (avgs[i] / 5) * 100 }));
  });

  monthlyRevenue = computed<BarPoint[]>(() => {
    const invoices = this.invoiceService.getAll().filter(i => i.status === 'paid' && i.paidAt);
    const months = this.lastNMonths(6);
    const totals = months.map(m => invoices.filter(i => {
      const d = new Date(i.paidAt!);
      return d >= m.start && d < m.end;
    }).reduce((s, i) => s + i.amount, 0));
    const max = Math.max(1, ...totals);
    return months.map((m, i) => ({ label: m.label, value: totals[i], pct: (totals[i] / max) * 100 }));
  });

  ticketsByCategory = computed(() => {
    const tickets = this.ticketService.getAll();
    const counts: Record<string, number> = {};
    for (const t of tickets) counts[t.category] = (counts[t.category] || 0) + 1;
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([category, value]) => ({ label: CATEGORY_LABELS[category] ?? category, value, pct: (value / max) * 100 }))
      .sort((a, b) => b.value - a.value);
  });

  avgResolutionHours = computed<number | null>(() => {
    const resolved = this.ticketService.getAll().filter(t => t.resolvedAt);
    if (!resolved.length) return null;
    const totalHours = resolved.reduce((sum, t) => sum + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60), 0);
    return Math.round((totalHours / resolved.length) * 10) / 10;
  });

  slaComplianceRate = computed<number | null>(() => {
    const resolved = this.ticketService.getAll().filter(t => t.status === 'resolved' || t.status === 'closed');
    if (!resolved.length) return null;
    const onTime = resolved.filter(t => !t.resolvedAt || new Date(t.resolvedAt) <= new Date(t.slaDeadline)).length;
    return Math.round((onTime / resolved.length) * 100);
  });

  avgSatisfaction = computed(() => this.ticketService.getAverageSatisfaction());

  totalRevenue = computed(() => this.monthlyRevenue().reduce((sum, m) => sum + m.value, 0));
}
