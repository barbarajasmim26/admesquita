import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listOverdueByTenant } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, daysLate, formatDateBR } from "@/lib/finance";
import { MessageCircle, AlertTriangle, Calendar, User, Building2, TrendingDown } from "lucide-react";

const opts = queryOptions({ queryKey: ["overdue"], queryFn: () => listOverdueByTenant() });

export const Route = createFileRoute("/inadimplencia")({
  head: () => ({ meta: [{ title: "Inadimplência — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function severityClasses(days: number) {
  if (days >= 60) return { ring: "border-destructive/60 bg-destructive/5", chip: "bg-destructive text-destructive-foreground", label: "Crítico" };
  if (days >= 30) return { ring: "border-orange-400/60 bg-orange-50 dark:bg-orange-950/20", chip: "bg-orange-500 text-white", label: "Alto" };
  if (days >= 10) return { ring: "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20", chip: "bg-amber-500 text-white", label: "Médio" };
  return { ring: "border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/20", chip: "bg-yellow-400 text-black", label: "Recente" };
}

function Page() {
  const { data } = useSuspenseQuery(opts);
  const totalDue = data.reduce((a: number, r: any) => a + Number(r.total), 0);
  const totalParc = data.reduce((a: number, r: any) => a + Number(r.count), 0);

  return (
    <div>
      <PageHeader title="Inadimplência" description={`${data.length} inquilino(s) com cobranças vencidas`} />
      <div className="p-8 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard icon={<User className="size-5" />} label="Inquilinos" value={String(data.length)} tone="destructive" />
          <SummaryCard icon={<Calendar className="size-5" />} label="Parcelas vencidas" value={String(totalParc)} tone="warning" />
          <SummaryCard icon={<TrendingDown className="size-5" />} label="Total devido" value={brl(totalDue)} tone="primary" />
        </div>

        {data.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <div className="text-4xl mb-2">🎉</div>
            Nenhuma inadimplência! Todos em dia.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((row: any) => {
              const phone = (row.tenant?.phone ?? "").replace(/\D/g, "");
              const days = daysLate(row.oldest);
              const sev = severityClasses(days);
              const msg = encodeURIComponent(
                `Olá ${row.tenant?.name}, identificamos ${row.count} parcela(s) de aluguel em aberto, total ${brl(row.total)}. Por favor, regularize. Obrigado.`
              );
              return (
                <Card key={row.tenant?.id} className={`border-2 ${sev.ring} transition hover:shadow-md`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to="/inquilinos/$id" params={{ id: row.tenant.id }} className="font-semibold hover:underline truncate block">
                          {row.tenant?.name}
                        </Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="size-3" /> {row.tenant?.properties?.name ?? "—"}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${sev.chip} shrink-0`}>{sev.label}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Metric icon={<AlertTriangle className="size-3" />} value={String(row.count)} label="parc." />
                      <Metric icon={<Calendar className="size-3" />} value={String(days)} label="dias" />
                      <Metric value={brl(row.total)} label="devido" highlight />
                    </div>

                    <p className="text-[11px] text-muted-foreground">Vencimento mais antigo: {formatDateBR(row.oldest)}</p>

                    {phone && (
                      <Button asChild size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <a href={`https://wa.me/55${phone}?text=${msg}`} target="_blank" rel="noreferrer">
                          <MessageCircle className="size-4 mr-1" />Cobrar via WhatsApp
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "primary" | "warning" | "destructive" }) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`size-10 rounded-lg flex items-center justify-center ${colors}`}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, value, label, highlight }: { icon?: React.ReactNode; value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md py-1.5 ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
      <div className={`text-sm font-bold flex items-center justify-center gap-1 ${highlight ? "text-primary" : ""}`}>
        {icon}{value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
    </div>
  );
}
