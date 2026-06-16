import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { deactivateTenant } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function EndTenancyDialog({ open, onClose, tenantId, tenantName }: { open: boolean; onClose: () => void; tenantId: string; tenantName: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const run = useServerFn(deactivateTenant);
  const [exitDate, setExitDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  async function submit() {
    try {
      await run({ data: { id: tenantId, exitDate, notes } });
      toast.success("Locação encerrada. Inquilino movido para ex-inquilinos.");
      qc.invalidateQueries();
      onClose();
      nav({ to: "/ex-inquilinos" });
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Encerrar locação — {tenantName}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">O inquilino será movido para "Ex-inquilinos" e o contrato será encerrado. Todo o histórico de pagamentos e recibos é preservado.</p>
          <div>
            <Label>Data de saída</Label>
            <Input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} />
          </div>
          <div>
            <Label>Observações (motivo, vistoria, devolução do depósito...)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={submit}>Confirmar encerramento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
