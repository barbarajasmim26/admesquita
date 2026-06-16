import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listProperties } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PropertyDialog } from "@/components/PropertyDialog";
import { Home, Plus, ChevronRight, Users, Building2 } from "lucide-react";

const opts = queryOptions({ queryKey: ["properties"], queryFn: () => listProperties() });

export const Route = createFileRoute("/imoveis")({
  head: () => ({ meta: [{ title: "Imóveis — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

const CAT_LABELS: Record<string, string> = {
  residencial: "Residencial",
  comercial: "Comercial",
  misto: "Misto",
  condominio: "Condomínio",
};

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = data.filter((p: any) =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.address ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    filtered.forEach((p: any) => {
      const k = p.category ?? "residencial";
      (g[k] = g[k] || []).push(p);
    });
    return g;
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Imóveis"
        description={`${data.length} propriedade(s) cadastrada(s)`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Novo imóvel</Button>}
      />
      <div className="p-8 space-y-8">
        <Input placeholder="Buscar por nome ou endereço..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

        {Object.keys(grouped).length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">Nenhum imóvel encontrado.</Card>
        )}

        {Object.entries(grouped).map(([cat, items]) => {
          const totalTenants = items.reduce((a, p) => a + p.tenants.length, 0);
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">{CAT_LABELS[cat] ?? cat}</h2>
                <Badge variant="secondary">{items.length} imóvel(eis)</Badge>
                <Badge variant="outline">{totalTenants} inquilino(s)</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((p: any) => (
                  <Link key={p.id} to="/imoveis/$id" params={{ id: p.id }} className="group">
                    <Card className="hover:border-primary/50 hover:shadow-md transition cursor-pointer h-full">
                      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                          <Home className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{p.name}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">{p.address ?? "—"}</p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Users className="size-4" />
                          <span>{p.tenants.length} inquilino(s) ativo(s)</span>
                        </div>
                        {p.tenants.length > 0 ? (
                          <ul className="text-sm space-y-1">
                            {p.tenants.slice(0, 4).map((t: any) => (
                              <li key={t.id} className="flex justify-between border-b border-border/40 last:border-0 pb-1">
                                <span className="truncate">{t.name}</span>
                                <span className="text-muted-foreground text-xs">{t.house_number ? `casa ${t.house_number}` : ""}</span>
                              </li>
                            ))}
                            {p.tenants.length > 4 && <li className="text-xs text-primary">+ {p.tenants.length - 4} outros — ver todos</li>}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Imóvel vago</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <PropertyDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
