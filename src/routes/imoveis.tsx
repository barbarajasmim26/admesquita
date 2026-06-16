import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listProperties } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PropertyDialog } from "@/components/PropertyDialog";
import { Home, Plus, ChevronRight, Users, MapPin } from "lucide-react";
import { brl } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["properties"], queryFn: () => listProperties() });

export const Route = createFileRoute("/imoveis")({
  head: () => ({ meta: [{ title: "Imóveis — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = data.filter((p: any) =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.address ?? "").toLowerCase().includes(q.toLowerCase())
  );

  const totalTenants = data.reduce((a: number, p: any) => a + p.tenants.length, 0);
  const totalRent = data.reduce(
    (a: number, p: any) => a + p.tenants.reduce((b: number, t: any) => b + Number(t.rent_amount ?? 0), 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title="Imóveis"
        description={`${data.length} imóvel(eis) · ${totalTenants} inquilino(s) ativo(s) · ${brl(totalRent)}/mês`}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Novo imóvel</Button>}
      />
      <div className="p-8 space-y-6">
        <Input placeholder="Buscar por nome ou endereço..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">Nenhum imóvel encontrado.</Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: any) => {
            const monthly = p.tenants.reduce((a: number, t: any) => a + Number(t.rent_amount ?? 0), 0);
            return (
              <Link key={p.id} to="/imoveis/$id" params={{ id: p.id }} className="group">
                <Card className="hover:border-primary/60 hover:shadow-md transition cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
                    <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Home className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{p.name}</CardTitle>
                      <p className="text-xs text-muted-foreground flex items-start gap-1 mt-0.5">
                        <MapPin className="size-3 mt-0.5 shrink-0" />
                        <span className="truncate">{p.address ?? "Sem endereço"}</span>
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary mt-1" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="gap-1"><Users className="size-3" />{p.tenants.length}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {p.tenants.length === 0 ? "vago" : `${brl(monthly)}/mês`}
                      </span>
                    </div>
                    {p.tenants.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {p.tenants.slice(0, 3).map((t: any) => t.name.split(" ")[0]).join(", ")}
                        {p.tenants.length > 3 ? ` +${p.tenants.length - 3}` : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
      <PropertyDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
