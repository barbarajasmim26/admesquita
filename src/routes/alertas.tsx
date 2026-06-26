// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listAlerts, listOverdueByTenant, getPaymentForReceipt } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, MessageCircle, CheckCircle2, User } from "lucide-react";
import { formatDateBR, brl } from "@/lib/finance";
import { PayDialog } from "@/components/PayDialog";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["alerts"], queryFn: () => listAlerts() });
const overdueOpts = queryOptions({ queryKey: ["overdue"], queryFn: () => listOverdueByTenant() });

export const Route = createFileRoute("/alertas")({
  head: () => ({ meta: [{ title: "Alertas — Mesquita Imóveis" }] }),
  loader: ({ context }) => Promise.all([
    context.queryClient.ensureQueryData(opts),
    context.queryClient.ensureQueryData(overdueOpts),
  ]),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data: alerts } = useSuspenseQuery(opts);
  const { data: overdueTenants } = useSuspenseQuery(overdueOpts);
  const [payOpen, setPayOpen] = useState<any>(null);
  const tenantById = new Map<string, any>();
  overdueTenants.forEach((row: any) => { if (row.tenant?.id) tenantById.set(row.tenant.id, row); });

  async function openPay(paymentId: string) {
    try {
      const full: any = await getPaymentForReceipt({ paymentId });
      setPayOpen(full);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao carregar cobrança");
    }
  }

  return (
    <div>
      <PageHeader title="Alertas" description={`${alerts.length} aviso(s)`} />
      <div className="p-8 space-y-3">
        {alerts.length === 0 && <p className="text-muted-foreground">Sem alertas no momento. ✅</p>}
        {alerts.map((a: any) => {
          const Icon = a.type === "overdue" ? AlertTriangle : Bell;
          const color = a.type === "overdue" ? "text-destructive bg-destructive/10" : "text-warning-foreground bg-warning/20";
          const ov = a.tenant_id ? tenantById.get(a.tenant_id) : null;
          const phone = (ov?.tenant?.phone ?? "").replace(/\D/g, "");
          const msg = encodeURIComponent(
            ov
              ? `Olá ${a.tenant_name}, identificamos ${ov.count} parcela(s) de aluguel em aberto, total ${brl(ov.total)}. Por favor, regularize. Obrigado.`
              : `Olá ${a.tenant_name}, passando para lembrar do vencimento próximo do seu aluguel. Obrigado.`
          );
          return (
            <Card key={a.id} className="p-4 flex items-start gap-3 flex-wrap">
              <div className={`size-9 rounded-md flex items-center justify-center ${color}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.message}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">{formatDateBR(a.date)}</span>
                {a.tenant_id && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/inquilinos/$id" params={{ id: a.tenant_id }}>
                      <User className="size-4 mr-1" />Perfil
                    </Link>
                  </Button>
                )}
                {phone && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`https://wa.me/55${phone}?text=${msg}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4 mr-1" />WhatsApp
                    </a>
                  </Button>
                )}
                <Button size="sm" onClick={() => openPay(a.payment_id)}>
                  <CheckCircle2 className="size-4 mr-1" />Pagar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <PayDialog payment={payOpen} onClose={() => setPayOpen(null)} />
    </div>
  );
}