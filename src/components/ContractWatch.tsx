import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getContractWatch } from "@/lib/api/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { brl, formatDateBR } from "@/lib/finance";
import { contractEndingMessage, readjustmentMessage, waLink } from "@/lib/bot-templates";
import { MessageCircle, FileSignature, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ContractWatch() {
  const [percent, setPercent] = useState(4.5);
  const { data, isLoading } = useQuery({
    queryKey: ["contract-watch", percent],
    queryFn: () => getContractWatch({ percent }),
  });

  function open(link: string | null) {
    if (!link) { toast.error("Inquilino sem telefone cadastrado."); return; }
    window.open(link, "_blank");
  }

  if (isLoading || !data) {
    return (
      <Card><CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> verificando contratos...
      </CardContent></Card>
    );
  }

  if (!data.ending.length && !data.readjust.length) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Nenhum contrato vencendo ou com reajuste previsto nos próximos 60 dias.
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.ending.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSignature className="size-4 text-amber-500" /> Contratos vencendo ({data.ending.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.ending.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.tenants?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c.properties?.name} • vence {formatDateBR(c.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={c.urgency === "alta" ? "destructive" : "secondary"}>{c.daysLeft} dias</Badge>
                  <Button size="icon" variant="ghost" className="size-8"
                    onClick={() => open(waLink(c.tenants?.phone, contractEndingMessage({ name: (c.tenants?.name ?? "").split(" ")[0], endDate: c.end_date })))}>
                    <MessageCircle className="size-4 text-emerald-600" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" /> Reajuste anual ({data.readjust.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Índice de reajuste (%)</Label>
              <Input type="number" step="0.1" value={percent}
                onChange={e => setPercent(Number(e.target.value) || 0)} className="w-28 h-9" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">valores sugeridos abaixo já com o índice aplicado</p>
          </div>
          {data.readjust.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contrato faz aniversário neste período.</p>
          )}
          {data.readjust.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border rounded-lg p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{c.tenants?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.years} ano(s) de contrato • {brl(c.oldAmount)} → <span className="text-emerald-600 font-medium">{brl(c.newAmount)}</span>
                </p>
              </div>
              <Button size="icon" variant="ghost" className="size-8 shrink-0"
                onClick={() => open(waLink(c.tenants?.phone, readjustmentMessage({
                  name: (c.tenants?.name ?? "").split(" ")[0],
                  oldAmount: c.oldAmount, newAmount: c.newAmount, indexName: c.indexName,
                })))}>
                <MessageCircle className="size-4 text-emerald-600" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
