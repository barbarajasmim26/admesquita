import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getDailyOverview, setRenewal } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl, formatDateBR, daysLate } from "@/lib/finance";
import { chargeMessage, overdueMessage, waLink } from "@/lib/bot-templates";
import { MonthPanel } from "@/components/MonthPanel";
import { Check, AlertTriangle, Clock, MessageCircle, RefreshCw, Loader2, Search, Repeat, XCircle, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hoje")({
  head: () => ({ meta: [{ title: "Hoje — Mesquita Imóveis" }] }),
  component: Page,
});

type Filter = "todos" | "pagos" | "atrasados" | "a_vencer" | "costuma_atrasar" | "renovacao";

const STATUS = {
  paid: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40", Icon: Check },
  overdue: { label: "Atrasado", cls: "bg-rose-500/15 text-rose-700 border-rose-500/40", Icon: AlertTriangle },
  pending: { label: "A vencer", cls: "bg-amber-500/15 text-amber-800 border-amber-500/40", Icon: Clock },
  sem_cobranca: { label: "Sem cobrança", cls: "bg-muted text-muted-foreground border-border", Icon: Clock },
} as any;

const RENEW = {
  indefinido: { label: "Renovação: ?", Icon: HelpCircle, cls: "text-muted-foreground" },
  renova: { label: "Vai renovar", Icon: Repeat, cls: "text-emerald-600" },
  nao_renova: { label: "Não vai renovar", Icon: XCircle, cls: "text-rose-600" },
} as any;

