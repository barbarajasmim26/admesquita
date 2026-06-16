import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listBotSuggestions, resolveBotSuggestion } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, MessageCircle, CheckCircle2, X, AlertTriangle, Clock, FileSignature, User } from "lucide-react";
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