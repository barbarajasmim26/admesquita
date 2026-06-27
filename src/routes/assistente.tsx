import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { downloadContract, type ContractData } from "@/lib/contract-pdf";
import { Download } from "lucide-react";

export const Route = createFileRoute("/assistente")({
  head: () => ({ meta: [{ title: "Assistente — Mesquita Imóveis" }] }),
  component: Page,
});

type ToolTrace = { name: string; args: any; result: any };
type Msg = { role: "user" | "assistant"; content: string; toolTrace?: ToolTrace[] };
const STORAGE_KEY = "mesquita.assistant.messages.v1";

const QUICK_PROMPTS = [
  "Quem está inadimplente?",
  "Quais imóveis estão vazios?",
  "Contratos vencendo nos próximos 60 dias",
  "Quem pagou esse mês?",
];

function Page() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const reply = (data as any)?.reply ?? "(sem resposta)";
      const trace: ToolTrace[] = (data as any)?.toolTrace ?? [];
      setMessages([...next, { role: "assistant", content: reply, toolTrace: trace }]);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
      setMessages([...next, { role: "assistant", content: `❌ ${e.message ?? "erro"}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function clearChat() {
    if (!confirm("Limpar toda a conversa?")) return;
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Assistente"
        description="Converse naturalmente: registre pagamentos, encerre contratos, gere recibos, consulte qualquer informação."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1"><Bot className="size-3.5" />Operacional</Badge>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearChat}>
                <Trash2 className="size-4 mr-1" />Limpar
              </Button>
            )}
          </div>
        }
      />
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 bg-muted/20">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center space-y-4 pt-12">
            <div className="size-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escreva como falaria com um funcionário. O sistema entende e executa.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto pt-4">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)}
                  className="text-left text-sm border rounded-lg p-3 bg-card hover:bg-accent transition-colors">
                  {p}
                </button>
              ))}
            </div>
            <div className="max-w-xl mx-auto text-xs text-muted-foreground space-y-1 pt-6 text-left bg-card border rounded-lg p-4">
              <p className="font-medium text-foreground">Exemplos de comandos:</p>
              <p>• "Dice pagou hoje" — marca o mês em aberto mais antigo</p>
              <p>• "Maria pagou outubro" — marca mês específico</p>
              <p>• "João saiu do imóvel" — encerra contrato</p>
              <p>• "Gera mensagem de cobrança pro Pedro"</p>
              <p>• "Histórico do Carlos"</p>
              <p>• "Cria cobrança extra de R$ 200 pro Bruno para dia 30"</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} msg={m} />)}
        {loading && (
          <div className="flex gap-3 max-w-3xl">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 bg-card border text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> pensando...
            </div>
          </div>
        )}
      </div>
      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder='Ex: "Dice pagou hoje", "quem está atrasado?", "gera cobrança pro João"'
            rows={1}
            className="resize-none min-h-[44px] max-h-32"
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="size-11 shrink-0">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Enter envia • Shift+Enter quebra linha • O assistente executa ações diretamente no sistema
        </p>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  const downloads = (msg.toolTrace ?? [])
    .map(t => t.result)
    .filter(r => r && r.__action === "download_contract_pdf" && r.contractData);
  return (
    <div className={`flex gap-3 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : ""}`}>
      <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <Card className={isUser ? "bg-primary text-primary-foreground" : ""}>
        <CardContent className="p-3 text-sm">
          {isUser ? (
            <div className="whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-headings:my-2">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
              {downloads.map((d: any, i: number) => (
                <Button key={i} size="sm" variant="outline" className="mt-2 gap-2"
                  onClick={async () => {
                    try {
                      const cd: ContractData = {
                        ...d.contractData,
                        startDate: new Date(d.contractData.startDate),
                        endDate: new Date(d.contractData.endDate),
                        signDate: d.contractData.signDate ? new Date(d.contractData.signDate) : undefined,
                      };
                      await downloadContract(cd, d.filename ?? "contrato.pdf");
                    } catch (e: any) { toast.error(e.message ?? "erro ao gerar PDF"); }
                  }}>
                  <Download className="size-4" /> Baixar contrato (PDF)
                </Button>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}