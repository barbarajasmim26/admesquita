import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/rpc";
import {
  listLeads, upsertLead, updateLeadStatus, deleteLead, seedDemoLeads,
  listLeadActivities, addLeadActivity, upsertTask,
} from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Mail, Trash2, Sparkles, MessageCircle, Clock, CalendarPlus, StickyNote, PhoneCall } from "lucide-react";
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

const OPEN_STATUSES = new Set(["novo", "contato", "visita", "proposta"]);

const WA_TEMPLATES: { id: string; label: string; body: string }[] = [
  { id: "primeiro_contato", label: "Primeiro contato", body: "Olá, {NOME}! Vi seu interesse em {INTERESSE}. Posso te ajudar com mais informações?" },
  { id: "followup", label: "Follow-up", body: "Olá, {NOME}, tudo bem? Passando para saber se ainda tem interesse em {INTERESSE}. Fico à disposição!" },
  { id: "visita", label: "Agendar visita", body: "Olá, {NOME}! Vamos agendar uma visita ao imóvel? Me diga o melhor dia e horário para você." },
  { id: "proposta", label: "Enviar proposta", body: "Olá, {NOME}! Preparamos uma proposta para você. Podemos conversar sobre os detalhes?" },
];

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86400000));
}

function contactBadge(days: number) {
  if (days <= 2) return { label: `há ${days}d`, cls: "bg-green-100 text-green-700 border-green-300" };
  if (days <= 5) return { label: `há ${days}d`, cls: "bg-amber-100 text-amber-800 border-amber-300" };
  return { label: `há ${days}d — esfriando!`, cls: "bg-rose-100 text-rose-700 border-rose-300" };
}

const ACTIVITY_ICON: Record<string, any> = {
  criado: Sparkles,
  status: Clock,
  whatsapp: MessageCircle,
  ligacao: PhoneCall,
  nota: StickyNote,
};

