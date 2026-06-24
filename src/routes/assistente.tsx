import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente — Mesquita Imóveis" }] }),
  component: Page,
});

type Msg = { role: "user" | "assistant"; content: string };
const STORAGE_KEY = "mesquita.assistant.messages.v1";

const QUICK_PROMPTS = [
  "Quem está inadimplente?",
  "Quais imóveis estão vazios?",
  "Contratos vencendo nos próximos 60 dias",
  "Quem pagou esse mês?",
];

function Page() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply ?? "(sem resposta)";
      setMessages([...next, { role: "assistant", content: reply }]);
      // Invalida queries para refletir mudanças (pagamentos, ex-inquilinos, etc.)
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
      setMessages([...next, { role: "assistant", content: `❌ ${e.message ?? "erro"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function clearChat() {
    if (!confirm("Limpar toda a conversa?")) return;
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Assistente"
        description="Converse naturalmente: registre pagamentos, encerre contratos, gere recibos, consulte qualquer informação."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Bot className="size-3.5" />Operacional</Badge>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat}>
                <Trash2 className="size-4 mr-1" />Limpar
              </Button>
            )}
          </div>
        }
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 bg-muted/20">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center space-y-4 pt-12">
            <div className="size-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escreva como falaria com um funcionário. O sistema entende e executa.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-4">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)}
                  className="text-left text-sm border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <div className="max-w-xl mx-auto text-xs text-muted-foreground space-y-1 pt-6 text-left bg-card border rounded-lg p-4">
              <p className="font-medium text-foreground">Exemplos de comandos:</p>
              <p>• "Dice pagou hoje" — marca o mês em aberto mais antigo</p>
              <p>• "Maria pagou outubro" — marca mês específico</p>
              <p>• "João saiu do imóvel" — encerra contrato</p>
              <p>• "Gera mensagem de cobrança pro Pedro"</p>
              <p>• "Histórico do Carlos"</p>
              <p>• "Cria cobrança extra de R$ 200 pro Bruno para dia 30"</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {loading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 bg-card border text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> pensando...
            </div>
          </div>
        )}
      </div>
      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder='Ex: "Dice pagou hoje", "quem está atrasado?", "gera cobrança pro João"'
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="size-11 shrink-0">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Enter envia • Shift+Enter quebra linha • O assistente executa ações diretamente no sistema
        </p>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
      <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <Card className={isUser ? "bg-primary text-primary-foreground" : ""}>
        <CardContent className="p-3 text-sm">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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