function Page() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ["daily"], queryFn: () => getDailyOverview() });
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");

  const rows = (data ?? []) as any[];
  const counts = useMemo(() => ({
    todos: rows.length,
    pagos: rows.filter(r => r.currentStatus === "paid").length,
    atrasados: rows.filter(r => r.overdueCount > 0).length,
    a_vencer: rows.filter(r => r.currentStatus === "pending").length,
    costuma_atrasar: rows.filter(r => r.behavior === "costuma_atrasar").length,
    renovacao: rows.filter(r => r.daysToEnd != null && r.daysToEnd <= 90).length,
  }), [rows]);

  const list = rows.filter(r => {
    if (q && !`${r.name} ${r.properties?.name ?? ""} ${r.house_number ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    switch (filter) {
      case "pagos": return r.currentStatus === "paid";
      case "atrasados": return r.overdueCount > 0;
      case "a_vencer": return r.currentStatus === "pending";
      case "costuma_atrasar": return r.behavior === "costuma_atrasar";
      case "renovacao": return r.daysToEnd != null && r.daysToEnd <= 90;
      default: return true;
    }
  }).sort((a, b) => (b.overdueTotal - a.overdueTotal) || a.name.localeCompare(b.name));

  async function renew(r: any, status: string) {
    if (!r.contract) { toast.error("Sem contrato ativo"); return; }
    let newAmount: number | null = r.contract.new_rent_amount ?? null;
    if (status === "renova") {
      const v = prompt(`Novo valor do aluguel de ${r.name} (deixe vazio para manter ${brl(r.rent_amount)}):`, newAmount ? String(newAmount) : "");
      if (v === null) return;
      newAmount = v.trim() ? Number(v.replace(",", ".")) : null;
    }
    try {
      await setRenewal({ contractId: r.contract.id, renewalStatus: status, newRentAmount: newAmount });
      toast.success("Atualizado");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  function charge(r: any) {
    const first = r.name.split(" ")[0];
    const now = new Date();
    const msg = r.overdueCount > 0
      ? overdueMessage({ name: first, amount: r.overdueTotal, daysLate: r.current ? daysLate(r.current.due_date) : 0, pix: r.pix_payer })
      : chargeMessage({ name: first, amount: Number(r.current?.amount ?? r.rent_amount), year: now.getFullYear(), month: now.getMonth() + 1, pix: r.pix_payer, dueDay: r.due_day });
    const l = waLink(r.phone, msg);
    if (!l) { toast.error("Sem telefone cadastrado"); return; }
    window.open(l, "_blank");
  }

  const chips: { id: Filter; label: string; tone: string }[] = [
    { id: "todos", label: "Todos", tone: "" },
    { id: "pagos", label: "Pagaram este mês", tone: "text-emerald-700" },
    { id: "a_vencer", label: "A vencer", tone: "text-amber-700" },
    { id: "atrasados", label: "Atrasados", tone: "text-rose-700" },
    { id: "costuma_atrasar", label: "Costumam atrasar", tone: "text-orange-700" },
    { id: "renovacao", label: "Contrato vence em 90 dias", tone: "text-primary" },
  ];

  return (
    <div>
      <PageHeader
        title={`Hoje — ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}`}
        description="Situação de cada inquilino, atualizada automaticamente todos os dias."
        actions={<Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Atualizar
        </Button>}
      />
      <div className="p-4 sm:p-8 space-y-6">
        <MonthPanel />

        <div className="flex flex-wrap gap-2">
          {chips.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${filter === c.id ? "bg-primary text-primary-foreground border-primary" : `bg-card hover:bg-accent ${c.tone}`}`}>
              {c.label} <span className="opacity-70">({(counts as any)[c.id]})</span>
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar inquilino, imóvel ou casa..." value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> carregando...</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map(r => {
              const st = STATUS[r.currentStatus] ?? STATUS.sem_cobranca;
              const rn = RENEW[r.contract?.renewal_status ?? "indefinido"] ?? RENEW.indefinido;
              const total = r.paidOnTime + r.paidLate;
              return (
                <Card key={r.id} className={r.overdueCount > 0 ? "border-rose-400/60" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link to="/inquilinos/$id" params={{ id: r.id }} className="min-w-0 hover:underline">
                        <p className="font-semibold truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.properties?.name}{r.house_number ? ` • casa ${r.house_number}` : ""} • dia {r.due_day}</p>
                      </Link>
                      <Badge variant="outline" className={`gap-1 shrink-0 ${st.cls}`}><st.Icon className="size-3" />{st.label}</Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground">Aluguel</p>
                        <p className="font-semibold">{brl(r.rent_amount)}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground">Em atraso</p>
                        <p className={`font-semibold ${r.overdueTotal ? "text-rose-600" : ""}`}>{r.overdueTotal ? brl(r.overdueTotal) : "—"}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground">Pontualidade</p>
                        <p className="font-semibold">{total ? `${Math.round((r.paidOnTime / total) * 100)}%` : "—"}</p>
                      </div>
                    </div>

                    <div className="text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                      {r.behavior === "costuma_atrasar" && <span className="text-orange-600 font-medium">⚠ costuma atrasar</span>}
                      {r.contract?.end_date && (
                        <span className={r.daysToEnd != null && r.daysToEnd <= 60 ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                          Contrato até {formatDateBR(r.contract.end_date)}{r.daysToEnd != null && r.daysToEnd >= 0 ? ` (${r.daysToEnd}d)` : r.daysToEnd != null ? " (vencido)" : ""}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 ${rn.cls}`}><rn.Icon className="size-3" />{rn.label}</span>
                      {r.contract?.new_rent_amount && (
                        <span className="text-primary font-medium">Novo valor: {brl(r.contract.new_rent_amount)}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => charge(r)}>
                        <MessageCircle className="size-3.5 text-emerald-600" />{r.overdueCount ? "Cobrar" : "Lembrar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => renew(r, "renova")}>Renova</Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => renew(r, "nao_renova")}>Não renova</Button>
                      <Button size="sm" variant="ghost" className="h-8" asChild>
                        <Link to="/inquilinos/$id" params={{ id: r.id }}>Abrir</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {list.length === 0 && <Card className="p-8 text-center text-muted-foreground sm:col-span-2 xl:col-span-3">Nenhum inquilino neste filtro.</Card>}
          </div>
        )}
      </div>
    </div>
  );
}
