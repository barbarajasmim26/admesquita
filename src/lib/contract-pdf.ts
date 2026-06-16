import jsPDF from "jspdf";
import { brl, brlExtenso, longPt } from "./finance";

export interface ContractData {
  // Locador (fixo — proprietária)
  locadorName?: string;
  locadorNationality?: string;
  locadorMaritalStatus?: string;
  locadorProfession?: string;
  locadorRg?: string;
  locadorCpf?: string;
  locadorAddress?: string;

  // Locatário
  tenantName: string;
  tenantNationality?: string;
  tenantMaritalStatus?: string;
  tenantProfession?: string;
  tenantRg?: string;
  tenantCpf?: string;
  tenantAddress?: string;

  // Imóvel
  propertyAddress: string;

  // Contrato
  durationYears?: number;
  minStayYears?: number;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  depositAmount: number;
  dueDay: number;
  readjustmentIndex?: string;
  lateFeePercent?: number;
  interestPercent?: number;
  forumCity?: string;
  signDate?: Date;
}

const DEFAULTS = {
  locadorName: "MARIA ENEIDE DA SILVA",
  locadorNationality: "brasileira",
  locadorMaritalStatus: "união estável",
  locadorProfession: "comerciante",
  locadorRg: "2000002120969 SSP/CE",
  locadorCpf: "322.633.763-72",
  locadorAddress: "Avenida Nova Fortaleza, 1391, Planalto Ayrton Senna, Fortaleza/CE, CEP: 61.930-350",
  readjustmentIndex: "IGP-M",
  forumCity: "Cascavel",
  lateFeePercent: 10,
  interestPercent: 1,
  durationYears: 3,
  minStayYears: 1,
};

