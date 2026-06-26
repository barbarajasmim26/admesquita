import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listProperties, listOverdueByTenant, listPayments } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/finance";
import { TenantDialog } from "@/components/TenantDialog";
import { Plus, Building2, Phone, Home, LayoutGrid, List, FileDown } from "lucide-react";
import { downloadReceipt } from "@/lib/receipt-pdf";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["properties"], queryFn: () => listProperties() });
const overdueOpts = queryOptions({ queryKey: ["overdue-by-tenant"], queryFn: () => listOverdueByTenant() });
const allPaymentsOpts = queryOptions({ queryKey: ["all-payments"], queryFn: () => listPayments({ status: "paid" }) });

export const Route = createFileRoute("/inquilinos/")({
  head: () => ({ meta: [{ title: "Inquilinos — Mesquita Imóveis" }] }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opts);
    context.queryClient.ensureQueryData(overdueOpts);
    context.queryClient.ensureQueryData(allPaymentsOpts);
  },
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const { data: overdueList } = useSuspenseQuery(overdueOpts);
  const { data: allPayments } = useSuspenseQuery(allPaymentsOpts);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"cards" | "byProperty">("cards");

  const overdueMap = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    (overdueList as any[]).forEach((o) => m.set(o.tenant.id, { count: o.count, total: o.total }));
    return m;
  }, [overdueList]);

  const lastPaymentMap = useMemo(() => {
    const m = new Map<string, any>();
    (allPayments as any[]).forEach((p) => {
      const existing = m.get(p.tenant_id);
      if (!existing || p.paid_date > existing.paid_date) {
        m.set(p.tenant_id, p);
      }
    });
    return m;
  }, [allPayments]);

  const allTenants = useMemo(() => {
    const list: any[] = [];
    data.forEach((p: any) => p.tenants.forEach((t: any) => list.push({ ...t, property: p })));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const totalTenants = allTenants.length;

  const filteredCards = useMemo(() => {
    if (!q) return allTenants;
    const term = q.toLowerCase();
    return allTenants.filter((t) =>
      t.name.toLowerCase().includes(term) ||
      (t.phone ?? "").includes(q) ||
      (t.property?.name ?? "").toLowerCase().includes(term),
    );
  }, [allTenants, q]);

  const filteredByProp = useMemo(() => {
    if (!q) return data;
    const term = q.toLowerCase();
    return data
      .map((p: any) => ({ ...p, tenants: p.tenants.filter((t: any) => t.name.toLowerCase().includes(term) || (t.phone ?? "").includes(q)) }))
      .filter((p: any) => p.name.toLowerCase().includes(term) || p.tenants.length > 0);
  }, [data, q]);

  async function downloadLastReceipt(t: any, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const p = lastPaymentMap.get(t.id);
    if (!p) {
      toast.error("Nenhum pagamento pago encontrado para este inquilino.");
      return;
    }

    try {
      const due = new Date(p.due_date + "T12:00:00");
      await downloadReceipt({
        tenantName: t.name ?? "",
        tenantCpf: t.cpf ?? null,
        amount: Number(p.paid_amount ?? p.amount ?? 0),
        propertyName: t.property?.name ?? "",
        propertyAddress: t.property?.address ?? null,
        houseNumber: t.house_number ?? null,
        referenceMonth: due.getMonth() + 1,
        referenceYear: due.getFullYear(),
        issueDate: p.paid_date ? new Date(p.paid_date + "T12:00:00") : new Date(),
      }, `recibo_${(t.name ?? "").replace(/\s+/g, "_")}_${due.getMonth() + 1}_${due.getFullYear()}.pdf`);
      toast.success("Recibo baixado!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao baixar recibo");
    }
  }

  return (
    <div>
      <PageHeader title="Inquilinos" description={`${totalTenants} inquilino(s) em ${data.length} imóvel(eis)`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Novo inquilino</Button>} />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar inquilino, imóvel ou telefone..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
          <div className="ml-auto inline-flex rounded-md border bg-card p-0.5">
            <Button variant={view === "cards" ? "default" : "ghost"} size="sm" onClick={() => setView("cards")}>
              <LayoutGrid className="size-4 mr-1" /> Cards
            </Button>
            <Button variant={view === "byProperty" ? "default" : "ghost"} size="sm" onClick={() => setView("byProperty")}>
              <List className="size-4 mr-1" /> Por imóvel
            </Button>
          </div>
        </div>

        {view === "cards" ? (
          filteredCards.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">Nenhum inquilino.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCards.map((t: any) => {
                const overdue = overdueMap.get(t.id);
                const hasPaid = lastPaymentMap.has(t.id);
                const initials = t.name.split(/\s+/).slice(0, 2).map((s: string) => s[0]).join("").toUpperCase();
                return (
                  <Link key={t.id} to="/inquilinos/$id" params={{ id: t.id }}>
                    <Card className="h-full transition hover:shadow-md hover:border-primary/40 cursor-pointer">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="size-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{t.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Building2 className="size-3" /> {t.property?.name}
                            </div>
                          </div>
                          {overdue ? (
                            <Badge variant="destructive">{overdue.count}× atraso</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30">em dia</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <Info icon={<Home className="size-3" />} label="Casa" value={t.house_number ?? "—"} />
                          <Info icon={<Phone className="size-3" />} label="Telefone" value={t.phone ?? "—"} />
                        </div>
                        <div className="flex items-center justify-between border-t pt-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Aluguel</div>
                            <div className="font-semibold">{brl(t.rent_amount)}</div>
                          </div>
                          <div className="flex gap-1">
                            {hasPaid && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={(e) => downloadLastReceipt(t, e)} title="Baixar último recibo">
                                <FileDown className="size-4" />
                              </Button>
                            )}
                            {overdue && (
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Devendo</div>
                                <div className="font-semibold text-destructive">{brl(overdue.total)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {filteredByProp.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhum resultado.</Card>}
            {filteredByProp.map((p: any) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="size-4 text-primary" />
                    <span className="font-semibold flex-1">{p.name}</span>
                    <Badge variant="secondary">{p.tenants.length}</Badge>
                    <Link to="/imoveis/$id" params={{ id: p.id }} className="text-xs text-primary hover:underline">ver imóvel →</Link>
                  </div>
                  {p.tenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Imóvel vago.</p>
                  ) : (
                    <div className="divide-y">
                      {p.tenants.map((t: any) => {
                        const hasPaid = lastPaymentMap.has(t.id);
                        return (
                          <Link key={t.id} to="/inquilinos/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 py-2 hover:bg-muted/30 -mx-2 px-2 rounded">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-primary hover:underline truncate">{t.name}</div>
                              <div className="text-xs text-muted-foreground">{t.house_number ? `casa ${t.house_number} · ` : ""}{t.phone ?? "sem telefone"}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              {hasPaid && (
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-emerald-600 gap-1" onClick={(e) => downloadLastReceipt({ ...t, property: p }, e)}>
                                  <FileDown className="size-4" /> <span className="text-[10px]">Recibo</span>
                                </Button>
                              )}
                              <div className="text-right min-w-[80px]">
                                <div className="text-sm font-medium">{brl(t.rent_amount)}</div>
                                <div className="text-xs text-muted-foreground">aluguel</div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <TenantDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
