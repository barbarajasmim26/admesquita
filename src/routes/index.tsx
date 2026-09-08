import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getDashboard } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { MonthPanel } from "@/components/MonthPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, formatDateBR } from "@/lib/finance";
import { Home, Users, Wallet, AlertTriangle, Building2, FileSignature, TrendingUp, UserMinus } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const dashOpts = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashOpts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: DashboardPage,
});

function StatCard({ icon: Icon, label, value, hint, tone, to }: any) {
  const tones: any = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    warning: "text-warning-foreground bg-warning/20",
  };
  const inner = (
    <Card className={to ? "hover:border-primary/50 hover:shadow-md transition cursor-pointer" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={`size-10 rounded-lg flex items-center justify-center ${tones[tone ?? "primary"]}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function DashboardPage() {
  const { data } = useSuspenseQuery(dashOpts);
  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da operação" />
      <div className="p-8 space-y-6">
        <MonthPanel />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Home} label="Imóveis" value={String(data.properties)} hint={`${data.condominios} condomínio(s)`} tone="primary" to="/imoveis" />
          <StatCard icon={Users} label="Inquilinos ativos" value={String(data.activeTenants)} hint={`${data.overdueTenants} inadimplentes`} tone="success" to="/inquilinos" />
          <StatCard icon={Wallet} label="Recebido no mês" value={brl(data.receitaMes)} hint={`Previsto: ${brl(data.previstoMes)}`} tone="success" to="/financeiro" />
          <StatCard icon={AlertTriangle} label="Inadimplência" value={brl(data.inadimplencia)} hint={`${data.overdueCount} cobrança(s)`} tone="destructive" to="/inadimplencia" />
          <StatCard icon={Building2} label="Condomínios" value={String(data.condominios)} tone="primary" to="/imoveis" />
          <StatCard icon={FileSignature} label="Contratos vencendo" value={String(data.contractsEndingSoon)} hint="próximos 30 dias" tone="warning" to="/contratos" />
          <StatCard icon={UserMinus} label="Ex-inquilinos" value={String(data.formerTenants)} tone="primary" to="/ex-inquilinos" />
          <StatCard icon={TrendingUp} label="Pendentes" value={String(data.pendingCount)} hint="cobranças em aberto" tone="warning" to="/financeiro" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Receita — últimos 6 meses</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => brl(Number(v))} />
                    <Bar dataKey="total" fill="oklch(0.32 0.12 263)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Próximos vencimentos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.proximosVencimentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vencimento próximo.</p>}
              {data.proximosVencimentos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{formatDateBR(p.due_date)}</span>
                  <span className="font-medium">{brl(p.amount)}</span>
                </div>
              ))}
              <Link to="/calendario" className="block text-sm text-primary hover:underline pt-2">Ver calendário →</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
