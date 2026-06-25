// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/rpc";
import { useState } from "react";
import { listPayments, getPaymentForReceipt, getAnyPaymentForReceipt, listReceipts, registerReceipt } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, formatDateBR } from "@/lib/finance";
import { downloadReceipt } from "@/lib/receipt-pdf";
import { FileDown, Sparkles, Plus, Copy, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { NewReceiptDialog } from "@/components/NewReceiptDialog";

const paidOpts = queryOptions({ queryKey: ["receipts", "paid"], queryFn: () => listPayments({ data: { status: "paid" } }) });
const historyOpts = queryOptions({ queryKey: ["receipts", "history"], queryFn: () => listReceipts() });

export const Route = createFileRoute("/recibos")({
  head: () => ({ meta: [{ title: "Recibos — Mesquita Imóveis" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(paidOpts),
    context.queryClient.ensureQueryData(historyOpts),
  ]),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

async function emitFromPayment(p: any, register: any) {
  const tenant = p.tenants;
  const property = tenant?.properties;
  const due = new Date(p.due_date + "T12:00:00");
  const amount = Number(p.paid_amount ?? p.amount ?? 0);
  await downloadReceipt({
    tenantName: tenant?.name ?? "",
    tenantCpf: tenant?.cpf ?? null,
    amount,
    propertyName: property?.name ?? "",
    propertyAddress: property?.address ?? null,
    houseNumber: tenant?.house_number ?? null,
    referenceMonth: due.getMonth() + 1,
    referenceYear: due.getFullYear(),
    issueDate: p.paid_date ? new Date(p.paid_date + "T12:00:00") : new Date(),
    pixPayer: tenant?.pix_payer ?? null,
  }, `recibo_${(tenant?.name ?? "").replace(/\s+/g, "_")}_${due.getMonth() + 1}_${due.getFullYear()}.pdf`);
  const ref = `${String(due.getMonth() + 1).padStart(2, "0")}/${due.getFullYear()}`;
  const r: any = await register({ data: { paymentId: p.id, tenantId: tenant?.id, amount, referenceMonth: ref } });
  toast.success(`Recibo ${r.number} emitido com sucesso!`);
}

function Page() {
  const { data: paid } = useSuspenseQuery(paidOpts);
  const { data: history } = useSuspenseQuery(historyOpts);
  const qc = useQueryClient();
  const fetchAny = useServerFn(getAnyPaymentForReceipt);
  const fetchOne = useServerFn(getPaymentForReceipt);
  const register = useServerFn(registerReceipt);
  const [newOpen, setNewOpen] = useState(false);
  const [prefill, setPrefill] = useState<any>(undefined);

  async function testReceipt() {
    try {
      const p: any = await fetchAny();
      if (!p) { toast.error("Nenhum pagamento encontrado no sistema."); return; }
      await emitFromPayment(p, register);
      qc.invalidateQueries({ queryKey: ["receipts"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  async function emit(p: any) {
    const full: any = await fetchOne({ data: { paymentId: p.id } });
    await emitFromPayment(full, register);
    qc.invalidateQueries({ queryKey: ["receipts"] });
  }

  async function downloadBlank() {
    try {
      const now = new Date();
      await downloadReceipt({
        tenantName: "____________________________________",
        tenantCpf: "____________",
        amount: 0,
        propertyName: "",
        propertyAddress: "____________________________________",
        houseNumber: null,
        referenceMonth: now.getMonth() + 1,
        referenceYear: now.getFullYear(),
        issueDate: now,
      }, "modelo_recibo.pdf");
      toast.success("Modelo de recibo baixado");
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  function duplicate(r: any) {
    setPrefill({
      propertyId: r.tenants?.properties?.id,
      tenantId: r.tenants?.id,
      amount: r.amount,
    });
    setNewOpen(true);
  }

  async function downloadFromHistory(r: any) {
    try {
      const t = r.tenants ?? {};
      const prop = t.properties ?? {};
      // reference_month "MM/YYYY"
      let m = new Date().getMonth() + 1, y = new Date().getFullYear();
      if (r.reference_month && /^\d{2}\/\d{4}$/.test(r.reference_month)) {
        const [mm, yy] = r.reference_month.split("/");
        m = Number(mm); y = Number(yy);
      } else if (r.reference_month && /^\d{4}-\d{2}$/.test(r.reference_month)) {
        const [yy, mm] = r.reference_month.split("-");
        m = Number(mm); y = Number(yy);
      }
      await downloadReceipt({
        tenantName: t.name ?? "",
        tenantCpf: t.cpf ?? null,
        amount: Number(r.amount ?? 0),
        propertyName: prop.name ?? "",
        propertyAddress: prop.address ?? null,
        houseNumber: t.house_number ?? null,
        referenceMonth: m,
        referenceYear: y,
        issueDate: r.issued_at ? new Date(r.issued_at) : new Date(),
        pixPayer: t.pix_payer ?? null,
      }, `recibo_${r.receipt_number?.replace(/\//g, "-")}_${(t.name ?? "").replace(/\s+/g, "_")}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao baixar");
    }
  }

  return (
    <div>
      <PageHeader
        title="Recibos"
        description={`${history.length} recibo(s) emitido(s)`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadBlank} className="gap-2">
              <FileText className="size-4" /> Modelo original
            </Button>
            <Button variant="outline" onClick={testReceipt} className="gap-2">
              <Sparkles className="size-4" /> Teste
            </Button>
            <Button onClick={() => { setPrefill(undefined); setNewOpen(true); }} className="gap-2">
              <Plus className="size-4" /> Novo Recibo
            </Button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>· Clique em <strong>"Emitir Recibo de Teste"</strong> acima para gerar imediatamente um PDF usando dados reais do sistema.</p>
            <p>· Cada recibo recebe um número sequencial automático (formato ANO/0000).</p>
            <p>· Reimpressão disponível a qualquer momento no histórico abaixo.</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history">Histórico de Recibos ({history.length})</TabsTrigger>
            <TabsTrigger value="paid">Pagamentos Pagos ({paid.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Recibo</TableHead>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Emitido em</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      Nenhum recibo emitido. Clique em "Novo Recibo".
                    </TableCell></TableRow>
                  )}
                  {history.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">{r.receipt_number}</TableCell>
                      <TableCell>{r.tenants?.name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.tenants?.properties?.name ?? "—"}</TableCell>
                      <TableCell>{r.reference_month ?? "—"}</TableCell>
                      <TableCell>{formatDateBR(r.issued_at?.slice(0, 10))}</TableCell>
                      <TableCell className="text-right font-medium">{brl(r.amount)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => downloadFromHistory(r)} title="Baixar PDF">
                            <Download className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => duplicate(r)} title="Duplicar"><Copy className="size-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="paid">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>Imóvel</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paid.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum pagamento registrado.</TableCell></TableRow>}
                  {paid.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.tenants?.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.tenants?.properties?.name}</TableCell>
                      <TableCell>{formatDateBR(p.paid_date)}</TableCell>
                      <TableCell className="text-right font-medium">{brl(p.paid_amount ?? p.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => emit(p)}>
                          <FileDown className="size-4 mr-1" />Recibo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <NewReceiptDialog open={newOpen} onClose={() => setNewOpen(false)} prefill={prefill} />
    </div>
  );
}