import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text, tenants, today } = await req.json();
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'texto obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const system = `Você é um assistente de uma imobiliária. O usuário descreve em linguagem natural pagamentos de aluguel recebidos.
Sua tarefa: identificar QUAL inquilino e QUAL mês/ano foi pago, considerando o histórico e a data de hoje.

Regras importantes:
- Alguns inquilinos pagam adiantado, outros em atraso. Quando o usuário disser apenas "fulano pagou" sem citar mês, use a heurística: o mês mais antigo em aberto (status pending/overdue) é o que está sendo pago. Se não houver mês em aberto antes do mês atual, considere o mês atual.
- Se o usuário citar explicitamente o mês ("pagou novembro", "pagou o de outubro"), use esse mês.
- Identifique o inquilino pelo apelido/primeiro nome, mesmo com acentuação ou grafia parcial. Se houver ambiguidade, marque "ambiguous": true e liste candidatos.
- Responda APENAS com JSON válido no formato:
{"actions":[{"tenantId":"uuid","tenantName":"...","year":2025,"month":11,"status":"paid","reason":"texto curto explicando"}],"ambiguous":[{"input":"trecho","candidates":[{"id":"...","name":"..."}]}],"notes":"observações gerais"}
- status sempre "paid" para confirmação de pagamento.
- Não invente inquilinos. Use apenas IDs da lista fornecida.`;

    const userPayload = {
      hoje: today,
      texto: text,
      inquilinos: tenants,
    };

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `IA: ${res.status} ${t}` }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { error: 'resposta inválida da IA', raw: content }; }
    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});