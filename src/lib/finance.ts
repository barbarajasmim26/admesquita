import extenso from "extenso";

export function brl(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export function brlExtenso(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  const safe = Math.max(0, Math.round((v || 0) * 100) / 100);
  try {
    const txt = extenso(safe.toFixed(2).replace(".", ","), { mode: "currency" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch {
    return "";
  }
}

export function formatDateBR(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T12:00:00" : "")) : d;
  return date.toLocaleDateString("pt-BR");
}

export function daysLate(dueDate: string, ref: Date = new Date()): number {
  const due = new Date(dueDate + "T12:00:00");
  const diff = Math.floor((ref.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function calcLateFee(
  amount: number,
  dueDate: string,
  paidDate: string | Date,
  lateFeePercent = 0,
  interestPercent = 0,
) {
  const paid = typeof paidDate === "string" ? new Date(paidDate + "T12:00:00") : paidDate;
  const days = daysLate(dueDate, paid);
  if (days <= 0) return { multa: 0, juros: 0, total: amount };
  const multa = (amount * lateFeePercent) / 100;
  const juros = (amount * interestPercent * days) / 100 / 30;
  return { multa, juros, total: amount + multa + juros };
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const monthName = (m: number) => MESES[m - 1] ?? "";
export const todayLongPt = () => {
  const d = new Date();
  return `${d.getDate()} de ${monthName(d.getMonth() + 1)} de ${d.getFullYear()}`;
};
export const longPt = (d: Date) => `${d.getDate()} de ${monthName(d.getMonth() + 1)} de ${d.getFullYear()}`;
