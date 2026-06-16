import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getProperty } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, formatDateBR } from "@/lib/finance";
import { PropertyDialog } from "@/components/PropertyDialog";
import { TenantDialog } from "@/components/TenantDialog";
import { ArrowLeft, Pencil, Plus, Users } from "lucide-react";

const opts = (id: string) => queryOptions({ queryKey: ["property", id], queryFn: () => getProperty({ data: { id } }) });

export const Route = createFileRoute("/imoveis/$id")({
  head: () => ({ meta: [{ title: "Imóvel — Mesquita Imóveis" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const [editOpen, setEditOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const p: any = data.property;
  if (!p) return <div className="p-8">Imóvel não encontrado</div>;

  return (
    <div>
      <PageHeader title={p.name} description={p.address ?? ""}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/imoveis"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="size-4 mr-1" />Editar</Button>
            <Button size="sm" onClick={() => setTenantOpen(true)}><Plus className="size-4 mr-1" />Novo inquilino</Button>
          </div>
        } />
      <div className="p-8 space-y-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Inquilinos ativos ({data.tenants.length})</CardTitle></CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Casa</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Aluguel</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Início</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum inquilino ativo. Clique em "Novo inquilino".</TableCell></TableRow>}
              {data.tenants.map((t: any) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell><Link to="/inquilinos/$id" params={{ id: t.id }} className="font-medium hover:underline">{t.name}</Link></TableCell>
                  <TableCell>{t.house_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{t.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">{brl(t.rent_amount)}</TableCell>
                  <TableCell>dia {t.due_day}</TableCell>
                  <TableCell className="text-sm">{formatDateBR(t.start_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {data.formerTenants.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Ex-inquilinos ({data.formerTenants.length})</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {data.formerTenants.slice(0, 20).map((t: any) => (
                  <li key={t.id} className="flex justify-between border-b border-border/40 last:border-0 py-1">
                    <span>{t.name} {t.house_number ? `· casa ${t.house_number}` : ""}</span>
                    <span className="text-muted-foreground">{t.exit_date ? formatDateBR(t.exit_date) : "—"}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
      <PropertyDialog open={editOpen} onClose={() => setEditOpen(false)} property={p} />
      <TenantDialog open={tenantOpen} onClose={() => setTenantOpen(false)} defaultPropertyId={p.id} />
    </div>
  );
}
