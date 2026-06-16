import jsPDF from "jspdf";
import logoUrl from "@/assets/mesquita-logo.png";
import signatureUrl from "@/assets/mesquita-signature.png";
import { brl, brlExtenso, longPt, monthName } from "./finance";

export interface ReceiptData {
  tenantName: string;
  tenantCpf: string | null;
  amount: number;
  propertyName: string;
  propertyAddress: string | null;
  houseNumber: string | null;
  referenceMonth: number; // 1-12
  referenceYear: number;
  issueDate?: Date;
}

const FIXED = {
  pixPayer: "ILONEIDE MIRANDA DA SILVA",
  signerName: "Maria Eneide da Silva - LOCADORA",
  city: "Fortaleza",
};

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateReceiptPDF(d: ReceiptData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const [logo, signature] = await Promise.all([loadImage(logoUrl), loadImage(signatureUrl)]);

  // --- LOGO centered ---
  const logoW = 95;
  const logoH = (logo.height / logo.width) * logoW;
  doc.addImage(logo, "PNG", (pageW - logoW) / 2, 18, logoW, logoH);

  // --- TITLE ---
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("RECIBO DE PAGAMENTO", pageW / 2, 78, { align: "center" });

  // --- BODY ---
  doc.setFont("times", "normal");
  doc.setFontSize(13);

  const cpfTxt = d.tenantCpf ? `, CPF n° ${d.tenantCpf}` : "";
  const valor = brl(d.amount);
  const extenso = brlExtenso(d.amount);
  const mes = monthName(d.referenceMonth);
  const houseSuffix = d.houseNumber ? `, casa ${d.houseNumber}` : "";
  const address = d.propertyAddress
    ? `${d.propertyAddress}${houseSuffix}`
    : `${d.propertyName}${houseSuffix}`;

  // We need bold spans inline. Use array of segments rendered with splitTextToSize.
  // Simplest: render as a single justified paragraph using splitTextToSize + manual bold words
  // jsPDF doesn't support inline bold easily — fallback: render whole paragraph normal,
  // then overlay bold strings at correct positions is complex. We'll write the paragraph
  // in normal weight but with the key words wrapped in **...** style is not supported.
  // Approach: emit the text in 3 chunks per line using bold for the highlighted parts.

  const margin = 22;
  const maxW = pageW - margin * 2;
  const lineH = 7.5;
  let y = 100;

  // Build a token stream of { text, bold }
  const tokens: { text: string; bold: boolean }[] = [
    { text: "Recebi de ", bold: false },
    { text: d.tenantName.toUpperCase(), bold: true },
    { text: `, brasileiro(a)${cpfTxt}, o valor de `, bold: false },
    { text: `${valor} (${extenso})`, bold: true },
    { text: ` via pix por ${FIXED.pixPayer}, valor este referente ao aluguel do mês de ${mes}, do imóvel localizado na ${address}`, bold: false },
  ];

  // Word-by-word layout preserving bold
  type Word = { text: string; bold: boolean; w: number };
  const words: Word[] = [];
  tokens.forEach(tk => {
    const parts = tk.text.split(/(\s+)/); // keep spaces
    parts.forEach(p => {
      if (!p) return;
      doc.setFont("times", tk.bold ? "bold" : "normal");
      const w = doc.getTextWidth(p);
      words.push({ text: p, bold: tk.bold, w });
    });
  });

  let line: Word[] = [];
  let lineW = 0;
  const flushLine = (isLast: boolean) => {
    // Render line left-aligned (the original looks left-aligned with natural wrap)
    let x = margin;
    line.forEach(w => {
      doc.setFont("times", w.bold ? "bold" : "normal");
      doc.text(w.text, x, y);
      x += w.w;
    });
    y += lineH;
    line = [];
    lineW = 0;
  };
  for (const w of words) {
    if (lineW + w.w > maxW && line.length > 0) {
      // trim trailing whitespace from line before flush
      while (line.length && /^\s+$/.test(line[line.length - 1].text)) {
        lineW -= line[line.length - 1].w;
        line.pop();
      }
      flushLine(false);
      if (/^\s+$/.test(w.text)) continue; // skip leading space
    }
    line.push(w);
    lineW += w.w;
  }
  if (line.length) flushLine(true);

  // --- Date ---
  y += 22;
  const issue = d.issueDate ?? new Date();
  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.text(`${FIXED.city} ${longPt(issue)}`, pageW / 2, y, { align: "center" });

  // --- Signature (sits ON TOP of the line, centered) ---
  y += 30;
  const sigW = 55;
  const sigH = (signature.height / signature.width) * sigW;
  const lineY = y;
  // place signature so its bottom rests on the line
  doc.addImage(signature, "PNG", (pageW - sigW) / 2, lineY - sigH, sigW, sigH);
  doc.setDrawColor(30);
  doc.line(pageW / 2 - 60, lineY, pageW / 2 + 60, lineY);
  doc.text(FIXED.signerName, pageW / 2, lineY + 7, { align: "center" });

  return doc.output("blob");
}

export async function downloadReceipt(d: ReceiptData, filename: string) {
  const blob = await generateReceiptPDF(d);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
