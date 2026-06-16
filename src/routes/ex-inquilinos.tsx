import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listFormerTenants } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, formatDateBR } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["former"], queryFn: () => listFormerTenants() });

export const Route = createFileRoute("/ex-inquilinos")({
  head: () => ({ meta: [{ title: "Ex-inquilinos — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q) return data;
    const t = q.toLowerCase();
    return data.filter((x: any) =>
      x.name.toLowerCase().includes(t) ||
      (x.properties?.name ?? "").toLowerCase().includes(t) ||
      (x.phone ?? "").includes(q)
    );
  }, [data, q]);

  return (
    <div>
      <PageHeader title="Ex-inquilinos" description={`${data.length} registros históricos`} />
      <div className="p-8 space-y-4">
        <Input placeholder="Buscar por nome, imóvel ou telefone..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead className="text-right">Aluguel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              )}
              {filtered.map((t: any) => (
                <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell>
                    <Link to="/ex-inquilinos/$id" params={{ id: t.id }} className="font-medium text-primary hover:underline">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.properties?.name}</TableCell>
                  <TableCell className="text-sm">{t.phone ?? "—"}</TableCell>
                  <TableCell>{formatDateBR(t.start_date)}</TableCell>
                  <TableCell>{t.exit_date ? formatDateBR(t.exit_date) : "—"}</TableCell>
                  <TableCell className="text-right">{t.rent_amount ? brl(t.rent_amount) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

