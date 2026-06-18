import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getReports, exportAll } from "@/lib/api/crm.functions";
import { useServerFn } from "@/lib/rpc";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/finance";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Wallet, Building2, FileDown } from "lucide-react";

const opts = queryOptions({ queryKey: ["reports"], queryFn: () => getReports() });

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const runExport = useServerFn(exportAll);

  function exportCSV() {
    const rows = [
      ["Mês", "Recebido", "Despesas", "Lucro"],
      ...data.cashflow.map((c: any) => [c.month, c.received, c.expenses, c.profit]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fluxo_caixa_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function exportJSON() {
    const all = await runExport();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup_mesquita_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Visão financeira e operacional"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}><FileDown className="size-4 mr-1" />CSV</Button>
            <Button onClick={exportJSON}><FileDown className="size-4 mr-1" />Backup completo (JSON)</Button>
          </div>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCard label="Total Recebido" value={brl(data.totalReceived)} icon={TrendingUp} color="text-green-600" />
          <KpiCard label="Inadimplência" value={brl(data.totalOverdue)} icon={TrendingDown} color="text-rose-600" />
          <KpiCard label="Despesas" value={brl(data.totalExpenses)} icon={Wallet} color="text-amber-600" />
          <KpiCard label="Lucro Líquido" value={brl(data.profit)} icon={TrendingUp} color={data.profit >= 0 ? "text-green-600" : "text-rose-600"} />
        </div>

        <Card>
          <CardHeader><CardTitle>Fluxo de Caixa</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            {data.cashflow.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cashflow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v: any) => brl(Number(v))} />
                  <Legend />
                  <Bar dataKey="received" name="Recebido" fill="#16a34a" />
                  <Bar dataKey="expenses" name="Despesas" fill="#f43f5e" />
                  <Bar dataKey="profit" name="Lucro" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Ocupação por Imóvel</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.occupancyByProperty.map((o: any) => (
                <div key={o.property} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{o.property}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${Math.min(100, o.tenants * 10)}%` }} />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">{o.tenants} inq.</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className={`size-4 ${color}`} />
        </div>
        <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
