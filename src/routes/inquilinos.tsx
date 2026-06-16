import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listProperties } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/finance";
import { TenantDialog } from "@/components/TenantDialog";
import { Plus, Building2, ChevronDown, ChevronRight, Users } from "lucide-react";

const opts = queryOptions({ queryKey: ["properties"], queryFn: () => listProperties() });

export const Route = createFileRoute("/inquilinos")({
  head: () => ({ meta: [{ title: "Inquilinos — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const totalTenants = useMemo(() => data.reduce((a: number, p: any) => a + p.tenants.length, 0), [data]);

  const filtered = useMemo(() => {
    if (!q) return data;
    const term = q.toLowerCase();
    return data
      .map((p: any) => ({ ...p, tenants: p.tenants.filter((t: any) => t.name.toLowerCase().includes(term) || (t.phone ?? "").includes(q)) }))
      .filter((p: any) => p.name.toLowerCase().includes(term) || p.tenants.length > 0);
  }, [data, q]);

  return (
    <div>
      <PageHeader title="Inquilinos" description={`${totalTenants} inquilino(s) em ${data.length} imóvel(eis)`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Novo inquilino</Button>} />
      <div className="p-8 space-y-4">
        <Input placeholder="Buscar por inquilino, condomínio ou telefone..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

        {filtered.length === 0 && <Card className="p-12 text-center text-muted-foreground">Nenhum resultado.</Card>}

        <div className="space-y-3">
          {filtered.map((p: any) => {
            const isOpen = expanded[p.id] ?? (q.length > 0);
            return (
              <Card key={p.id}>
                <CardHeader
                  className="flex flex-row items-center gap-3 space-y-0 cursor-pointer hover:bg-muted/30"
                  onClick={() => setExpanded(s => ({ ...s, [p.id]: !isOpen }))}
                >
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  <Building2 className="size-5 text-primary" />
                  <CardTitle className="text-base flex-1">{p.name}</CardTitle>
                  <Badge variant="secondary"><Users className="size-3 mr-1" />{p.tenants.length}</Badge>
                  <Link to="/imoveis/$id" params={{ id: p.id }} onClick={(e) => e.stopPropagation()} className="text-xs text-primary hover:underline">ver imóvel →</Link>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0">
                    {p.tenants.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-2">Imóvel vago.</p>
                    ) : (
                      <div className="divide-y">
                        {p.tenants.map((t: any) => (
                          <Link key={t.id} to="/inquilinos/$id" params={{ id: t.id }} className="flex items-center justify-between gap-3 py-2 hover:bg-muted/30 -mx-2 px-2 rounded">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-primary hover:underline truncate">{t.name}</div>
                              <div className="text-xs text-muted-foreground">{t.house_number ? `casa ${t.house_number} · ` : ""}{t.phone ?? "sem telefone"}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{brl(t.rent_amount)}</div>
                              <div className="text-xs text-muted-foreground">aluguel</div>
                            </div>
                            <Badge variant="outline" className="ml-2">Ver perfil →</Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <TenantDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
