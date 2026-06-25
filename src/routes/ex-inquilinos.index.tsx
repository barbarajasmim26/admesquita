import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listFormerTenants } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, formatDateBR } from "@/lib/finance";

const opts = queryOptions({ queryKey: ["former"], queryFn: () => listFormerTenants() });

export const Route = createFileRoute("/ex-inquilinos/")({
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

  const grouped = useMemo(() => {
    const g = new Map<string, { name: string; items: any[] }>();
    filtered.forEach((t: any) => {
      const key = t.properties?.id ?? "sem-imovel";
      const name = t.properties?.name ?? "Sem imóvel vinculado";
      if (!g.has(key)) g.set(key, { name, items: [] });
      g.get(key)!.items.push(t);
    });
    return Array.from(g.entries())
      .sort((a, b) => a[1].name.localeCompare(b[1].name, "pt-BR"));
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Ex-inquilinos" description={`${data.length} registros históricos`} />
      <div className="p-8 space-y-4">
        <Input placeholder="Buscar por nome, imóvel ou telefone..." value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />
        {grouped.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum registro.</Card>}
        <Accordion type="multiple" defaultValue={grouped.map(([k]) => k)} className="space-y-2">
          {grouped.map(([key, { name, items }]) => (
            <AccordionItem key={key} value={key} className="border rounded-lg bg-card px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-primary" />
                  <span className="font-semibold">{name}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Casa</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Saída</TableHead>
                        <TableHead className="text-right">Aluguel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((t: any) => (
                        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40">
                          <TableCell>
                            <Link to="/ex-inquilinos/$id" params={{ id: t.id }} className="font-medium text-primary hover:underline">{t.name}</Link>
                          </TableCell>
                          <TableCell>{t.house_number ?? "—"}</TableCell>
                          <TableCell className="text-sm">{t.phone ?? "—"}</TableCell>
                          <TableCell>{formatDateBR(t.start_date)}</TableCell>
                          <TableCell>{t.exit_date ? formatDateBR(t.exit_date) : "—"}</TableCell>
                          <TableCell className="text-right">{t.rent_amount ? brl(t.rent_amount) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
