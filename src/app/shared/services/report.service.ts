import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { AuthService } from '../../core/services/auth.service';

export type ReportFormat = 'excel' | 'pdf';
/** Color semántico de una celda: verde bien, naranja atención, rojo mal, azul informativo, gris neutro. */
export type ReportTone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export interface ReportColumn<T> {
  header: string;
  value: (row: T) => string | number;
  /** Ancho relativo (1 = normal). Las columnas de texto largo conviene ponerlas en 2–3. */
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** Si devuelve un tono, la celda se pinta como etiqueta de color. */
  tone?: (row: T) => ReportTone | null;
}

export interface ReportSummaryItem { label: string; value: string | number; tone?: ReportTone }

export interface Report<T> {
  title: string;
  /** Contexto del reporte: filtros aplicados, periodo, proyecto… */
  subtitle?: string;
  filename: string;
  columns: ReportColumn<T>[];
  rows: T[];
  /** Cifras clave que se muestran antes de la tabla. */
  summary?: ReportSummaryItem[];
}

const NAVY: [number, number, number] = [15, 75, 146];
const GREEN: [number, number, number] = [169, 194, 56];
const ORANGE: [number, number, number] = [233, 157, 52];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];

/** Fondo y texto de cada tono (mismos colores que la app). */
const TONES: Record<ReportTone, { bg: [number, number, number]; fg: [number, number, number]; hexBg: string; hexFg: string }> = {
  ok: { bg: [242, 247, 225], fg: [91, 107, 18], hexBg: 'F2F7E1', hexFg: '5B6B12' },
  warn: { bg: [253, 243, 230], fg: [168, 98, 10], hexBg: 'FDF3E6', hexFg: 'A8620A' },
  bad: { bg: [254, 226, 226], fg: [220, 38, 38], hexBg: 'FEE2E2', hexFg: 'DC2626' },
  info: { bg: [238, 244, 252], fg: [15, 75, 146], hexBg: 'EEF4FC', hexFg: '0F4B92' },
  muted: { bg: [241, 245, 249], fg: [71, 85, 105], hexBg: 'F1F5F9', hexFg: '475569' },
};

/** Nombre de archivo con fecha: "tickets_2026-10-12". */
const stampName = (base: string) => `${base}_${new Date().toISOString().slice(0, 10)}`;

