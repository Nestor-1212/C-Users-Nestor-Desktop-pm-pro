import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

export function exportToExcel<T>(filename: string, columns: ExportColumn<T>[], rows: T[]): void {
  const data = rows.map(row => {
    const obj: Record<string, string | number> = {};
    for (const col of columns) obj[col.header] = col.value(row);
    return obj;
  });
  const sheet = XLSX.utils.json_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Reporte');
  XLSX.writeFile(book, `${filename}.xlsx`);
}

export function exportToPdf<T>(title: string, filename: string, columns: ExportColumn<T>[], rows: T[]): void {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado el ${new Date().toLocaleString('es-GT')} · ${rows.length} registro(s)`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => String(c.value(row)))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 75, 146], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 248, 253] }
  });

  doc.save(`${filename}.pdf`);
}
