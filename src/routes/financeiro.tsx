// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listPayments } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, formatDateBR } from "@/lib/finance";
import { PayDialog, emitReceiptFromPayment } from "@/components/PayDialog";
import { ChargeDialog } from "@/components/ChargeDialog";
import { FileDown, CheckCircle2, Plus } from "lucide-react";

const opts = (m: string, status: string) =>
  queryOptions({ queryKey: ["payments", m, status], queryFn: () => listPayments({ data: { month: m || undefined, status } }) });

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Mesquita Imóveis" }] }),
  loader: ({ context }) => {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return context.queryClient.ensureQueryData(opts(m, "all"));
  },
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [status, setStatus] = useState("all");
  const { data } = useSuspenseQuery(opts(month, status));
  const [payOpen, setPayOpen] = useState<any>(null);
  const [chargeOpen, setChargeOpen] = useState(false);

  const totals = data.reduce(
    (a: any, p: any) => {
      const v = Number(p.amount ?? 0);
      a.total += v;
      if (p.status === "paid") a.paid += Number(p.paid_amount ?? v);
      else if (p.status === "overdue") a.overdue += v;
      else a.pending += v;
      return a;
    },
    { total: 0, paid: 0, pending: 0, overdue: 0 },
  );

  return (
    <div>
      <PageHeader title="Financeiro" description="Cobranças, pagamentos e recibos"
        actions={<Button onClick={() => setChargeOpen(true)}><Plus className="size-4 mr-1" />Nova cobrança</Button>} />
      <div className="p-8 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Mini label="Total no mês" value={brl(totals.total)} />
          <Mini label="Recebido" value={brl(totals.paid)} tone="text-success" />
          <Mini label="Pendente" value={brl(totals.pending)} tone="text-warning-foreground" />
          <Mini label="Atrasado" value={brl(totals.overdue)} tone="text-destructive" />
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Mês</Label>
              <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="overdue">Atrasados</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setMonth(""); setStatus("all"); }}>Mostrar todos</Button>
            <span className="ml-auto text-sm text-muted-foreground">{data.length} cobrança(s)</span>
          </CardContent>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Sem cobranças neste período.</TableCell></TableRow>}
              {data.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.tenants?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{p.tenants?.properties?.name ?? "—"}</TableCell>
                  <TableCell>{formatDateBR(p.due_date)}</TableCell>
                  <TableCell className="text-right font-medium">{brl(p.amount)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.paid_date ? formatDateBR(p.paid_date) : "—"}</TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {p.status !== "paid" && (
                      <Button size="sm" onClick={() => setPayOpen(p)}>
                        <CheckCircle2 className="size-4 mr-1" />Registrar
                      </Button>
                    )}
                    {p.status === "paid" && (
                      <Button size="sm" variant="outline" onClick={() => emitReceiptFromPayment(p.id)}>
                        <FileDown className="size-4 mr-1" />Recibo
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <PayDialog payment={payOpen} onClose={() => setPayOpen(null)} />
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} />
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${tone ?? ""}`}>{value}</p>
    </CardContent></Card>
  );
}