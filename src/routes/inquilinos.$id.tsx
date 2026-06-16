import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getTenant } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, formatDateBR } from "@/lib/finance";
import { ArrowLeft, MessageCircle, Pencil, Plus, CheckCircle2, FileDown, LogOut, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TenantDialog } from "@/components/TenantDialog";
import { ChargeDialog } from "@/components/ChargeDialog";
import { PayDialog, emitReceiptFromPayment } from "@/components/PayDialog";
import { EndTenancyDialog } from "@/components/EndTenancyDialog";
import { downloadContract } from "@/lib/contract-pdf";
import { toast } from "sonner";
import { MonthlyPaymentGrid } from "@/components/MonthlyPaymentGrid";
import { chargeMessage, receiptMessage, waLink } from "@/lib/bot-templates";

const opts = (id: string) => queryOptions({ queryKey: ["tenant", id], queryFn: () => getTenant({ data: { id } }) });

export const Route = createFileRoute("/inquilinos/$id")({
  head: () => ({ meta: [{ title: "Inquilino — Mesquita Imóveis" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const [editOpen, setEditOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<any>(null);
  const [endOpen, setEndOpen] = useState(false);
  const t: any = data.tenant;
  if (!t) return <div className="p-8">Inquilino não encontrado</div>;

  const phone = (t.phone ?? "").replace(/\D/g, "");
  const pendings = data.payments.filter((p: any) => p.status !== "paid");
  const totalDevido = pendings.reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0);

  const lastPaid = data.payments.find((p: any) => p.status === "paid");
  const nextOverdue = pendings[pendings.length - 1];
  const cobrancaLink = nextOverdue
    ? waLink(t.phone, chargeMessage({
        name: t.name,
        amount: Number(nextOverdue.amount),
        year: Number(nextOverdue.due_date.slice(0, 4)),
        month: Number(nextOverdue.due_date.slice(5, 7)),
        pix: t.pix_payer,
        dueDay: t.due_day,
      }))
    : null;
  const reciboLink = lastPaid
    ? waLink(t.phone, receiptMessage({
        name: t.name,
        amount: Number(lastPaid.paid_amount ?? lastPaid.amount),
        year: Number(lastPaid.due_date.slice(0, 4)),
        month: Number(lastPaid.due_date.slice(5, 7)),
      }))
    : null;

  return (
    <div>
      <PageHeader title={t.name} description={`${t.properties?.name ?? ""} ${t.house_number ? `· casa ${t.house_number}` : ""}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/inquilinos"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="size-4 mr-1" />Editar</Button>
            {phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4 mr-1" />WhatsApp</a>
              </Button>
            )}
            {cobrancaLink && (
              <Button asChild variant="outline" size="sm" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                <a href={cobrancaLink} target="_blank" rel="noreferrer"><MessageCircle className="size-4 mr-1" />Cobrar (WhatsApp)</a>
              </Button>
            )}
            {reciboLink && (
              <Button asChild variant="outline" size="sm" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                <a href={reciboLink} target="_blank" rel="noreferrer"><MessageCircle className="size-4 mr-1" />Recibo (WhatsApp)</a>
              </Button>
            )}
            <Button size="sm" onClick={() => setChargeOpen(true)}><Plus className="size-4 mr-1" />Nova cobrança</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              try {
                const start = t.start_date ? new Date(t.start_date + "T12:00:00") : new Date();
                const end = new Date(start); end.setFullYear(end.getFullYear() + 3);
                await downloadContract({
                  tenantName: t.name,
                  tenantCpf: t.cpf,
                  tenantAddress: t.properties?.address ? `${t.properties.address}${t.house_number ? `, casa ${t.house_number}` : ""}` : undefined,
                  propertyAddress: `${t.properties?.address ?? t.properties?.name ?? ""}${t.house_number ? `, casa ${t.house_number}` : ""}`,
                  startDate: start, endDate: end,
                  rentAmount: Number(t.rent_amount ?? 0),
                  depositAmount: Number(t.deposit ?? t.rent_amount ?? 0),
                  dueDay: Number(t.due_day ?? 10),
                  lateFeePercent: Number(t.late_fee_percent ?? 10),
                  interestPercent: Number(t.interest_percent ?? 1),
                }, `contrato_${t.name.replace(/\s+/g, "_")}.pdf`);
                toast.success("Contrato gerado!");
              } catch (e: any) { toast.error(e.message ?? "Erro"); }
            }}><FileText className="size-4 mr-1" />Gerar contrato</Button>
            <Button size="sm" variant="destructive" onClick={() => setEndOpen(true)}><LogOut className="size-4 mr-1" />Encerrar locação</Button>
          </div>
        } />
      <div className="p-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aluguel mensal</p><p className="text-xl font-semibold mt-1">{brl(t.rent_amount)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendências</p><p className="text-xl font-semibold mt-1">{pendings.length} cobrança(s)</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total devido</p><p className={`text-xl font-semibold mt-1 ${totalDevido > 0 ? "text-destructive" : ""}`}>{brl(totalDevido)}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="CPF" value={t.cpf} />
              <Row label="Telefone" value={t.phone} />
              <Row label="Email" value={t.email} />
              <Row label="Início" value={formatDateBR(t.start_date)} />
              <Row label="Observações" value={t.notes} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contrato</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Imóvel" value={<Link to="/imoveis/$id" params={{ id: t.property_id }} className="text-primary hover:underline">{t.properties?.name}</Link>} />
              <Row label="Endereço" value={t.properties?.address} />
              <Row label="Casa nº" value={t.house_number} />
              <Row label="Aluguel" value={brl(t.rent_amount)} />
              <Row label="Vencimento" value={`dia ${t.due_day}`} />
              <Row label="Depósito" value={brl(t.deposit)} />
              <Row label="Multa / Juros" value={`${t.late_fee_percent ?? 0}% + ${t.interest_percent ?? 0}%/mês`} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Histórico de pagamentos ({data.payments.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <MonthlyPaymentGrid
              tenantId={t.id}
              rentAmount={Number(t.rent_amount ?? 0)}
              startDate={t.start_date}
              payments={data.payments as any}
            />
          </CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem cobranças. Crie uma com "Nova cobrança".</TableCell></TableRow>}
              {data.payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateBR(p.due_date)}</TableCell>
                  <TableCell className="text-right">{brl(p.amount)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>{p.paid_date ? formatDateBR(p.paid_date) : "—"}</TableCell>
                  <TableCell className="text-right">{p.paid_amount ? brl(p.paid_amount) : "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap space-x-2">
                    {p.status !== "paid"
                      ? <Button size="sm" onClick={() => setPayOpen({ ...p, tenants: { ...t, properties: t.properties } })}><CheckCircle2 className="size-4 mr-1" />Pagar</Button>
                      : <Button size="sm" variant="outline" onClick={() => emitReceiptFromPayment(p.id)}><FileDown className="size-4 mr-1" />Recibo</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      <TenantDialog open={editOpen} onClose={() => setEditOpen(false)} tenant={t} />
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} defaultTenantId={t.id} />
      <PayDialog payment={payOpen} onClose={() => setPayOpen(null)} />
      <EndTenancyDialog open={endOpen} onClose={() => setEndOpen(false)} tenantId={t.id} tenantName={t.name} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
