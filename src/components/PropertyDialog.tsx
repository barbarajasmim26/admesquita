// @ts-nocheck
import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/rpc";
import { useQueryClient } from "@tanstack/react-query";
import { upsertProperty } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function PropertyDialog({ open, onClose, property }: { open: boolean; onClose: () => void; property?: any }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertProperty);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      name: property?.name ?? "",
      address: property?.address ?? "",
      type: property?.type ?? "house",
      category: property?.category ?? "residencial",
      owner_name: property?.owner_name ?? "",
      owner_phone: property?.owner_phone ?? "",
      notes: property?.notes ?? "",
    });
  }, [open, property]);

  async function submit() {
    if (!form.name) { toast.error("Informe o nome do imóvel"); return; }
    try {
      await save({ data: { id: property?.id, name: form.name, address: form.address, type: form.type, category: form.category, ownerName: form.owner_name, ownerPhone: form.owner_phone, notes: form.notes } });
      toast.success(property?.id ? "Imóvel atualizado" : "Imóvel cadastrado");
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  }



  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{property?.id ? "Editar imóvel" : "Novo imóvel"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Nome / identificação *</Label>
            <Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Condomínio Vila Mar" />
          </div>
          <div>
            <Label>Endereço completo</Label>
            <Input value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type ?? "house"} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="house">Casa</SelectItem>
                  <SelectItem value="apartment">Apartamento</SelectItem>
                  <SelectItem value="condominium">Condomínio (várias casas)</SelectItem>
                  <SelectItem value="commercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category ?? "residencial"} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                  <SelectItem value="condominio">Condomínio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Proprietário</Label>
              <Input value={form.owner_name ?? ""} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="Nome do dono" />
            </div>
            <div>
              <Label>Telefone do proprietário</Label>
              <Input value={form.owner_phone ?? ""} onChange={e => setForm({ ...form, owner_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}