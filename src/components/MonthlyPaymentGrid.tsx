import { useMemo, useState } from "react";
import { useServerFn } from "@/lib/rpc";
import { useQueryClient } from "@tanstack/react-query";
import { setMonthStatus } from "@/lib/api/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/finance";
import { ChevronLeft, ChevronRight, Check, Clock, AlertTriangle, X, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadReceipt } from "@/lib/receipt-pdf";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type PaymentRow = {
  id: string;
  due_date: string;
  paid_date: string | null;
  amount: number | string;
  paid_amount: number | string | null;
  status: string;
};

export function MonthlyPaymentGrid({
  tenantId,
  rentAmount,
  startDate,
  payments,
  tenantData,
}: {
  tenantId: string;
  rentAmount: number;
  startDate: string | null;
  payments: PaymentRow[];
  tenantData?: any;
}) {
  const qc = useQueryClient();
  const setStatus = useServerFn(setMonthStatus);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const today = now.toISOString().slice(0, 10);

  const byMonth = useMemo(() => {
    const map: Record<number, PaymentRow> = {};
    payments.forEach((p) => {
      const d = new Date(p.due_date + "T12:00:00");
      if (d.getFullYear() === year) map[d.getMonth() + 1] = p;
    });
    return map;
  }, [payments, year]);

  const startYM = startDate ? startDate.slice(0, 7) : null;

  async function update(month: number, status: "paid" | "pending" | "overdue" | "none") {
    try {
      await setStatus({ data: { tenantId, year, month, status } });
      toast.success("Atualizado");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar");
    }
  }

  async function downloadReceiptForMonth(payment: PaymentRow) {
    try {
      const tenant: any = tenantData || {};
      const property: any = tenant?.properties;
      const due = new Date(payment.due_date + "T12:00:00");
      await downloadReceipt({
        tenantName: tenant?.name ?? "",
        tenantCpf: tenant?.cpf ?? null,
        amount: Number(payment.paid_amount ?? payment.amount ?? 0),
        propertyName: property?.name ?? "",
        propertyAddress: property?.address ?? null,
        houseNumber: tenant?.house_number ?? null,
        referenceMonth: due.getMonth() + 1,
        referenceYear: due.getFullYear(),
        issueDate: payment.paid_date ? new Date(payment.paid_date + "T12:00:00") : new Date(),
      }, `recibo_${(tenant?.name ?? "").replace(/\s+/g, "_")}_${due.getMonth() + 1}_${due.getFullYear()}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao baixar recibo");
    }
  }

  const totalPaid = Object.values(byMonth).filter((p) => p.status === "paid").length;
  const totalOverdue = Object.values(byMonth).filter((p) => p.status === "overdue" || (p.status !== "paid" && p.due_date < today)).length;
  const totalPending = Object.values(byMonth).filter((p) => p.status === "pending" && p.due_date >= today).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Meses do ano</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setYear(y => y - 1)}><ChevronLeft className="size-4" /></Button>
          <span className="font-semibold w-16 text-center">{year}</span>
          <Button variant="ghost" size="icon" onClick={() => setYear(y => y + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-xs">
          <Legend color="bg-emerald-500" label={`Pagos: ${totalPaid}`} />
          <Legend color="bg-rose-500" label={`Atrasados: ${totalOverdue}`} />
          <Legend color="bg-amber-500" label={`A vencer: ${totalPending}`} />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {MONTHS.map((m, idx) => {
            const monthNum = idx + 1;
            const ym = `${year}-${String(monthNum).padStart(2, "0")}`;
            const beforeStart = startYM && ym < startYM;
            const p = byMonth[monthNum];
            const isOverdue = p && p.status !== "paid" && p.due_date < today;
            const state = !p
              ? "none"
              : p.status === "paid"
              ? "paid"
              : isOverdue
              ? "overdue"
              : "pending";

            const styles = {
              paid: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
              overdue: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
              pending: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
              none: "bg-muted/30 border-border text-muted-foreground",
            }[state];

            const Icon = state === "paid" ? Check : state === "overdue" ? AlertTriangle : state === "pending" ? Clock : X;

            return (
              <DropdownMenu key={monthNum}>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!!beforeStart}
                    className={`rounded-lg border p-3 text-left transition hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed ${styles}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{m}</span>
                      <Icon className="size-4" />
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      {p ? brl(p.paid_amount ?? p.amount) : beforeStart ? "antes do início" : "sem cobrança"}
                    </div>
                    {p?.paid_date && (
                      <div className="text-[10px] opacity-70 mt-0.5">pago {p.paid_date.slice(8, 10)}/{p.paid_date.slice(5, 7)}</div>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {p && p.status === "paid" && (
                    <DropdownMenuItem onClick={() => downloadReceiptForMonth(p)}>
                      <Download className="size-4 mr-2 text-blue-500" /> Baixar recibo
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => update(monthNum, "paid")}>
                    <Check className="size-4 mr-2 text-emerald-500" /> Marcar como pago
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => update(monthNum, "pending")}>
                    <Clock className="size-4 mr-2 text-amber-500" /> Marcar como pendente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => update(monthNum, "overdue")}>
                    <AlertTriangle className="size-4 mr-2 text-rose-500" /> Marcar como atrasado
                  </DropdownMenuItem>
                  {p && (
                    <DropdownMenuItem onClick={() => update(monthNum, "none")}>
                      <X className="size-4 mr-2" /> Remover cobrança
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Clique em um mês para alterar manualmente. Aluguel base: {brl(rentAmount)}.
        </p>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-3 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}
