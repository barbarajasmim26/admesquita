import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTenants } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send, Copy } from "lucide-react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["tenants"], queryFn: () => listTenants() });

export const Route = createFileRoute("/broadcast")({
  head: () => ({ meta: [{ title: "Disparo em grupo — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  component: Page,
});

const PRESETS: { id: string; label: string; body: string }[] = [
  { id: "fossa", label: "Manutenção de fossa", body: "Olá, {NOME}! Informamos que será feita a manutenção da fossa no condomínio. Foi lançada em seu nome a taxa de R$ {VALOR} referente ao serviço, com vencimento junto ao próximo aluguel. Pedimos a gentileza de manter os pagamentos em dia. Qualquer dúvida estamos à disposição." },
  { id: "cobranca", label: "Cobrança geral", body: "Olá, {NOME}. Consta em aberto o valor de R$ {VALOR} em seu nome. Favor regularizar. Qualquer dúvida estamos à disposição." },
  { id: "aviso", label: "Aviso geral", body: "Olá, {NOME}. Passando um comunicado importante: {MENSAGEM}. Qualquer dúvida estamos à disposição." },
];

function firstName(name: string) { return (name ?? "").trim().split(/\s+/)[0] ?? "vizinho(a)"; }
function digits(s: string) { return (s ?? "").replace(/\D/g, ""); }

function Page() {
  const { data: tenants } = useSuspenseQuery(opts);
  const groups = useMemo(() => {
    const m = new Map<string, { id: string; name: string; tenants: any[] }>();
    for (const t of tenants as any[]) {
      const p = t.properties;
      if (!p) continue;
      const g = m.get(p.id) ?? { id: p.id, name: p.name, tenants: [] };
      g.tenants.push(t);
      m.set(p.id, g);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tenants]);

  const [propertyId, setPropertyId] = useState<string>(() => groups[0]?.id ?? "");
  const [presetId, setPresetId] = useState("fossa");
  const [valor, setValor] = useState("50,00");
  const [extra, setExtra] = useState("");
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [template, setTemplate] = useState(preset.body);
  const group = groups.find(g => g.id === propertyId);
  const list = group?.tenants ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function applyPreset(id: string) {
    setPresetId(id);
    const p = PRESETS.find(x => x.id === id)!;
    setTemplate(p.body);
  }
  function toggleAll() {
    if (selected.size === list.length) setSelected(new Set());
    else setSelected(new Set(list.map((t: any) => t.id)));
  }
  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function renderMsg(t: any) {
    return template
      .replace(/\{NOME\}/g, firstName(t.name))
      .replace(/\{VALOR\}/g, valor || "")
      .replace(/\{MENSAGEM\}/g, extra || "");
  }
  function linkFor(t: any) {
    const p = digits(t.phone);
    if (!p) return null;
    const phone = p.startsWith("55") ? p : `55${p}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(renderMsg(t))}`;
  }
  function openAll() {
    const targets = list.filter((t: any) => (selected.size === 0 || selected.has(t.id)) && digits(t.phone));
    if (targets.length === 0) { toast.error("Nenhum destinatário com telefone."); return; }
    if (targets.length > 10 && !confirm(`Abrir ${targets.length} abas do WhatsApp?`)) return;
    let opened = 0, blocked = 0;
    for (const t of targets) {
      const url = linkFor(t);
      if (!url) continue;
      const w = window.open(url, "_blank");
      if (w) opened++; else blocked++;
    }
    if (blocked > 0) toast.warning(`${opened} abertas. ${blocked} bloqueadas pelo navegador — libere pop-ups.`);
    else toast.success(`${opened} conversas abertas.`);
  }
  function copyAll() {
    const targets = list.filter((t: any) => selected.size === 0 || selected.has(t.id));
    const text = targets.map((t: any) => `— ${t.name} (${t.phone ?? "sem telefone"})\n${renderMsg(t)}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Mensagens copiadas.");
  }

  return (
    <div>
      <PageHeader title="Disparo em grupo" description="Envia a mesma mensagem (personalizada com o nome) para todos os inquilinos de um imóvel/condomínio." />
      <div className="p-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Imóvel / Condomínio</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} · {g.tenants.length}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modelo</Label>
              <div className="space-y-1 mt-1">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => applyPreset(p.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted/50 ${presetId === p.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="50,00" />
            </div>
            <div>
              <Label>Texto livre (para {"{MENSAGEM}"})</Label>
              <Input value={extra} onChange={e => setExtra(e.target.value)} placeholder="opcional" />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Mensagem</span>
              <span className="text-xs text-muted-foreground font-normal">Placeholders: {"{NOME}"}, {"{VALOR}"}, {"{MENSAGEM}"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea rows={6} value={template} onChange={e => setTemplate(e.target.value)} />
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Pré-visualização (1º da lista)</div>
              <div className="whitespace-pre-wrap">{list[0] ? renderMsg(list[0]) : "—"}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Destinatários ({list.length})</div>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {selected.size === list.length && list.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
              </button>
            </div>
            <div className="border rounded max-h-80 overflow-y-auto divide-y">
              {list.map((t: any) => {
                const url = linkFor(t);
                const checked = selected.size === 0 || selected.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(t.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.phone ?? "sem telefone"}</div>
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <MessageCircle className="size-3" /> Abrir
                      </a>
                    ) : <span className="text-xs text-destructive">sem telefone</span>}
                  </div>
                );
              })}
              {list.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Sem inquilinos ativos neste imóvel.</div>}
            </div>

            <div className="flex gap-2">
              <Button onClick={openAll} disabled={list.length === 0}>
                <Send className="size-4 mr-1" /> Disparar em grupo
              </Button>
              <Button variant="outline" onClick={copyAll} disabled={list.length === 0}>
                <Copy className="size-4 mr-1" /> Copiar todas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O disparo abre uma aba do WhatsApp Web por inquilino, cada uma já com a mensagem preenchida. Se o navegador bloquear, autorize pop-ups.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}