function digits(s?: string) { return (s ?? "").replace(/\D/g, ""); }
function firstName(n?: string) { return (n ?? "").trim().split(/\s+/)[0] ?? ""; }
function formatDateTimeBR(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function Page() {
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();
  const save = useServerFn(upsertLead);
  const update = useServerFn(updateLeadStatus);
  const del = useServerFn(deleteLead);
  const seed = useServerFn(seedDemoLeads);
  const addActivity = useServerFn(addLeadActivity);
  const createTask = useServerFn(upsertTask);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [noteText, setNoteText] = useState("");
  const [waTplId, setWaTplId] = useState(WA_TEMPLATES[0].id);

  const activitiesOpts = editing
    ? queryOptions({ queryKey: ["lead-activities", editing.id], queryFn: () => listLeadActivities({ leadId: editing.id } as any) })
    : null;
  const { data: activities } = useQuery({ ...(activitiesOpts as any), enabled: !!editing }) as { data: any[] | undefined };

  function openNew() {
    setEditing(null);
    setForm({ status: "novo" });
    setOpen(true);
  }
  function openEdit(l: any) {
    setEditing(l);
    setForm({ ...l, propertyId: l.property_id, nextFollowup: l.next_followup ?? "" });
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
  async function logNote() {
    if (!noteText.trim() || !editing) return;
    await addActivity({ data: { leadId: editing.id, type: "nota", description: noteText.trim() } });
    setNoteText("");
    qc.invalidateQueries({ queryKey: ["lead-activities", editing.id] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Nota registrada");
  }
  async function logCall() {
    if (!editing) return;
    await addActivity({ data: { leadId: editing.id, type: "ligacao", description: "Ligação registrada" } });
    qc.invalidateQueries({ queryKey: ["lead-activities", editing.id] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Ligação registrada");
  }
  async function sendWhatsapp() {
    if (!editing?.phone) { toast.error("Este lead não tem telefone cadastrado"); return; }
    const tpl = WA_TEMPLATES.find(t => t.id === waTplId)!;
    const msg = tpl.body
      .replace(/\{NOME\}/g, firstName(editing.name) || "tudo bem")
      .replace(/\{INTERESSE\}/g, editing.interest || "nosso imóvel");
    const phone = digits(editing.phone);
    const full = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, "_blank");
    await addActivity({ data: { leadId: editing.id, type: "whatsapp", description: `Modelo: ${tpl.label}` } });
    qc.invalidateQueries({ queryKey: ["lead-activities", editing.id] });
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success("WhatsApp aberto e registrado no histórico");
  }
  async function createFollowupTask() {
    if (!editing || !form.nextFollowup) { toast.error("Defina uma data de follow-up primeiro"); return; }
    await createTask({
      data: {
        title: `Follow-up: ${editing.name}`,
        description: `Retomar contato com o lead ${editing.name}`,
        dueDate: form.nextFollowup,
        priority: "normal",
        leadId: editing.id,
      } as any,
    });
    toast.success("Tarefa criada na Agenda");
    qc.invalidateQueries({ queryKey: ["tasks"] });
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
                  {items.map((l: any) => {
                    const days = daysSince(l.last_contact_at);
                    const badge = OPEN_STATUSES.has(l.status) ? contactBadge(days) : null;
                    return (
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
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-2">
                            {l.phone && (
                              <a href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-green-600">
                                <MessageCircle className="size-3.5" />
                              </a>
                            )}
                            {l.phone && <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}><Phone className="size-3.5 text-muted-foreground" /></a>}
                            {l.email && <a href={`mailto:${l.email}`} onClick={e => e.stopPropagation()}><Mail className="size-3.5 text-muted-foreground" /></a>}
                          </div>
                          {badge && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.cls} flex items-center gap-1`}>
                              <Clock className="size-2.5" />{badge.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {COLUMNS.filter(c => c.id !== l.status).slice(0, 3).map(c => (
                            <button key={c.id} onClick={(e) => { e.stopPropagation(); move(l.id, c.id); }} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground">
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? `Lead: ${editing.name}` : "Novo lead"}</DialogTitle></DialogHeader>

          <Tabs defaultValue="dados">
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="historico" disabled={!editing}>Histórico {editing ? `(${activities?.length ?? 0})` : ""}</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-3 text-sm pt-2">
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

              <div className="rounded border bg-muted/30 p-3 space-y-2">
                <Label>Próximo follow-up</Label>
                <div className="flex gap-2">
                  <Input type="date" value={form.nextFollowup ?? ""} onChange={e => setForm({ ...form, nextFollowup: e.target.value })} />
                  {editing && (
                    <Button type="button" variant="outline" onClick={createFollowupTask}>
                      <CalendarPlus className="size-4 mr-1" />Criar tarefa na Agenda
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Define uma data e cria automaticamente uma tarefa de follow-up na Agenda, já vinculada a este lead.</p>
              </div>
            </TabsContent>

            <TabsContent value="historico" className="space-y-4 pt-2">
              {editing && (
                <>
                  <div className="rounded border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Select value={waTplId} onValueChange={setWaTplId}>
                        <SelectTrigger className="w-auto flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{WA_TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" onClick={sendWhatsapp} className="bg-green-600 hover:bg-green-700">
                        <MessageCircle className="size-4 mr-1" />Enviar WhatsApp
                      </Button>
                      <Button type="button" variant="outline" onClick={logCall}>
                        <PhoneCall className="size-4 mr-1" />Registrar ligação
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Textarea placeholder="Adicionar nota sobre este lead..." rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} />
                      <Button type="button" variant="secondary" onClick={logNote} disabled={!noteText.trim()}>
                        <StickyNote className="size-4 mr-1" />Salvar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {(activities ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma interação registrada ainda.</p>}
                    {(activities ?? []).map((a: any) => {
                      const Icon = ACTIVITY_ICON[a.type] ?? Clock;
                      return (
                        <div key={a.id} className="flex gap-3 text-sm border-l-2 border-primary/30 pl-3 py-1">
                          <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p>{a.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTimeBR(a.activity_date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
