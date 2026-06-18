import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/rpc";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { listProperties, issueCustomReceipt } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { downloadReceipt } from "@/lib/receipt-pdf";

export function NewReceiptDialog({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: any }) {
  const qc = useQueryClient();
  const issue = useServerFn(issueCustomReceipt);
  const { data: props } = useQuery({ queryKey: ["properties"], queryFn: () => listProperties(), enabled: open });
  const [propertyId, setPropertyId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [amount, setAmount] = useState("");
  const [refMonth, setRefMonth] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  });
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [pixPayer, setPixPayer] = useState("");

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setPropertyId(prefill.propertyId ?? "");
      setTenantId(prefill.tenantId ?? "");
      setAmount(String(prefill.amount ?? ""));
    } else {
      setPropertyId(""); setTenantId(""); setAmount("");
    }
    setPixPayer(prefill?.pixPayer ?? "");
  }, [open, prefill]);

  const property: any = (props ?? []).find((p: any) => p.id === propertyId);
  const tenants: any[] = property?.tenants ?? [];
  const tenant: any = tenants.find((t: any) => t.id === tenantId);

  useEffect(() => {
    if (tenant && !pixPayer) setPixPayer(tenant.pix_payer ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function submit() {
    if (!tenant || !amount) { toast.error("Selecione inquilino e valor"); return; }
    const val = Number(amount);
    const [mm, yyyy] = refMonth.split("/").map(Number);
    try {
      await downloadReceipt({
        tenantName: tenant.name,
        tenantCpf: tenant.cpf ?? null,
        amount: val,
        propertyName: property?.name ?? "",
        propertyAddress: property?.address ?? null,
        houseNumber: tenant.house_number ?? null,
        referenceMonth: mm,
        referenceYear: yyyy,
        issueDate: new Date(issueDate + "T12:00:00"),
        pixPayer: pixPayer.trim() || null,
      }, `recibo_${tenant.name.replace(/\s+/g, "_")}_${mm}_${yyyy}.pdf`);
      const r: any = await issue({ data: { tenantId: tenant.id, amount: val, referenceMonth: refMonth } });
      toast.success(`Recibo ${r.number} emitido!`);
      qc.invalidateQueries({ queryKey: ["receipts"] });
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo recibo</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Condomínio / Imóvel</Label>
            <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setTenantId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(props ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Inquilino</Label>
            <Select value={tenantId} onValueChange={(v) => {
              setTenantId(v);
              const t = tenants.find((x: any) => x.id === v);
              if (t && !amount) setAmount(String(t.rent_amount ?? ""));
            }}>
              <SelectTrigger><SelectValue placeholder={propertyId ? "Selecione" : "Selecione um imóvel primeiro"} /></SelectTrigger>
              <SelectContent>
                {tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}{t.house_number ? ` · casa ${t.house_number}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Competência (MM/AAAA)</Label>
              <Input value={refMonth} onChange={e => setRefMonth(e.target.value)} />
            </div>
            <div>
              <Label>Data emissão</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Pago via pix por (opcional)</Label>
            <Input
              value={pixPayer}
              onChange={e => setPixPayer(e.target.value)}
              placeholder="Nome de quem efetuou o pix (deixe em branco para apenas 'via pix')"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Aparecerá no recibo como: "via pix por {pixPayer || "—"}"
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Gerar PDF e registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
