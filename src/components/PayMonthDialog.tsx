import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/finance";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type PayMonthValues = { paidAmount: number; paidDate: string; notes: string };

export function PayMonthDialog({
  open, onClose, onConfirm, month, year, baseAmount, initial,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (v: PayMonthValues) => Promise<void> | void;
  month: number;
  year: number;
  baseAmount: number;
  initial?: { paidAmount?: number | null; paidDate?: string | null; notes?: string | null };
}) {
  const [rent, setRent] = useState(baseAmount);
  const [maint, setMaint] = useState(0);
  const [fee, setFee] = useState(0);
  const [other, setOther] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRent(initial?.paidAmount != null ? Number(initial.paidAmount) : baseAmount);
    setMaint(0); setFee(0); setOther(0); setDiscount(0);
    setDate(initial?.paidDate ?? new Date().toISOString().slice(0, 10));
    setNotes(initial?.notes ?? "");
  }, [open]);

  const total = Math.max(0, rent + maint + fee + other - discount);

  async function save() {
    setSaving(true);
    const parts: string[] = [];
    if (maint) parts.push(`manutenção ${brl(maint)}`);
    if (fee) parts.push(`multa/atraso ${brl(fee)}`);
    if (other) parts.push(`outros ${brl(other)}`);
    if (discount) parts.push(`desconto ${brl(discount)}`);
    const finalNotes = [notes.trim(), parts.length ? `Inclui: ${parts.join(", ")}` : ""].filter(Boolean).join(" — ");
    try {
      await onConfirm({ paidAmount: Math.round(total * 100) / 100, paidDate: date, notes: finalNotes });
      onClose();
    } finally { setSaving(false); }
  }

  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pagamento de {MONTHS[month - 1]}/{year}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Aluguel</Label><Input type="number" step="0.01" value={rent} onChange={e => setRent(num(e.target.value))} /></div>
            <div><Label>Data do pagamento</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><Label>+ Manutenção</Label><Input type="number" step="0.01" value={maint || ""} placeholder="0" onChange={e => setMaint(num(e.target.value))} /></div>
            <div><Label>+ Multa / atraso</Label><Input type="number" step="0.01" value={fee || ""} placeholder="0" onChange={e => setFee(num(e.target.value))} /></div>
            <div><Label>+ Outros</Label><Input type="number" step="0.01" value={other || ""} placeholder="0" onChange={e => setOther(num(e.target.value))} /></div>
            <div><Label>− Desconto</Label><Input type="number" step="0.01" value={discount || ""} placeholder="0" onChange={e => setDiscount(num(e.target.value))} /></div>
          </div>
          <div><Label>Observação</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: pagou junto a taxa da fossa" /></div>
          <div className="rounded-lg bg-primary/10 p-3 flex items-center justify-between">
            <span className="text-muted-foreground">Total recebido (vai no recibo)</span>
            <span className="text-lg font-semibold">{brl(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Confirmar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
