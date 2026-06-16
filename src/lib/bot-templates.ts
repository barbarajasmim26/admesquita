import { brl } from "./finance";

const monthName = (m: number) => [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
][m - 1];

export function chargeMessage(o: { name: string; amount: number; year: number; month: number; pix?: string | null; dueDay?: number | null }) {
  const greeting = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";
  return `${greeting}, ${o.name}! Tudo bem?\n\nPassando para lembrar do aluguel referente a ${monthName(o.month)}/${o.year}${o.dueDay ? ` (vencimento dia ${o.dueDay})` : ""}, no valor de ${brl(o.amount)}.\n${o.pix ? `\nChave PIX: ${o.pix}\n` : ""}\nAssim que efetuar, me envia o comprovante por favor. Qualquer dúvida, estou à disposição.\n\nObrigada!`;
}

export function overdueMessage(o: { name: string; amount: number; daysLate: number; pix?: string | null }) {
  return `Olá, ${o.name}. Tudo bem?\n\nO aluguel de ${brl(o.amount)} está com ${o.daysLate} dia(s) de atraso. Pode me dar uma previsão de pagamento?\n${o.pix ? `\nChave PIX: ${o.pix}\n` : ""}\nFico no aguardo, obrigada.`;
}

export function receiptMessage(o: { name: string; amount: number; year: number; month: number; receiptNumber?: string | null }) {
  return `Olá, ${o.name}! Segue em anexo o recibo${o.receiptNumber ? ` nº ${o.receiptNumber}` : ""} referente ao aluguel de ${monthName(o.month)}/${o.year} no valor de ${brl(o.amount)}.\n\nObrigada pelo pagamento!`;
}

export function contractEndingMessage(o: { name: string; endDate: string }) {
  const d = new Date(o.endDate + "T12:00:00");
  return `Olá, ${o.name}. Tudo bem?\n\nGostaria de conversar sobre o nosso contrato, que vence em ${d.toLocaleDateString("pt-BR")}. Você tem interesse em renovar?\n\nAguardo seu retorno, obrigada.`;
}

export function readjustmentMessage(o: { name: string; oldAmount: number; newAmount: number; indexName: string }) {
  return `Olá, ${o.name}! Tudo bem?\n\nConforme nosso contrato, no mês de aniversário do contrato o aluguel é reajustado pelo índice ${o.indexName}. O valor mensal passará de ${brl(o.oldAmount)} para ${brl(o.newAmount)}.\n\nQualquer dúvida estou à disposição. Obrigada!`;
}

export function waLink(phone: string | null | undefined, message: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}