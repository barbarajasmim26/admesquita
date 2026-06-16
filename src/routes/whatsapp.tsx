import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { listTenants } from "@/lib/api/crm.functions";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Copy } from "lucide-react";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["tenants"], queryFn: () => listTenants() });

export const Route = createFileRoute("/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — Mesquita Imóveis" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  errorComponent: ({ error }) => <div className="p-8">{String(error)}</div>,
  notFoundComponent: () => <div className="p-8">Não encontrado</div>,
  component: Page,
});

const TEMPLATES: { id: string; label: string; body: string }[] = [
  { id: "cobranca", label: "Cobrança", body: "Olá, {NOME}. Identificamos que o aluguel referente ao mês {MES} encontra-se pendente. Favor verificar. Qualquer dúvida estamos à disposição." },
  { id: "confirmacao", label: "Confirmação de pagamento", body: "Olá, {NOME}! Confirmamos o recebimento do aluguel referente a {MES}. Obrigado!" },
  { id: "recibo", label: "Envio de recibo", body: "Olá, {NOME}, segue em anexo o recibo do aluguel de {MES}. Qualquer dúvida estamos à disposição." },
  { id: "contrato_vence", label: "Contrato vencendo", body: "Olá, {NOME}. Informamos que seu contrato de locação vence em breve. Vamos agendar a renovação?" },
  { id: "renovacao", label: "Renovação", body: "Olá, {NOME}. Estamos preparando a renovação do seu contrato. Em breve enviaremos o novo documento para sua assinatura." },
  { id: "vistoria", label: "Agendamento de vistoria", body: "Olá, {NOME}. Gostaríamos de agendar uma vistoria no imóvel. Qual o melhor dia/horário para você?" },
  { id: "boasvindas", label: "Boas-vindas", body: "Seja bem-vindo(a), {NOME}! É um prazer tê-lo(a) como inquilino(a). Qualquer necessidade estamos à disposição." },
];

function Page() {
  const { data: tenants } = useSuspenseQuery(opts);
  const [tplId, setTplId] = useState("cobranca");
  const [tenantId, setTenantId] = useState("");
  const [mes, setMes] = useState(() => {
    const d = new Date();
    return d.toLocaleString("pt-BR", { month: "long" });
  });

  const tpl = TEMPLATES.find(t => t.id === tplId)!;
  const tenant: any = tenants.find((t: any) => t.id === tenantId);
  const message = tpl.body.replace(/\{NOME\}/g, tenant?.name?.split(" ")[0] ?? "[Nome]").replace(/\{MES\}/g, mes);
  const [edited, setEdited] = useState("");
  const finalMsg = edited || message;
  const phone = (tenant?.phone ?? "").replace(/\D/g, "");

  function send() {
    if (!phone) { toast.error("Inquilino sem telefone"); return; }
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(finalMsg)}`, "_blank");
  }

  return (
    <div>
      <PageHeader title="WhatsApp" description="Central de mensagens automáticas" />
      <div className="p-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Modelos</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setTplId(t.id); setEdited(""); }}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted/50 ${tplId === t.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                {t.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{tpl.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inquilino</Label>
                <Select value={tenantId} onValueChange={(v) => { setTenantId(v); setEdited(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} {t.properties?.name ? `· ${t.properties.name}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mês de referência</Label>
                <Input value={mes} onChange={e => { setMes(e.target.value); setEdited(""); }} />
              </div>
            </div>
            <div>
              <Label>Mensagem (editável)</Label>
              <Textarea rows={6} value={edited || message} onChange={e => setEdited(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={send} disabled={!tenant || !phone}><MessageCircle className="size-4 mr-1" />Enviar via WhatsApp</Button>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(finalMsg); toast.success("Copiado!"); }}><Copy className="size-4 mr-1" />Copiar</Button>
            </div>
            {tenantId && !phone && <p className="text-xs text-destructive">Este inquilino não tem telefone cadastrado.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
