import jsPDF from "jspdf";
import logoUrl from "@/assets/mesquita-logo.png";
import { brl, formatDateBR } from "./finance";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface MonthlyReportData {
  year: number;
  month: number;
  previsto: number;
  recebido: number;
  falta: number;
  despesas: number;
  lucro: number;
  paidCount: number;
  totalCount: number;
  overdue: any[];
  pending: any[];
  expenses: any[];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateMonthlyReportPDF(d: MonthlyReportData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  let y = 16;

  try {
    const logo = await loadImage(logoUrl);
    const w = 28;
    const h = (logo.height / logo.width) * w;
    doc.addImage(logo, "PNG", (pageW - w) / 2, y, w, h);
    y += h + 6;
  } catch {
    y += 4;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Relatório Mensal", pageW / 2, y, { align: "center" });
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${MONTHS[d.month - 1]} de ${d.year}`, pageW / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(200);
  doc.line(M, y, pageW - M, y);
  y += 9;

  // ---- Resumo ----
  const boxW = (pageW - M * 2 - 6) / 2;
  const box = (label: string, value: string, x: number, yy: number, color: [number, number, number]) => {
    doc.setFillColor(246, 246, 248);
    doc.roundedRect(x, yy, boxW, 17, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(label.toUpperCase(), x + 4, yy + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(value, x + 4, yy + 13);
    doc.setTextColor(0);
  };

  box("Recebido no mês", brl(d.recebido), M, y, [22, 120, 60]);
  box("Previsto", brl(d.previsto), M + boxW + 6, y, [40, 40, 40]);
  y += 21;
  box("Em aberto / atraso", brl(d.falta), M, y, [180, 40, 40]);
  box("Despesas", brl(d.despesas), M + boxW + 6, y, [150, 90, 20]);
  y += 21;
  box("Resultado do mês", brl(d.lucro), M, y, d.lucro >= 0 ? [22, 120, 60] : [180, 40, 40]);
  box("Aluguéis pagos", `${d.paidCount} de ${d.totalCount}`, M + boxW + 6, y, [40, 40, 40]);
  y += 26;

  const section = (title: string) => {
    if (y > pageH - 40) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, M, y);
    y += 2;
    doc.setDrawColor(220);
    doc.line(M, y, pageW - M, y);
    y += 6;
  };

  const line = (a: string, b: string, c: string) => {
    if (y > pageH - 20) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(a.slice(0, 42), M, y);
    doc.text(b, pageW - M - 42, y);
    doc.text(c, pageW - M, y, { align: "right" });
    y += 5.5;
  };

  section("Aluguéis em atraso");
  if (d.overdue.length === 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "italic");
    doc.text("Nenhum atraso neste mês.", M, y);
    y += 8;
  } else {
    d.overdue.forEach((p: any) => line(p.tenants?.name ?? "—", formatDateBR(p.due_date), brl(p.amount)));
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Total em atraso", M, y);
    doc.text(brl(d.overdue.reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0)), pageW - M, y, { align: "right" });
    y += 10;
  }

  section("A receber ainda neste mês");
  if (d.pending.length === 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "italic");
    doc.text("Nada pendente.", M, y);
    y += 8;
  } else {
    d.pending.forEach((p: any) => line(p.tenants?.name ?? "—", formatDateBR(p.due_date), brl(p.amount)));
    y += 6;
  }

  section("Despesas do mês");
  if (d.expenses.length === 0) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "italic");
    doc.text("Nenhuma despesa lançada.", M, y);
    y += 8;
  } else {
    d.expenses.forEach((e: any) => line(e.description ?? "—", formatDateBR(e.expense_date), brl(e.amount)));
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Mesquita Imóveis — gerado em ${new Date().toLocaleDateString("pt-BR")}   •   página ${i}/${pages}`,
      pageW / 2, pageH - 10, { align: "center" }
    );
  }

  return doc.output("blob");
}

export async function downloadMonthlyReport(d: MonthlyReportData, filename?: string) {
  const blob = await generateMonthlyReportPDF(d);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `relatorio_${String(d.month).padStart(2, "0")}_${d.year}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
