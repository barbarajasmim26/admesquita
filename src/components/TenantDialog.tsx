import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { upsertTenant, listProperties } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function TenantDialog({ open, onClose, tenant, defaultPropertyId }: { open: boolean; onClose: () => void; tenant?: any; defaultPropertyId?: string }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertTenant);
  const { data: props } = useQuery({ queryKey: ["properties"], queryFn: () => listProperties(), enabled: open });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      name: tenant?.name ?? "",
      propertyId: tenant?.property_id ?? defaultPropertyId ?? "",
      phone: tenant?.phone ?? "",
      email: tenant?.email ?? "",
      cpf: tenant?.cpf ?? "",
      houseNumber: tenant?.house_number ?? "",
      pixPayer: tenant?.pix_payer ?? "",
      rentAmount: tenant?.rent_amount ?? "",
      dueDay: tenant?.due_day ?? 5,
      deposit: tenant?.deposit ?? 0,
      startDate: tenant?.start_date ?? new Date().toISOString().slice(0, 10),
      lateFeePercent: tenant?.late_fee_percent ?? 2,
      interestPercent: tenant?.interest_percent ?? 1,
      notes: tenant?.notes ?? "",
    });
  }, [open, tenant, defaultPropertyId]);

  async function submit() {
    if (!form.name || !form.propertyId || !form.rentAmount) {
      toast.error("Preencha nome, imóvel e valor do aluguel");
      return;
    }
    try {
      await save({ data: {
        id: tenant?.id,
        name: form.name, propertyId: form.propertyId, phone: form.phone, email: form.email, cpf: form.cpf,
        houseNumber: form.houseNumber, rentAmount: Number(form.rentAmount), dueDay: Number(form.dueDay),
        deposit: Number(form.deposit || 0), startDate: form.startDate,
        lateFeePercent: Number(form.lateFeePercent || 0), interestPercent: Number(form.interestPercent || 0),
        notes: form.notes, pixPayer: form.pixPayer,
      } });
      toast.success(tenant?.id ? "Inquilino atualizado" : "Inquilino cadastrado");
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tenant?.id ? "Editar inquilino" : "Novo inquilino"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Nome *" className="col-span-2"><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Imóvel *">
            <Select value={form.propertyId ?? ""} onValueChange={v => setForm({ ...form, propertyId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(props ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Casa nº"><Input value={form.houseNumber ?? ""} onChange={e => setForm({ ...form, houseNumber: e.target.value })} /></Field>
          <Field label="CPF"><Input value={form.cpf ?? ""} onChange={e => setForm({ ...form, cpf: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email" className="col-span-2"><Input value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Pago por (PIX no recibo)" className="col-span-2"><Input value={form.pixPayer ?? ""} onChange={e => setForm({ ...form, pixPayer: e.target.value })} placeholder="Ex: João da Silva — deixe em branco para exibir só 'via pix'" /></Field>
          <Field label="Aluguel (R$) *"><Input type="number" step="0.01" value={form.rentAmount ?? ""} onChange={e => setForm({ ...form, rentAmount: e.target.value })} /></Field>
          <Field label="Dia vencimento"><Input type="number" min={1} max={31} value={form.dueDay ?? ""} onChange={e => setForm({ ...form, dueDay: e.target.value })} /></Field>
          <Field label="Depósito (R$)"><Input type="number" step="0.01" value={form.deposit ?? ""} onChange={e => setForm({ ...form, deposit: e.target.value })} /></Field>
          <Field label="Início contrato"><Input type="date" value={form.startDate ?? ""} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Multa (%)"><Input type="number" step="0.1" value={form.lateFeePercent ?? ""} onChange={e => setForm({ ...form, lateFeePercent: e.target.value })} /></Field>
          <Field label="Juros mês (%)"><Input type="number" step="0.1" value={form.interestPercent ?? ""} onChange={e => setForm({ ...form, interestPercent: e.target.value })} /></Field>
          <Field label="Observações" className="col-span-2"><Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
