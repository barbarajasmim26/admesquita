import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMonthPanel } from "@/lib/api/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, formatDateBR, daysLate } from "@/lib/finance";
import { overdueMessage, chargeMessage, waLink } from "@/lib/bot-templates";
import { downloadMonthlyReport } from "@/lib/monthly-report-pdf";
import { ChevronLeft, ChevronRight, MessageCircle, FileDown, AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MonthPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["month-panel", year, month],
    queryFn: () => getMonthPanel({ year, month }),
  });

  function shift(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  function chargeAll() {
    if (!data?.overdue?.length) return;
    const links = data.overdue
      .map((p: any) => waLink(p.tenants?.phone, overdueMessage({
        name: (p.tenants?.name ?? "").split(" ")[0],
        amount: Number(p.amount ?? 0),
        daysLate: daysLate(p.due_date),
        pix: p.tenants?.pix_payer,
      })))
      .filter(Boolean) as string[];
    if (!links.length) { toast.error("Nenhum inquilino atrasado tem telefone cadastrado."); return; }
    links.forEach((l, i) => setTimeout(() => window.open(l, "_blank"), i * 400));
    toast.success(`Abrindo ${links.length} conversa(s) no WhatsApp`);
  }

  function chargeOne(p: any, kind: "overdue" | "pending") {
    const first = (p.tenants?.name ?? "").split(" ")[0];
    const msg = kind === "overdue"
      ? overdueMessage({ name: first, amount: Number(p.amount ?? 0), daysLate: daysLate(p.due_date), pix: p.tenants?.pix_payer })
      : chargeMessage({ name: first, amount: Number(p.amount ?? 0), year, month, pix: p.tenants?.pix_payer, dueDay: p.tenants?.due_day });
    const l = waLink(p.tenants?.phone, msg);
    if (!l) { toast.error("Inquilino sem telefone cadastrado."); return; }
    window.open(l, "_blank");
  }

  async function baixarPdf() {
    if (!data) return;
    setBusy(true);
    try {
      await downloadMonthlyReport(data as any);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar o relatório");
    } finally {
      setBusy(false);
    }
  }

  const pct = data && data.previsto > 0 ? Math.min(100, Math.round((data.recebido / data.previsto) * 100)) : 0;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
        <CardTitle className="text-base">Painel de {MONTHS[month - 1]} / {year}</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>hoje</Button>
          <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="size-4 animate-spin" /> carregando...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Mini label="Já entrou" value={brl(data.recebido)} tone="text-emerald-600" />
              <Mini label="Ainda falta" value={brl(data.falta)} tone="text-rose-600" />
              <Mini label="Despesas" value={brl(data.despesas)} tone="text-amber-600" />
              <Mini label="Sobrou" value={brl(data.lucro)} tone={data.lucro >= 0 ? "text-emerald-600" : "text-rose-600"} />
            </div>

            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{data.paidCount} de {data.totalCount} aluguéis pagos</span>
                <span>{pct}% do previsto ({brl(data.previsto)})</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={chargeAll} disabled={!data.overdue.length} className="gap-2">
                <MessageCircle className="size-4" />
                Cobrar todos os atrasados ({data.overdue.length})
              </Button>
              <Button size="sm" variant="outline" onClick={baixarPdf} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
                Relatório do mês (PDF)
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Bloco
                icon={<AlertTriangle className="size-4 text-rose-500" />}
                title={`Atrasados (${data.overdue.length})`}
                empty="Ninguém atrasado neste mês. 🎉"
                rows={data.overdue}
                right={(p: any) => `${daysLate(p.due_date)}d`}
                onClick={(p: any) => chargeOne(p, "overdue")}
              />
              <Bloco
                icon={<CalendarClock className="size-4 text-amber-500" />}
                title={`Vence nos próximos 7 dias (${data.dueThisWeek.length})`}
                empty="Nada vencendo esta semana."
                rows={data.dueThisWeek}
                right={(p: any) => formatDateBR(p.due_date)}
                onClick={(p: any) => chargeOne(p, "pending")}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Bloco({ icon, title, rows, empty, right, onClick }: any) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2 border-b text-sm font-medium">{icon}{title}</div>
      <div className="max-h-56 overflow-y-auto divide-y">
        {rows.length === 0 && <p className="text-sm text-muted-foreground p-3">{empty}</p>}
        {rows.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{p.tenants?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {p.tenants?.properties?.name}{p.tenants?.house_number ? ` • casa ${p.tenants.house_number}` : ""} • {brl(p.amount)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{right(p)}</span>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => onClick(p)}>
                <MessageCircle className="size-4 text-emerald-600" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
