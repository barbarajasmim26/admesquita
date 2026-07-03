import { useEffect, useState } from "react";
import { useServerFn } from "@/lib/rpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProperties, upsertTenant } from "@/lib/api/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { downloadContract } from "@/lib/contract-pdf";
import { CONTRACT_TEMPLATES, findTemplateForProperty } from "@/lib/contract-templates";

export function NewContractDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertTenant);
  const { data: props } = useQuery({ queryKey: ["properties"], queryFn: () => listProperties(), enabled: open });
  const [f, setF] = useState<any>({});

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setF({
      propertyId: "",
      name: "", cpf: "", rg: "", nationality: "brasileira", maritalStatus: "solteira",
      profession: "", phone: "", email: "", tenantAddress: "",
      houseNumber: "",
      rentAmount: "", deposit: "", dueDay: 10,
      startDate: today,
      durationYears: 3, minStayYears: 1,
    });
  }, [open]);

  const property: any = (props ?? []).find((p: any) => p.id === f.propertyId);
  const selectedTemplate = CONTRACT_TEMPLATES.find((t) => t.id === f.templateId) ?? findTemplateForProperty(property?.name);
  const isManual = f.templateId === "manual";
  const baseAddress = isManual
    ? (f.manualAddress ?? "")
    : (selectedTemplate?.defaultAddress ?? property?.address ?? property?.name ?? "");
  const fullPropertyAddress = `${baseAddress}${f.houseNumber ? `, casa ${f.houseNumber}` : ""}`;

  async function submit(saveAlso: boolean) {
    if (!f.propertyId || !f.name || !f.rentAmount) {
      toast.error("Preencha imóvel, nome e aluguel");
      return;
    }
    const start = new Date(f.startDate + "T12:00:00");
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + Number(f.durationYears || 3));

    const rent = Number(f.rentAmount);
    const deposit = Number(f.deposit || rent);

    try {
      await downloadContract({
        tenantName: f.name,
        tenantNationality: f.nationality,
        tenantMaritalStatus: f.maritalStatus,
        tenantProfession: f.profession,
        tenantRg: f.rg,
        tenantCpf: f.cpf,
        // Locatário reside no próprio imóvel locado — mesmo endereço e numeração do OBJETO
        tenantAddress: f.tenantAddress?.trim() ? f.tenantAddress : fullPropertyAddress,
        propertyAddress: fullPropertyAddress,
        startDate: start,
        endDate: end,
        rentAmount: rent,
        depositAmount: deposit,
        dueDay: Number(f.dueDay || 10),
        durationYears: Number(f.durationYears || 3),
        minStayYears: Number(f.minStayYears || 1),
        signDate: start,
        forumCity: selectedTemplate?.forumCity,
      }, `contrato_${f.name.replace(/\s+/g, "_")}.pdf`);

      if (saveAlso) {
        await save({ data: {
          name: f.name, propertyId: f.propertyId, phone: f.phone, email: f.email, cpf: f.cpf,
          houseNumber: f.houseNumber, rentAmount: rent, dueDay: Number(f.dueDay || 10),
          deposit, startDate: f.startDate,
          lateFeePercent: 10, interestPercent: 1,
          notes: `Contrato gerado em ${new Date().toLocaleDateString("pt-BR")} · ${f.profession || ""}`.trim(),
        }});
        toast.success("Inquilino cadastrado e contrato gerado!");
        qc.invalidateQueries();
      } else {
        toast.success("Contrato gerado (sem cadastrar inquilino)");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato a partir do modelo</DialogTitle>
          <DialogDescription>Preencha os dados do inquilino. O PDF será gerado no modelo original e o inquilino pode ser cadastrado no sistema.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div>
            <Label>Modelo de contrato (condomínio)</Label>
            <Select value={f.templateId ?? ""} onValueChange={v => setF({ ...f, templateId: v })}>
              <SelectTrigger><SelectValue placeholder="Auto pelo imóvel — ou escolha um modelo" /></SelectTrigger>
              <SelectContent>
                {CONTRACT_TEMPLATES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground mt-1">Endereço base: {selectedTemplate.defaultAddress}</p>
            )}
          </div>

          {isManual && (
            <div>
              <Label>Endereço manual do imóvel *</Label>
              <Input
                value={f.manualAddress ?? ""}
                onChange={e => setF({ ...f, manualAddress: e.target.value })}
                placeholder="Ex: Rua X, nº 000, Bairro, Cidade/UF"
              />
            </div>
          )}

          <div>
            <Label>Imóvel *</Label>
            <Select value={f.propertyId ?? ""} onValueChange={v => setF({ ...f, propertyId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(props ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}{p.address ? ` — ${p.address}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium mb-2 text-foreground">Dados do locatário</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome completo *" className="col-span-2"><Input value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="CPF"><Input value={f.cpf ?? ""} onChange={e => setF({ ...f, cpf: e.target.value })} placeholder="000.000.000-00" /></Field>
              <Field label="RG"><Input value={f.rg ?? ""} onChange={e => setF({ ...f, rg: e.target.value })} /></Field>
              <Field label="Nacionalidade"><Input value={f.nationality ?? ""} onChange={e => setF({ ...f, nationality: e.target.value })} /></Field>
              <Field label="Estado civil"><Input value={f.maritalStatus ?? ""} onChange={e => setF({ ...f, maritalStatus: e.target.value })} /></Field>
              <Field label="Profissão"><Input value={f.profession ?? ""} onChange={e => setF({ ...f, profession: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
              <Field label="Email" className="col-span-2"><Input value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Endereço do locatário (opcional)" className="col-span-2">
                <Input
                  value={f.tenantAddress ?? ""}
                  onChange={e => setF({ ...f, tenantAddress: e.target.value })}
                  placeholder={fullPropertyAddress ? `Se vazio: ${fullPropertyAddress}` : "Se vazio, usa endereço do imóvel"}
                />
                <p className="text-xs text-muted-foreground mt-1">Por padrão, repete o mesmo endereço e numeração do imóvel locado.</p>
              </Field>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="font-medium mb-2 text-foreground">Locação</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Casa nº"><Input value={f.houseNumber ?? ""} onChange={e => setF({ ...f, houseNumber: e.target.value })} /></Field>
              <Field label="Aluguel (R$) *"><Input type="number" step="0.01" value={f.rentAmount ?? ""} onChange={e => setF({ ...f, rentAmount: e.target.value })} /></Field>
              <Field label="Caução (R$)"><Input type="number" step="0.01" value={f.deposit ?? ""} onChange={e => setF({ ...f, deposit: e.target.value })} placeholder="= aluguel" /></Field>
              <Field label="Dia vencimento"><Input type="number" min={1} max={31} value={f.dueDay ?? ""} onChange={e => setF({ ...f, dueDay: e.target.value })} /></Field>
              <Field label="Início"><Input type="date" value={f.startDate ?? ""} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>
              <Field label="Duração (anos)"><Input type="number" min={1} value={f.durationYears ?? ""} onChange={e => setF({ ...f, durationYears: e.target.value })} /></Field>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" onClick={() => submit(false)}>Só gerar PDF</Button>
          <Button onClick={() => submit(true)}>Gerar PDF e cadastrar inquilino</Button>
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