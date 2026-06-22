// @ts-nocheck
import { useState } from "react";
import { useServerFn } from "@/lib/rpc";
import { useQueryClient } from "@tanstack/react-query";
import { registerPayment, getPaymentForReceipt } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, formatDateBR, calcLateFee, daysLate } from "@/lib/finance";
import { downloadReceipt } from "@/lib/receipt-pdf";
import { toast } from "sonner";

export function PayDialog({ payment, onClose }: { payment: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const register = useServerFn(registerPayment);
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  if (!payment) return null;
  const tenant = payment.tenants;
  const calc = calcLateFee(
    Number(payment.amount),
    payment.due_date,
    paidDate,
    Number(tenant?.late_fee_percent ?? 0),
    Number(tenant?.interest_percent ?? 0),
  );
  const days = daysLate(payment.due_date, new Date(paidDate + "T12:00:00"));

  async function save() {
    await register({ data: { paymentId: payment.id, paidAmount: calc.total, paidDate, lateFee: calc.multa, interest: calc.juros, notes } });
    toast.success("Pagamento registrado");
    qc.invalidateQueries();
    onClose();
  }

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Inquilino:</span> <strong>{tenant?.name}</strong></div>
          <div><span className="text-muted-foreground">Imóvel:</span> {tenant?.properties?.name ?? "—"}</div>
          <div><span className="text-muted-foreground">Vencimento:</span> {formatDateBR(payment.due_date)}</div>
          <div><span className="text-muted-foreground">Valor original:</span> {brl(payment.amount)}</div>
          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} />
          </div>
          {days > 0 && (
            <div className="rounded-md bg-warning/15 border border-warning/30 p-3 space-y-1">
              <div className="text-xs font-medium">{days} dia(s) de atraso</div>
              <div className="flex justify-between"><span>Multa</span><span>{brl(calc.multa)}</span></div>
              <div className="flex justify-between"><span>Juros</span><span>{brl(calc.juros)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{brl(calc.total)}</span></div>
            </div>
          )}
          <div>
            <Label>Observações</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Confirmar pagamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function emitReceiptFromPayment(paymentId: string) {
  // dynamic fetch
  const { getPaymentForReceipt: fn } = await import("@/lib/api/crm.functions");
  const full: any = await fn({ data: { paymentId } });
  const tenant: any = full.tenants;
  const property: any = tenant?.properties;
  const due = new Date(full.due_date + "T12:00:00");
  await downloadReceipt({
    tenantName: tenant?.name ?? "",
    tenantCpf: tenant?.cpf ?? null,
    amount: Number(full.paid_amount ?? full.amount ?? 0),
    propertyName: property?.name ?? "",
    propertyAddress: property?.address ?? null,
    houseNumber: tenant?.house_number ?? null,
    referenceMonth: due.getMonth() + 1,
    referenceYear: due.getFullYear(),
    issueDate: full.paid_date ? new Date(full.paid_date + "T12:00:00") : new Date(),
  }, `recibo_${(tenant?.name ?? "").replace(/\s+/g, "_")}_${due.getMonth() + 1}_${due.getFullYear()}.pdf`);
}