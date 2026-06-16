import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listContracts } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, formatDateBR } from "@/lib/finance";
import { downloadContract } from "@/lib/contract-pdf";
import { NewContractDialog } from "@/components/NewContractDialog";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["contracts"], queryFn: () => listContracts() });

export const Route = createFileRoute("/contratos")({
  head: () => ({ meta: [{ title: "Contratos — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [open, setOpen] = useState(false);

  async function downloadBlank() {
    try {
      const today = new Date();
      const end = new Date(today); end.setFullYear(end.getFullYear() + 3);
      await downloadContract({
        tenantName: "____________________________________",
        tenantNationality: "brasileiro(a)",
        tenantMaritalStatus: "____________",
        tenantProfession: "____________",
        tenantRg: "____________",
        tenantCpf: "____________",
        tenantAddress: "____________________________________",
        propertyAddress: "____________________________________",
        startDate: today,
        endDate: end,
        rentAmount: 0,
        depositAmount: 0,
        dueDay: 10,
        signDate: today,
      }, "modelo_contrato_locacao.pdf");
      toast.success("Modelo de contrato baixado");
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  }

  return (
    <div>
      <PageHeader
        title="Contratos"
        description={`${data.length} contrato(s)`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadBlank} className="gap-2">
              <FileText className="size-4" /> Modelo original
            </Button>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="size-4" /> Novo contrato
            </Button>
          </div>
        }
      />
      <div className="p-8">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Imóvel</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Aluguel</TableHead>
                <TableHead className="text-center">Vencimento</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/inquilinos/$id" params={{ id: c.tenants?.id }} className="font-medium hover:underline">
                      {c.tenants?.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.properties?.name}</TableCell>
                  <TableCell>{formatDateBR(c.start_date)}</TableCell>
                  <TableCell>{c.end_date ? formatDateBR(c.end_date) : "Indeterminado"}</TableCell>
                  <TableCell className="text-right">{brl(c.rent_amount)}</TableCell>
                  <TableCell className="text-center">dia {c.due_day}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      <NewContractDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