function numToWordsYears(n: number): string {
  const map: Record<number, string> = { 1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco" };
  return map[n] ?? String(n);
}

export async function generateContractPDF(d: ContractData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  const maxW = pageW - margin * 2;
  let y = 22;

  const c = { ...DEFAULTS, ...d };

  doc.setFont("times", "normal");
  doc.setFontSize(11);

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 22) {
      doc.addPage();
      y = 22;
    }
  };

  const writeTokens = (tokens: { text: string; bold?: boolean }[], opts: { align?: "left" | "center" | "justify"; spaceAfter?: number } = {}) => {
    type Word = { text: string; bold: boolean; w: number };
    const words: Word[] = [];
    tokens.forEach((tk) => {
      const parts = tk.text.split(/(\s+)/);
      parts.forEach((p) => {
        if (!p) return;
        doc.setFont("times", tk.bold ? "bold" : "normal");
        words.push({ text: p, bold: !!tk.bold, w: doc.getTextWidth(p) });
      });
    });
    let line: Word[] = [];
    let lineW = 0;
    const lineH = 5.5;
    const flush = () => {
      ensureSpace(lineH);
      let x = margin;
      if (opts.align === "center") {
        const w = line.reduce((a, b) => a + b.w, 0);
        x = (pageW - w) / 2;
      }
      line.forEach((w) => {
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
        while (line.length && /^\s+$/.test(line[line.length - 1].text)) {
          lineW -= line[line.length - 1].w;
          line.pop();
        }
        flush();
        if (/^\s+$/.test(w.text)) continue;
      }
      line.push(w);
      lineW += w.w;
    }
    if (line.length) flush();
    y += opts.spaceAfter ?? 3;
  };

  const title = (t: string) => {
    ensureSpace(10);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(t, pageW / 2, y, { align: "center" });
    y += 9;
    doc.setFontSize(11);
  };

  const section = (t: string) => {
    ensureSpace(8);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text(t, margin, y);
    y += 6;
  };

  title("CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL URBANO");

  writeTokens([
    { text: "LOCADOR: ", bold: true },
    { text: `${c.locadorName}, ${c.locadorNationality}, ${c.locadorMaritalStatus}, ${c.locadorProfession}, portadora da cédula de identidade RG n° ${c.locadorRg}, inscrita no CPF sob o n° ${c.locadorCpf}, residente e domiciliada à ${c.locadorAddress}.` },
  ]);

  writeTokens([
    { text: "LOCATÁRIO: ", bold: true },
    { text: `${d.tenantName}, ${c.tenantNationality ?? "brasileiro(a)"}, ${c.tenantMaritalStatus ?? "—"}, ${c.tenantProfession ?? "—"}, portador(a) da cédula de identidade RG n° ${c.tenantRg ?? "—"}, CPF n° ${c.tenantCpf ?? "—"}, residente e domiciliado(a) na ${c.tenantAddress ?? d.propertyAddress}.` },
  ]);

  writeTokens([{ text: "As partes acima qualificadas têm, entre si, justas e acertadas, o presente Contrato de Locação de Imóvel Residencial Urbano; instrumento particular, o qual será regido pelas disposições a seguir delineadas." }]);

  section("OBJETO E DESTINAÇÃO");
  writeTokens([
    { text: "CLÁUSULA 1ª", bold: true },
    { text: ` - O objeto da locação é de um imóvel urbano para moradia, situado à ${d.propertyAddress}.` },
  ]);

  section("PRAZO DA LOCAÇÃO, PAGAMENTO E REAJUSTE DO ALUGUEL");
  const dy = c.durationYears ?? 3;
  const my = c.minStayYears ?? 1;
  writeTokens([
    { text: "CLÁUSULA 2ª", bold: true },
    { text: ` - O prazo da locação é de ${dy} (${numToWordsYears(dy)}) anos, permanecendo no mínimo ${my} ano, iniciando em ${longPt(d.startDate)}, até o seu término em ${longPt(d.endDate)}; independentemente de aviso ou notificação.` },
  ]);
  writeTokens([{ text: "Parágrafo primeiro.", bold: true }, { text: " Caso as partes de comum acordo disponham, findo o prazo estabelecido no caput, a locação poderá ser prorrogada por prazo indeterminado, vigendo todas as disposições deste instrumento particular durante o período da dilação." }]);
  writeTokens([{ text: "Parágrafo segundo.", bold: true }, { text: " Prorrogado o contrato, poderá o LOCADOR retomar o imóvel a qualquer tempo." }]);
  writeTokens([{ text: "Parágrafo terceiro.", bold: true }, { text: " Haverá ainda a retomada do imóvel, caso haja descumprimento contratual por parte do LOCATÁRIO; ou ainda, caso ocorra qualquer uma das circunstâncias previstas no Art. 47 da Lei Federal n° 8.245, de 18 de outubro de 1991 (Lei do Inquilinato)." }]);

  writeTokens([
    { text: "CLAUSULA 3ª", bold: true },
    { text: ` - O valor inicial do caução de ${brl(d.depositAmount).replace("R$ ", "")} (${brlExtenso(d.depositAmount)}) e do aluguel é de ${brl(d.rentAmount)} (${brlExtenso(d.rentAmount)}) mensais, o qual deve ser pago impreterivelmente até o dia ${d.dueDay} de cada mês subsequente ao vencido, via boleto, transferência bancária, PIX, ou por outro meio que venha a ser acordado com o LOCADOR.` },
  ]);
  writeTokens([{ text: "Parágrafo único.", bold: true }, { text: ` O aluguel será reajustado anualmente de acordo com a variação do ${c.readjustmentIndex} dos meses anteriores; e na sua falta, por outro índice que venha a substitui-lo.` }]);

  writeTokens([{ text: "CLAUSULA 4ª", bold: true }, { text: " - O LOCATÁRIO deve pagar ao LOCADOR, no início da locação, uma caução em dinheiro no valor designado na Cláusula 3ª." }]);

  section("DIRETOS, OBRIGAÇÕES DAS PARTES E CLÁUSULAS PENAIS");
  writeTokens([{ text: "CLAUSULA 5ª", bold: true }, { text: " - O LOCADOR deve entregar o imóvel em bom estado de conservação a servir ao uso a que se destina, permitindo ao LOCATÁRIO a utilização pacífica do imóvel locado." }]);
  writeTokens([{ text: "Parágrafo único.", bold: true }, { text: " O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e de funcionamento." }]);
  writeTokens([{ text: "CLÁUSULA 6ª", bold: true }, { text: " - O LOCATÁRIO declara, que o imóvel ora locado, destina-se única, exclusivamente para o seu uso residencial e de sua família. E desde logo, se obriga a servir-se do prédio para o uso convencionado, devendo tratá-lo com o mesmo cuidado como se fosse seu." }]);
  writeTokens([{ text: "CLÁUSULA 7ª", bold: true }, { text: " - O LOCATÁRIO se responsabiliza pela conservação e limpeza do imóvel, e deverá para tanto, realizar a imediata reparação dos danos verificados nas suas instalações; mesmo que estas não tenham sido provocadas por si, mas por seus dependentes, familiares, visitantes ou prepostos." }]);
  writeTokens([{ text: "CLÁUSULA 8ª", bold: true }, { text: " - O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR." }]);
  writeTokens([{ text: "CLAUSULA 9ª", bold: true }, { text: " - O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta locação." }]);
  writeTokens([{ text: "CLAUSULA 10ª", bold: true }, { text: " - O LOCATÁRIO não poderá realizar obras que alterem ou modifiquem a estrutura do imóvel locado, sem prévia autorização por escrito do LOCADOR." }]);
  writeTokens([{ text: "Parágrafo único.", bold: true }, { text: " Caso este consinta na realização das obras, estas ficarão desde logo, incorporadas ao imóvel, sem que assista ao LOCATÁRIO qualquer indenização pelas obras ou retenção por benfeitorias." }]);
  writeTokens([{ text: "CLÁUSULA 11ª", bold: true }, { text: " - Caso o LOCATÁRIO não conserve o imóvel, realize demolições ou outras práticas que venham a afetar a segurança do prédio, fica estipulada multa compensatória no valor de 10 (dez) alugueis vigentes a data do fato." }]);
  writeTokens([{ text: "Parágrafo único.", bold: true }, { text: " Por ventura os danos causados superem o valor da multa prevista no caput, deverá o LOCATÁRIO pagar todas as despesas necessárias ao reparo do imóvel até o limite da danificação." }]);
  writeTokens([{ text: "CLÁUSULA 12ª", bold: true }, { text: " - O LOCATÁRIO deve pagar pontualmente o aluguel e os demais encargos da locação, legal ou contratualmente exigíveis, conforme o prazo estipulado neste contrato." }]);
  writeTokens([{ text: "Parágrafo único.", bold: true }, { text: ` Em caso de mora no pagamento do aluguel, será aplicada multa de ${c.lateFeePercent}% (dez por cento) sobre o valor devido pelo inadimplemento; juros mensais de ${c.interestPercent}% (um por cento) por mês de atraso, além de correção monetária a ser calculada entre a data do vencimento e a do efetivo pagamento.` }]);
  writeTokens([{ text: "CLÁUSULA 13ª", bold: true }, { text: " - O LOCADOR deve fornecer ao LOCATÁRIO recibo descriminado de todas as importâncias pagas. Além de exibir, quando solicitado, os comprovantes relativos às parcelas que estejam sendo exigidas." }]);
  writeTokens([{ text: "CLÁUSULA 14ª", bold: true }, { text: " - O LOCATÁRIO será responsável pelo pagamento de impostos e taxas provenientes do imóvel à arrecadação pública (como IPTU), prêmio de seguro complementar contra fogo; além daquelas provenientes de sua utilização, como ligação e consumo de luz, força, água, gás e esgoto, que serão pagas diretamente às empresas concessionárias/órgãos públicos competentes pelos referidos serviços." }]);
  writeTokens([{ text: "CLÁUSULA 15ª", bold: true }, { text: " - O LOCATÁRIO que desejar devolver o imóvel, deve comunicar ao LOCADOR da sua desistência, com antecedência mínima de 30 (trinta) dias." }]);
  writeTokens([{ text: "CLÁUSULA 16ª", bold: true }, { text: " - Em caso de devolução antecipada do imóvel durante os seis primeiros meses da locação, o LOCATÁRIO deverá pagar multa compensatória em dinheiro no valor de 1 (um) aluguel vigente." }]);
  writeTokens([{ text: "CLÁUSULA 17ª", bold: true }, { text: " - O LOCATÁRIO permitirá vistoria do imóvel pelo LOCADOR ou por seu(s) mandatário(s), mediante combinação prévia de dia e hora; bem como, admitirá que o bem seja visitado e examinado por terceiros." }]);

  section("OUTROS TERMOS E CONDIÇÕES");
  writeTokens([{ text: "CLÁUSULA 18ª", bold: true }, { text: " - Em caso de sinistro parcial ou total do prédio que impossibilite a habitação do imóvel locado, o presente contrato estará rescindido, independentemente de aviso ou interpelação extrajudicial ou judicial." }]);
  writeTokens([{ text: "CLÁUSULA 19ª", bold: true }, { text: " - Em caso de desapropriação total ou parcial do imóvel locado, restará rescindido de pleno direito o presente contrato de locação, independente de quaisquer indenizações de ambas as partes ou contratantes." }]);
  writeTokens([{ text: "CLÁUSULA 20ª", bold: true }, { text: " - No caso de alienação do imóvel, o LOCADOR dará preferência ao LOCATÁRIO, em igualdade de condições com terceiros, devendo o LOCADOR dar-lhe ciência do negócio." }]);

  section("DISPOSIÇÕES FINAIS");
  writeTokens([{ text: "CLÁUSULA 21ª", bold: true }, { text: ` - As partes contratantes obrigam-se por si, elegendo o Foro da Cidade de ${c.forumCity} para a propositura de qualquer ação judicial.` }]);
  writeTokens([{ text: "E assim, se extrai o presente instrumento em 2 (duas) vias de igual teor, assinando-as, juntamente com a presença de uma testemunha." }]);

  ensureSpace(10);
  y += 4;
  doc.text(`${c.forumCity}/CE, ${longPt(c.signDate ?? new Date())}.`, pageW / 2, y, { align: "center" });
  y += 18;

  const sigLine = (label: string) => {
    ensureSpace(18);
    doc.line(margin + 10, y, pageW - margin - 10, y);
    y += 5;
    doc.text(label, pageW / 2, y, { align: "center" });
    y += 14;
  };
  sigLine("LOCADOR");
  sigLine("LOCATÁRIO");
  sigLine("TESTEMUNHA");

  return doc.output("blob");
}

export async function downloadContract(d: ContractData, filename: string) {
  const blob = await generateContractPDF(d);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
