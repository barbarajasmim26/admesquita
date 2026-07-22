import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listTenants } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Copy, Send } from "lucide-react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["tenants"], queryFn: () => listTenants() });

export const Route = createFileRoute("/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

const TEMPLATES: { id: string; label: string; body: string }[] = [
  { id: "cobranca", label: "Cobrança", body: "Olá, {NOME}. Identificamos que o aluguel referente ao mês {MES} encontra-se pendente. Favor verificar. Qualquer dúvida estamos à disposição." },
  { id: "confirmacao", label: "Confirmação de pagamento", body: "Olá, {NOME}! Confirmamos o recebimento do aluguel referente a {MES}. Obrigado!" },
  { id: "recibo", label: "Envio de recibo", body: "Olá, {NOME}, segue em anexo o recibo do aluguel de {MES}. Qualquer dúvida estamos à disposição." },
  { id: "contrato_vence", label: "Contrato vencendo", body: "Olá, {NOME}. Informamos que seu contrato de locação vence em breve. Vamos agendar a renovação?" },
  { id: "renovacao", label: "Renovação", body: "Olá, {NOME}. Estamos preparando a renovação do seu contrato. Em breve enviaremos o novo documento para sua assinatura." },
  { id: "vistoria", label: "Agendamento de vistoria", body: "Olá, {NOME}. Gostaríamos de agendar uma vistoria no imóvel. Qual o melhor dia/horário para você?" },
  { id: "boasvindas", label: "Boas-vindas", body: "Seja bem-vindo(a), {NOME}! É um prazer tê-lo(a) como inquilino(a). Qualquer necessidade estamos à disposição." },
];

function Page() {
  const { data: tenants } = useSuspenseQuery(opts);
  const [tplId, setTplId] = useState("cobranca");
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return d.toLocaleString("pt-BR", { month: "long" });
  });

  const tpl = TEMPLATES.find(t => t.id === tplId)!;
  const [template, setTemplate] = useState(tpl.body);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set((tenants as any[]).map((t: any) => t.id)));
  const [groupLink, setGroupLink] = useState<string>(() => (typeof localStorage !== "undefined" ? localStorage.getItem("wa_group_link") ?? "" : ""));

  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const arr = (tenants as any[]).slice().sort((a: any, b: any) => a.name.localeCompare(b.name));
    if (!f) return arr;
    return arr.filter((t: any) => t.name.toLowerCase().includes(f) || (t.properties?.name ?? "").toLowerCase().includes(f));
  }, [tenants, filter]);

  function applyPreset(id: string) {
    setTplId(id);
    setTemplate(TEMPLATES.find(x => x.id === id)!.body);
  }
  function firstName(n: string) { return (n ?? "").trim().split(/\s+/)[0] ?? ""; }
  function digits(s: string) { return (s ?? "").replace(/\D/g, ""); }
  function renderMsg(t: any) {
    return template.replace(/\{NOME\}/g, firstName(t.name) || "[Nome]").replace(/\{MES\}/g, mes);
  }
  function linkFor(t: any) {
    const p = digits(t.phone);
    if (!p) return null;
    const phone = p.startsWith("55") ? p : `55${p}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(renderMsg(t))}`;
  }
  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }
  function toggleAll() {
    if (list.every((t: any) => selected.has(t.id))) {
      const n = new Set(selected);
      list.forEach((t: any) => n.delete(t.id));
      setSelected(n);
    } else {
      const n = new Set(selected);
      list.forEach((t: any) => n.add(t.id));
      setSelected(n);
    }
  }
  function sendAll() {
    const link = groupLink.trim();
    if (!link) { toast.error("Cole o link do grupo de anúncio do WhatsApp."); return; }
    localStorage.setItem("wa_group_link", link);
    const msg = template.replace(/\{NOME\}/g, "pessoal").replace(/\{MES\}/g, mes);
    navigator.clipboard.writeText(msg).catch(() => {});
    const w = window.open(link, "_blank");
    if (!w) toast.warning("Pop-up bloqueado — libere pop-ups. A mensagem foi copiada.");
    else toast.success("Grupo aberto e mensagem copiada — cole (Ctrl+V) e envie.");
  }
  function copyAll() {
    const targets = (tenants as any[]).filter((t: any) => selected.has(t.id));
    const text = targets.map((t: any) => `— ${t.name} (${t.phone ?? "sem telefone"})\n${renderMsg(t)}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Mensagens copiadas.");
  }

  const preview = list[0] ? renderMsg(list[0]) : "";
  const selectedCount = (tenants as any[]).filter((t: any) => selected.has(t.id)).length;
  const withPhone = (tenants as any[]).filter((t: any) => selected.has(t.id) && digits(t.phone)).length;

  return (
    <div>
      <PageHeader title="WhatsApp" description="Envie a mesma mensagem para todos os inquilinos selecionados de uma vez." />
      <div className="p-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Modelos</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => applyPreset(t.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted/50 ${tplId === t.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                {t.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{tpl.label}</span>
              <span className="text-xs text-muted-foreground font-normal">Placeholders: {"{NOME}"}, {"{MES}"}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Mês de referência</Label>
              <Input value={mes} onChange={e => setMes(e.target.value)} />
            </div>
            <div>
              <Label>Mensagem (editável)</Label>
              <Textarea rows={6} value={template} onChange={e => setTemplate(e.target.value)} />
            </div>
            <div className="rounded border bg-muted/30 p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">Pré-visualização (1º da lista)</div>
              <div className="whitespace-pre-wrap">{preview || "—"}</div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Destinatários ({selectedCount} selecionados · {withPhone} com telefone)</div>
              <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
                {list.every((t: any) => selected.has(t.id)) ? "Desmarcar visíveis" : "Selecionar visíveis"}
              </button>
            </div>
            <div>
              <Label>Link do grupo de anúncio (WhatsApp)</Label>
              <Input
                placeholder="https://chat.whatsapp.com/XXXXXXXXXXXX"
                value={groupLink}
                onChange={e => setGroupLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                No WhatsApp: abra o grupo → Info do grupo → Convidar por link → Copiar link. Cole aqui uma vez.
              </p>
            </div>
            <Input placeholder="Filtrar por nome ou imóvel..." value={filter} onChange={e => setFilter(e.target.value)} />
            <div className="border rounded max-h-80 overflow-y-auto divide-y">
              {list.map((t: any) => {
                const url = linkFor(t);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 text-sm">
                    <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{t.name} {t.properties?.name ? <span className="text-muted-foreground">· {t.properties.name}</span> : null}</div>
                      <div className="text-xs text-muted-foreground">{t.phone ?? "sem telefone"}</div>
                    </div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        <MessageCircle className="size-3" /> Abrir
                      </a>
                    ) : <span className="text-xs text-destructive">sem telefone</span>}
                  </div>
                );
              })}
              {list.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Nenhum inquilino.</div>}
            </div>

            <div className="flex gap-2">
              <Button onClick={sendAll} disabled={!groupLink.trim()}>
                <Send className="size-4 mr-1" /> Enviar no grupo de anúncio
              </Button>
              <Button variant="outline" onClick={copyAll} disabled={selectedCount === 0}>
                <Copy className="size-4 mr-1" /> Copiar todas
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              "Enviar no grupo" abre o grupo de anúncio no WhatsApp Web e copia a mensagem para a área de transferência — basta colar (Ctrl+V) e enviar uma única vez para todos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
