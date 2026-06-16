import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { createCharge, listTenants } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function ChargeDialog({ open, onClose, defaultTenantId }: { open: boolean; onClose: () => void; defaultTenantId?: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createCharge);
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => listTenants(), enabled: open });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({ tenantId: defaultTenantId ?? "", amount: "", dueDate: new Date().toISOString().slice(0, 10), notes: "" });
  }, [open, defaultTenantId]);

  async function submit() {
    if (!form.tenantId || !form.amount || !form.dueDate) { toast.error("Preencha todos os campos"); return; }
    try {
      await create({ data: { tenantId: form.tenantId, amount: Number(form.amount), dueDate: form.dueDate, notes: form.notes } });
      toast.success("Cobrança criada");
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Inquilino *</Label>
            <Select value={form.tenantId ?? ""} onValueChange={v => {
              const t = (tenants ?? []).find((x: any) => x.id === v);
              setForm({ ...form, tenantId: v, amount: form.amount || t?.rent_amount });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(tenants ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} — {t.properties?.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={form.amount ?? ""} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label>Vencimento *</Label>
            <Input type="date" value={form.dueDate ?? ""} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Criar cobrança</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
