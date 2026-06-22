// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@/lib/rpc";
import { listTasks, upsertTask, toggleTaskStatus, deleteTask } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["tasks"], queryFn: () => listTasks({ data: {} }) });

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();
  const save = useServerFn(upsertTask);
  const toggle = useServerFn(toggleTaskStatus);
  const del = useServerFn(deleteTask);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ priority: "normal" });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = data.filter((t: any) => t.status !== "done" && t.due_date < today);
  const todays = data.filter((t: any) => t.status !== "done" && t.due_date === today);
  const upcoming = data.filter((t: any) => t.status !== "done" && t.due_date > today);
  const done = data.filter((t: any) => t.status === "done");

  async function submit() {
    if (!form.title || !form.dueDate) { toast.error("Título e data são obrigatórios"); return; }
    await save({ data: form });
    toast.success("Tarefa criada");
    qc.invalidateQueries({ queryKey: ["tasks"] });
    setForm({ priority: "normal" });
    setOpen(false);
  }
  async function onToggle(t: any) {
    await toggle({ data: { id: t.id, status: t.status === "done" ? "pending" : "done" } });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const PRIO_COLOR: Record<string, string> = { alta: "bg-rose-500", normal: "bg-blue-500", baixa: "bg-slate-400" };

  const Section = ({ title, items, color }: { title: string; items: any[]; color: string }) => (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${color}`} />
        <h2 className="font-semibold">{title}</h2>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground pl-4">Nenhuma tarefa</p> : (
        <div className="space-y-1.5">
          {items.map((t: any) => (
            <Card key={t.id} className="p-3 flex items-center gap-3 group">
              <Checkbox checked={t.status === "done"} onCheckedChange={() => onToggle(t)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3" />{formatDateBR(t.due_date)}</span>
                  <span className={`size-1.5 rounded-full ${PRIO_COLOR[t.priority] ?? PRIO_COLOR.normal}`} />
                  {t.tenants && <span>· {t.tenants.name}</span>}
                  {t.leads && <span>· Lead: {t.leads.name}</span>}
                  {t.properties && <span>· {t.properties.name}</span>}
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div>
      <PageHeader
        title="Agenda de Tarefas"
        description={`${overdue.length} atrasada(s) · ${todays.length} hoje · ${upcoming.length} próximas`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Nova tarefa</Button>}
      />
      <div className="p-8 space-y-6 max-w-3xl">
        {overdue.length > 0 && <Section title="Atrasadas" items={overdue} color="bg-rose-500" />}
        <Section title="Hoje" items={todays} color="bg-amber-500" />
        <Section title="Próximas" items={upcoming} color="bg-blue-500" />
        {done.length > 0 && <Section title="Concluídas" items={done.slice(0, 10)} color="bg-green-600" />}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div><Label>Título *</Label><Input value={form.title ?? ""} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data *</Label><Input type="date" value={form.dueDate ?? ""} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority ?? "normal"} onValueChange={v => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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