import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listBotSuggestions, resolveBotSuggestion, setMonthStatus } from "@/lib/api/crm.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, MessageCircle, CheckCircle2, X, AlertTriangle, Clock, FileSignature, User, Sparkles, Loader2 } from "lucide-react";
import { waLink } from "@/lib/bot-templates";
import { toast } from "sonner";
import { brl } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["bot-suggestions"], queryFn: () => listBotSuggestions(), refetchInterval: 60_000 });

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

const typeMeta: Record<string, { label: string; icon: any; color: string }> = {
  overdue:           { label: "Atraso",            icon: AlertTriangle, color: "bg-destructive/15 text-destructive border-destructive/30" },
  due_soon:          { label: "Vencimento",        icon: Clock,         color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  contract_ending:   { label: "Contrato vencendo", icon: FileSignature, color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  receipt_pending:   { label: "Recibo",            icon: CheckCircle2,  color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
};

function Page() {
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();

  const resolve = async (s: any, status: "done" | "dismissed", message?: string) => {
    await resolveBotSuggestion({ data: { key: s.key, tenantId: s.tenantId, type: s.type, status, message } });
    toast.success(status === "done" ? "Marcado como feito" : "Dispensado");
    qc.invalidateQueries({ queryKey: ["bot-suggestions"] });
  };

  return (
    <div>
      <PageHeader title="Assistente" description={`${data.length} sugestão(ões) pendente(s) — você sempre confirma antes de qualquer ação`}
        actions={<Badge variant="outline" className="gap-1"><Bot className="size-3.5" />Confirma sempre</Badge>} />
      <div className="p-8 space-y-3">
        <QuickPaymentParser />
        {data.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <Bot className="size-10 mx-auto mb-3 opacity-50" />
            Nada pendente. O assistente notifica quando houver cobranças, vencimentos ou contratos a renovar.
          </Card>
        )}
        {data.map((s: any) => <SuggestionCard key={s.key} s={s} onResolve={resolve} />)}
      </div>
    </div>
  );
}

type ParsedAction = { tenantId: string; tenantName: string; year: number; month: number; status: "paid"; reason?: string };
type ParseResponse = { actions?: ParsedAction[]; ambiguous?: { input: string; candidates: { id: string; name: string }[] }[]; notes?: string; error?: string };

const MONTH_NAMES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function QuickPaymentParser() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [applying, setApplying] = useState(false);

  async function interpret() {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      // Reunir inquilinos ativos + histórico recente de pagamentos
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name, rent_amount, due_day, start_date, properties(name)")
        .eq("status", "active");
      const ids = (tenants ?? []).map(t => t.id);
      const since = new Date();
      since.setMonth(since.getMonth() - 6);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data: payments } = await supabase
        .from("payments")
        .select("tenant_id, due_date, paid_date, status, amount")
        .in("tenant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
        .gte("due_date", sinceStr);
      const byTenant: Record<string, any[]> = {};
      (payments ?? []).forEach((p: any) => {
        (byTenant[p.tenant_id] ||= []).push({
          year: Number(p.due_date.slice(0, 4)),
          month: Number(p.due_date.slice(5, 7)),
          status: p.status,
          paid_date: p.paid_date,
        });
      });
      const payload = {
        text,
        today: new Date().toISOString().slice(0, 10),
        tenants: (tenants ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          rent: Number(t.rent_amount ?? 0),
          due_day: t.due_day,
          property: t.properties?.name ?? null,
          payments: byTenant[t.id] ?? [],
        })),
      };
      const { data, error } = await supabase.functions.invoke("assistant-parse", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as ParseResponse);
      if (!(data as ParseResponse).actions?.length) {
        toast.info("Nenhum pagamento identificado. Tente reescrever.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao interpretar");
    } finally {
      setLoading(false);
    }
  }

  async function applyAll() {
    if (!result?.actions?.length) return;
    setApplying(true);
    let ok = 0, fail = 0;
    for (const a of result.actions) {
      try {
        await setMonthStatus({ tenantId: a.tenantId, year: a.year, month: a.month, status: a.status });
        ok++;
      } catch (e) {
        fail++;
      }
    }
    setApplying(false);
    if (ok) toast.success(`${ok} pagamento(s) registrado(s)`);
    if (fail) toast.error(`${fail} falha(s)`);
    setResult(null);
    setText("");
    qc.invalidateQueries();
  }

  function removeAction(i: number) {
    if (!result) return;
    const next = [...(result.actions ?? [])];
    next.splice(i, 1);
    setResult({ ...result, actions: next });
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <div className="font-semibold">Registrar pagamento por texto</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Escreva como se estivesse falando. Ex.: "Dice pagou hoje", "Maria pagou o aluguel de outubro", "João e Pedro pagaram".
          A IA identifica o inquilino e o mês (considerando histórico em atraso) e mostra para você confirmar antes de salvar.
        </p>
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ex.: Dice pagou agora, Maria pagou setembro, João pagou o atrasado"
          rows={3}
          disabled={loading}
        />
        <div className="flex gap-2">
          <Button onClick={interpret} disabled={loading || !text.trim()}>
            {loading ? <><Loader2 className="size-4 mr-1 animate-spin" />Interpretando...</> : <><Sparkles className="size-4 mr-1" />Interpretar</>}
          </Button>
          {result && <Button variant="ghost" onClick={() => { setResult(null); setText(""); }}>Limpar</Button>}
        </div>

        {result && (
          <div className="space-y-2 pt-2 border-t">
            {result.notes && <div className="text-xs text-muted-foreground italic">{result.notes}</div>}
            {!!result.actions?.length && (
              <>
                <div className="text-sm font-medium">Confirme os pagamentos abaixo:</div>
                <ul className="space-y-1.5">
                  {result.actions.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-md border p-2 bg-emerald-500/5">
                      <div className="text-sm">
                        <strong>{a.tenantName}</strong> — pago referente a <strong>{MONTH_NAMES[a.month - 1]}/{a.year}</strong>
                        {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeAction(i)}><X className="size-4" /></Button>
                    </li>
                  ))}
                </ul>
                <Button onClick={applyAll} disabled={applying} className="w-full">
                  {applying ? <><Loader2 className="size-4 mr-1 animate-spin" />Salvando...</> : <><CheckCircle2 className="size-4 mr-1" />Confirmar e marcar como pagos</>}
                </Button>
              </>
            )}
            {!!result.ambiguous?.length && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-sm space-y-1">
                <div className="font-medium flex items-center gap-1"><AlertTriangle className="size-4" />Ambiguidades</div>
                {result.ambiguous.map((a, i) => (
                  <div key={i} className="text-xs">
                    "{a.input}" pode ser: {a.candidates.map(c => c.name).join(", ")}. Reescreva com mais detalhe.
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ s, onResolve }: { s: any; onResolve: (s: any, status: "done" | "dismissed", message?: string) => void }) {
  const [msg, setMsg] = useState(s.message);
  const [editing, setEditing] = useState(false);
  const meta = typeMeta[s.type] ?? { label: s.type, icon: Bot, color: "bg-muted" };
  const Icon = meta.icon;
  const link = waLink(s.tenantPhone, msg);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className={`size-10 rounded-lg flex items-center justify-center border ${meta.color}`}><Icon className="size-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold">{s.title}</span>
              <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
              {s.amount != null && <Badge variant="secondary">{brl(s.amount)}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.subtitle}</div>
          </div>
          <Link to="/inquilinos/$id" params={{ id: s.tenantId }} className="text-xs text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1">
            <User className="size-3" /> perfil
          </Link>
        </div>

        {editing ? (
          <Textarea value={msg} onChange={e => setMsg(e.target.value)} rows={6} className="text-sm" />
        ) : (
          <pre className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3 font-sans">{msg}</pre>
        )}

        <div className="flex flex-wrap gap-2">
          {link ? (
            <Button asChild size="sm">
              <a href={link} target="_blank" rel="noreferrer"><MessageCircle className="size-4 mr-1" />Enviar no WhatsApp</a>
            </Button>
          ) : (
            <Button size="sm" disabled><MessageCircle className="size-4 mr-1" />Sem telefone</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(e => !e)}>
            {editing ? "Fechar edição" : "Editar mensagem"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onResolve(s, "done", msg)}>
            <CheckCircle2 className="size-4 mr-1" />Marcar feito
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onResolve(s, "dismissed")}>
            <X className="size-4 mr-1" />Dispensar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}