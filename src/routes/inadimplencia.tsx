import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listOverdueByTenant } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, daysLate, formatDateBR } from "@/lib/finance";
import { MessageCircle } from "lucide-react";

const opts = queryOptions({ queryKey: ["overdue"], queryFn: () => listOverdueByTenant() });

export const Route = createFileRoute("/inadimplencia")({
  head: () => ({ meta: [{ title: "Inadimplência — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  return (
    <div>
      <PageHeader title="Inadimplência" description={`${data.length} inquilino(s) com cobranças vencidas`} />
      <div className="p-8">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-center">Dias de atraso</TableHead>
                <TableHead className="text-right">Total devido</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhuma inadimplência. 🎉</TableCell></TableRow>}
              {data.map((row: any) => {
                const phone = (row.tenant?.phone ?? "").replace(/\D/g, "");
                const msg = encodeURIComponent(
                  `Olá ${row.tenant?.name}, identificamos ${row.count} parcela(s) de aluguel em aberto, total ${brl(row.total)}. Por favor, regularize. Obrigado.`
                );
                return (
                  <TableRow key={row.tenant?.id}>
                    <TableCell>
                      <Link to="/inquilinos/$id" params={{ id: row.tenant.id }} className="font-medium hover:underline">
                        {row.tenant?.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.tenant?.properties?.name}</TableCell>
                    <TableCell className="text-center">{row.count}</TableCell>
                    <TableCell className="text-center text-destructive font-medium">{daysLate(row.oldest)}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(row.total)}</TableCell>
                    <TableCell className="text-right">
                      {phone && (
                        <Button asChild size="sm" variant="outline">
                          <a href={`https://wa.me/55${phone}?text=${msg}`} target="_blank" rel="noreferrer">
                            <MessageCircle className="size-4 mr-1" />WhatsApp
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
