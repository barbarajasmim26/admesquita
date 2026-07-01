import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/rpc";
import { listLeads, upsertLead, updateLeadStatus, deleteLead, seedDemoLeads } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, Trash2, Sparkles, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { brl } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["leads"], queryFn: () => listLeads() });

export const Route = createFileRoute("/crm")({
  head: () => ({ meta: [{ title: "CRM — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

const COLUMNS = [
  { id: "novo", label: "Novo", color: "bg-blue-500" },
  { id: "contato", label: "Em Contato", color: "bg-amber-500" },
  { id: "visita", label: "Visita Agendada", color: "bg-violet-500" },
  { id: "proposta", label: "Proposta", color: "bg-orange-500" },
  { id: "fechado", label: "Fechado", color: "bg-green-600" },
  { id: "perdido", label: "Perdido", color: "bg-rose-500" },
];

function Page() {
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();
  const save = useServerFn(upsertLead);
  const update = useServerFn(updateLeadStatus);
  const del = useServerFn(deleteLead);
  const seed = useServerFn(seedDemoLeads);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  function openNew() {
    setEditing(null);
    setForm({ status: "novo" });
    setOpen(true);
  }
  function openEdit(l: any) {
    setEditing(l);
    setForm({ ...l, propertyId: l.property_id });
    setOpen(true);
  }
  async function submit() {
    if (!form.name) { toast.error("Informe o nome"); return; }
    await save({ data: { ...form, id: editing?.id, budget: Number(form.budget) || undefined } });
    toast.success("Lead salvo");
    qc.invalidateQueries();
    setOpen(false);
  }
  async function move(id: string, status: string) {
    await update({ data: { id, status } });
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    if (!confirm("Excluir este lead?")) return;
    await del({ data: { id } });
    qc.invalidateQueries();
  }
  async function loadDemo() {
    await seed();
    toast.success("Leads de demonstração carregados");
    qc.invalidateQueries();
  }

  return (
    <div>
      <PageHeader
        title="CRM — Funil de Locação"
        description={`${data.length} lead(s) no funil`}
        actions={
          <div className="flex gap-2">
            {data.length === 0 && <Button variant="outline" onClick={loadDemo}><Sparkles className="size-4 mr-1" />Carregar exemplos</Button>}
            <Button onClick={openNew}><Plus className="size-4 mr-1" />Novo lead</Button>
          </div>
        }
      />
      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map(col => {
            const items = data.filter((l: any) => l.status === col.id);
            return (
              <div key={col.id} className="w-72 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`size-2 rounded-full ${col.color}`} />
                  <h3 className="font-semibold text-sm">{col.label}</h3>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {items.map((l: any) => (
                    <Card key={l.id} className="p-3 hover:border-primary/50 cursor-pointer group" onClick={() => openEdit(l)}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{l.name}</p>
                          {l.interest && <p className="text-xs text-muted-foreground truncate">{l.interest}</p>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); remove(l.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      {l.budget && <p className="text-xs font-medium text-primary mt-1">{brl(l.budget)}</p>}
                      <div className="flex gap-2 mt-2">
                        {l.phone && (
                          <a href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-green-600">
                            <MessageCircle className="size-3.5" />
                          </a>
                        )}
                        {l.phone && <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}><Phone className="size-3.5 text-muted-foreground" /></a>}
                        {l.email && <a href={`mailto:${l.email}`} onClick={e => e.stopPropagation()}><Mail className="size-3.5 text-muted-foreground" /></a>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {COLUMNS.filter(c => c.id !== l.status).slice(0, 3).map(c => (
                          <button key={c.id} onClick={(e) => { e.stopPropagation(); move(l.id, c.id); }} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground">
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div><Label>Nome *</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Origem</Label><Input value={form.source ?? ""} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Instagram, indicação..." /></div>
              <div><Label>Orçamento (R$)</Label><Input type="number" value={form.budget ?? ""} onChange={e => setForm({ ...form, budget: e.target.value })} /></div>
            </div>
            <div><Label>Interesse</Label><Input value={form.interest ?? ""} onChange={e => setForm({ ...form, interest: e.target.value })} placeholder="Tipo de imóvel buscado" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "novo"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COLUMNS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Input value={form.notes ?? ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
