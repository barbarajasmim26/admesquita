// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { getFormerTenant } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { brl, formatDateBR } from "@/lib/finance";

const opts = (id: string) => queryOptions({ queryKey: ["former", id], queryFn: () => getFormerTenant({ data: { id } }) });

export const Route = createFileRoute("/ex-inquilinos/$id")({
  head: () => ({ meta: [{ title: "Ex-inquilino — Mesquita Imóveis" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const t: any = data.tenant;
  if (!t) return <div className="p-8">Ex-inquilino não encontrado</div>;
  const phone = (t.phone ?? "").replace(/\D/g, "");

  return (
    <div>
      <PageHeader
        title={t.name}
        description={`Histórico · ${t.properties?.name ?? ""}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/ex-inquilinos"><ArrowLeft className="size-4 mr-1" />Voltar</Link></Button>
            {phone && (
              <Button asChild variant="outline" size="sm">
                <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4 mr-1" />WhatsApp</a>
              </Button>
            )}
          </div>
        }
      />
      <div className="p-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="CPF" value={t.cpf} />
            <Row label="Telefone" value={t.phone} />
            <Row label="Email" value={t.email} />
            <Row label="Observações" value={t.notes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Locação encerrada</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Imóvel" value={t.properties?.id ? <Link to="/imoveis/$id" params={{ id: t.properties.id }} className="text-primary hover:underline">{t.properties?.name}</Link> : t.properties?.name} />
            <Row label="Endereço" value={t.properties?.address} />
            <Row label="Casa nº" value={t.house_number} />
            <Row label="Entrada" value={formatDateBR(t.start_date)} />
            <Row label="Saída" value={formatDateBR(t.exit_date)} />
            <Row label="Aluguel" value={t.rent_amount ? brl(t.rent_amount) : "—"} />
            <Row label="Depósito" value={t.deposit ? brl(t.deposit) : "—"} />
            <Row label="Saldo final" value={t.final_balance != null ? brl(t.final_balance) : "—"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}