/**
 * Reportes exportables con la identidad de 3TECH: encabezado con logo, título,
 * contexto, resumen de cifras, tabla con colores por estado y pie con páginas.
 * El mismo reporte sirve para PDF y Excel.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private auth = inject(AuthService);
  private logo?: Promise<string | null>;

  async export<T>(format: ReportFormat, report: Report<T>): Promise<void> {
    if (format === 'excel') this.excel(report);
    else await this.pdf(report);
  }

  private generatedLine(count: number): string {
    const when = new Date().toLocaleString('es-GT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const who = this.auth.currentUser()?.name;
    return `Generado el ${when}${who ? ` por ${who}` : ''} · ${count} registro${count === 1 ? '' : 's'}`;
  }

  /** El logo se carga una sola vez y se reutiliza en todos los PDF. */
  private loadLogo(): Promise<string | null> {
    this.logo ??= fetch('/brand/logo-3tech.png')
      .then(r => (r.ok ? r.blob() : null))
      .then(blob => blob && new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }))
      .catch(() => null);
    return this.logo;
  }

  // ───────────────────────── PDF ─────────────────────────

  private async pdf<T>(report: Report<T>): Promise<void> {
    const landscape = report.columns.length > 6;
    const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 14;
    const logo = await this.loadLogo();

    // Encabezado: logo, título y contexto; franja de marca debajo.
    let y = 14;
    if (logo) doc.addImage(logo, 'PNG', M, y - 2, 28, 28 * (512 / 1204));
    const textX = logo ? M + 34 : M;
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...INK).text(report.title, textX, y + 4);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
    if (report.subtitle) doc.text(doc.splitTextToSize(report.subtitle, W - textX - M), textX, y + 10);
    doc.text(this.generatedLine(report.rows.length), W - M, y - 4, { align: 'right' });
    y += report.subtitle ? 18 : 14;
    const third = (W - 2 * M) / 3;
    doc.setFillColor(...NAVY).rect(M, y, third, 1.2, 'F');
    doc.setFillColor(...GREEN).rect(M + third, y, third, 1.2, 'F');
    doc.setFillColor(...ORANGE).rect(M + 2 * third, y, third, 1.2, 'F');
    y += 6;

    // Resumen: tarjetas con las cifras clave.
    if (report.summary?.length) {
      const gap = 4;
      const n = report.summary.length;
      const w = (W - 2 * M - gap * (n - 1)) / n;
      report.summary.forEach((s, i) => {
        const x = M + i * (w + gap);
        const tone = s.tone ? TONES[s.tone] : null;
        doc.setFillColor(...(tone?.bg ?? [248, 250, 252])).setDrawColor(...LINE).roundedRect(x, y, w, 16, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...(tone?.fg ?? INK)).text(String(s.value), x + 4, y + 7.5);
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED).text(s.label, x + 4, y + 12.5);
      });
      y += 22;
    }

    // Tabla
    const totalWeight = report.columns.reduce((a, c) => a + (c.width ?? 1), 0);
    const usable = W - 2 * M;
    const columnStyles: Record<number, object> = {};
    report.columns.forEach((c, i) => {
      columnStyles[i] = { cellWidth: (usable * (c.width ?? 1)) / totalWeight, halign: c.align ?? 'left' };
    });
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 14, bottom: 16 },
      head: [report.columns.map(c => c.header)],
      body: report.rows.map(r => report.columns.map(c => String(c.value(r) ?? ''))),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      // Celdas con tono: texto en negrita sobre fondo de color, como las etiquetas de la app.
      didParseCell: data => {
        if (data.section !== 'body') return;
        const col = report.columns[data.column.index];
        const tone = col.tone?.(report.rows[data.row.index]);
        if (!tone) return;
        data.cell.styles.fillColor = TONES[tone].bg;
        data.cell.styles.textColor = TONES[tone].fg;
        data.cell.styles.fontStyle = 'bold';
      },
    });

    // Pie en cada página
    const pages = doc.getNumberOfPages();
    const H = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setDrawColor(...LINE).setLineWidth(0.2).line(M, H - 10, W - M, H - 10);
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
      doc.text('Tikets y Proceso · 3TECH', M, H - 6);
      doc.text(`Página ${i} de ${pages}`, W - M, H - 6, { align: 'right' });
    }
    doc.save(`${stampName(report.filename)}.pdf`);
  }

  // ───────────────────────── Excel ─────────────────────────

  private excel<T>(report: Report<T>): void {
    const cols = report.columns;
    const border = { style: 'thin', color: { rgb: 'E2E8F0' } };
    const borders = { top: border, bottom: border, left: border, right: border };
    const aoa: (string | number)[][] = [];
    const styles: Record<string, object> = {};
    const put = (r: number, c: number, style: object) => { styles[XLSX.utils.encode_cell({ r, c })] = style; };

    // Título y contexto
    aoa.push([report.title]);
    put(0, 0, { font: { bold: true, sz: 16, color: { rgb: '0F4B92' } } });
    if (report.subtitle) { aoa.push([report.subtitle]); put(aoa.length - 1, 0, { font: { sz: 10, color: { rgb: '475569' } } }); }
    aoa.push([this.generatedLine(report.rows.length)]);
    put(aoa.length - 1, 0, { font: { sz: 9, italic: true, color: { rgb: '64748B' } } });
    aoa.push([]);

    // Resumen en fila: etiqueta arriba, cifra abajo
    if (report.summary?.length) {
      const labelRow = aoa.length;
      aoa.push(report.summary.map(s => s.label));
      aoa.push(report.summary.map(s => s.value));
      report.summary.forEach((s, i) => {
        const t = s.tone ? TONES[s.tone] : null;
        put(labelRow, i, { font: { sz: 9, color: { rgb: '64748B' } }, fill: { fgColor: { rgb: t?.hexBg ?? 'F8FAFC' } }, border: borders });
        put(labelRow + 1, i, { font: { bold: true, sz: 14, color: { rgb: t?.hexFg ?? '0F172A' } }, fill: { fgColor: { rgb: t?.hexBg ?? 'F8FAFC' } }, border: borders, alignment: { horizontal: 'left' } });
      });
      aoa.push([]);
    }

    // Tabla
    const headerRow = aoa.length;
    aoa.push(cols.map(c => c.header));
    cols.forEach((_, i) => put(headerRow, i, {
      font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F4B92' } },
      alignment: { vertical: 'center', horizontal: cols[i].align ?? 'left', wrapText: true }, border: borders,
    }));
    report.rows.forEach((row, ri) => {
      const r = aoa.length;
      aoa.push(cols.map(c => c.value(row)));
      cols.forEach((c, ci) => {
        const tone = c.tone?.(row);
        const t = tone ? TONES[tone] : null;
        put(r, ci, {
          font: { bold: !!t, color: { rgb: t?.hexFg ?? '0F172A' } },
          fill: { fgColor: { rgb: t?.hexBg ?? (ri % 2 ? 'F8FAFC' : 'FFFFFF') } },
          alignment: { vertical: 'top', horizontal: c.align ?? 'left', wrapText: true }, border: borders,
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (const [ref, s] of Object.entries(styles)) if (ws[ref]) (ws[ref] as { s?: object }).s = s;
    // Anchos según el contenido (con tope) y filtro automático sobre la tabla.
    ws['!cols'] = cols.map((c, i) => {
      const longest = Math.max(c.header.length, ...report.rows.slice(0, 300).map(r => String(c.value(r) ?? '').length));
      return { wch: Math.min(Math.max(longest + 2, 10), (c.width ?? 1) >= 2 ? 60 : 32) };
    });
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + report.rows.length, c: cols.length - 1 } }) };
    ws['!rows'] = aoa.map((_, i) => (i === 0 ? { hpt: 26 } : i === headerRow ? { hpt: 22 } : {}));

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, ws, 'Reporte');
    XLSX.writeFile(book, `${stampName(report.filename)}.xlsx`);
  }
}
