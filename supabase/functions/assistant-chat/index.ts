import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SUPA_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY')!;

function sb() {
  return createClient(SUPA_URL, SUPA_SR, { auth: { persistSession: false } });
}

const today = () => new Date().toISOString().slice(0, 10);
const ymOf = (d: string) => d.slice(0, 7);
const brl = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

// ============== TOOLS ==============

async function searchTenants(q: string) {
  const s = sb();
  const like = `%${q}%`;
  const { data, error } = await s.from('tenants')
    .select('id, name, phone, rent_amount, due_day, start_date, status, house_number, properties(id,name,address)')
    .or(`name.ilike.${like},phone.ilike.${like}`)
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

async function listActiveTenants() {
  const s = sb();
  const { data } = await s.from('tenants')
    .select('id, name, phone, rent_amount, due_day, properties(name)')
    .eq('status', 'active').order('name').limit(500);
  return data ?? [];
}

async function getTenantSummary(tenantId: string) {
  const s = sb();
  const [{ data: t }, { data: pays }] = await Promise.all([
    s.from('tenants').select('*, properties(id,name,address)').eq('id', tenantId).maybeSingle(),
    s.from('payments').select('id, amount, paid_amount, due_date, paid_date, status').eq('tenant_id', tenantId).order('due_date', { ascending: false }).limit(36),
  ]);
  if (!t) return { error: 'inquilino não encontrado' };
  const td = today();
  const open = (pays ?? []).filter((p: any) => p.status !== 'paid');
  const overdue = open.filter((p: any) => p.due_date < td);
  return {
    tenant: { id: t.id, name: t.name, phone: t.phone, rent: Number(t.rent_amount ?? 0), due_day: t.due_day, status: t.status, property: t.properties?.name, house_number: t.house_number },
    open_months: open.map((p: any) => ({ ym: ymOf(p.due_date), due: p.due_date, status: p.status, amount: Number(p.amount) })),
    overdue_count: overdue.length,
    last_payments: (pays ?? []).filter((p: any) => p.status === 'paid').slice(0, 6).map((p: any) => ({ ym: ymOf(p.due_date), paid_date: p.paid_date, amount: Number(p.paid_amount ?? p.amount) })),
  };
}

async function listOverdue() {
  const s = sb();
  await s.from('payments').update({ status: 'overdue' }).eq('status', 'pending').lt('due_date', today());
  const { data } = await s.from('payments').select('id, amount, due_date, tenant_id, tenants(id,name,phone,properties(name))')
    .neq('status', 'paid').lt('due_date', today()).limit(500);
  const map: Record<string, any> = {};
  (data ?? []).forEach((p: any) => {
    const k = p.tenant_id;
    map[k] ||= { tenant_id: k, name: p.tenants?.name, phone: p.tenants?.phone, property: p.tenants?.properties?.name, total: 0, months: [], oldest: p.due_date };
    map[k].total += Number(p.amount);
    map[k].months.push(ymOf(p.due_date));
    if (p.due_date < map[k].oldest) map[k].oldest = p.due_date;
  });
  return Object.values(map).sort((a: any, b: any) => a.oldest.localeCompare(b.oldest));
}

async function listPaidThisMonth() {
  const s = sb();
  const ym = today().slice(0, 7);
  const { data } = await s.from('payments').select('id, paid_amount, amount, paid_date, tenant_id, tenants(name)')
    .eq('status', 'paid').gte('paid_date', `${ym}-01`).lte('paid_date', `${ym}-31`).limit(500);
  return (data ?? []).map((p: any) => ({ name: p.tenants?.name, amount: Number(p.paid_amount ?? p.amount), paid_date: p.paid_date }));
}

async function listVacantProperties() {
  const s = sb();
  const { data } = await s.from('properties').select('id, name, address, category, tenants(id,status)');
  return (data ?? []).filter((p: any) => !(p.tenants ?? []).some((t: any) => t.status === 'active'))
    .map((p: any) => ({ id: p.id, name: p.name, address: p.address, category: p.category }));
}

async function listContractsEnding(days = 60) {
  const s = sb();
  const td = today();
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const { data } = await s.from('contracts').select('id, end_date, rent_amount, status, tenants(name), properties(name)')
    .eq('status', 'active').gte('end_date', td).lte('end_date', limit).order('end_date');
  return (data ?? []).map((c: any) => ({ tenant: c.tenants?.name, property: c.properties?.name, end_date: c.end_date, rent: Number(c.rent_amount ?? 0) }));
}

// Register payment for a specific month. If month omitted, picks oldest open month.
async function registerPayment(args: { tenantId: string; year?: number; month?: number; paidDate?: string }) {
  const s = sb();
  const { data: t } = await s.from('tenants').select('id, rent_amount, due_day, name').eq('id', args.tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };

  let year = args.year, month = args.month;
  if (!year || !month) {
    // pick oldest open
    const { data: open } = await s.from('payments').select('id, due_date').eq('tenant_id', args.tenantId).neq('status', 'paid').order('due_date').limit(1);
    if (open && open.length) {
      year = Number(open[0].due_date.slice(0, 4));
      month = Number(open[0].due_date.slice(5, 7));
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
  }

  const mm = String(month).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year!, month!, 0).getDate();
  const end = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const { data: existing } = await s.from('payments').select('id').eq('tenant_id', args.tenantId).gte('due_date', start).lte('due_date', end).limit(1).maybeSingle();

  let pid = existing?.id;
  if (!pid) {
    const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', args.tenantId).eq('status', 'active').limit(1).maybeSingle();
    if (!ct) return { error: 'sem contrato ativo' };
    const dueDay = Math.min(Number(t.due_day ?? 10), lastDay);
    const dueDate = `${year}-${mm}-${String(dueDay).padStart(2, '0')}`;
    const { data: ins, error } = await s.from('payments').insert({
      tenant_id: args.tenantId, contract_id: ct.id, amount: Number(t.rent_amount ?? 0), due_date: dueDate, status: 'pending',
    }).select('id').single();
    if (error) return { error: error.message };
    pid = ins.id;
  }
  const paidDate = args.paidDate ?? today();
  await s.from('payments').update({ status: 'paid', paid_date: paidDate, paid_amount: Number(t.rent_amount ?? 0) }).eq('id', pid);
  return { ok: true, tenant: t.name, month: `${MESES[month! - 1]}/${year}`, amount: Number(t.rent_amount ?? 0), paid_date: paidDate };
}

async function endTenancy(args: { tenantId: string; endDate?: string; notes?: string }) {
  const s = sb();
  const { data: t } = await s.from('tenants').select('*, properties(name)').eq('id', args.tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };
  const endDate = args.endDate ?? today();
  await s.from('former_tenants').insert({
    name: t.name, property_name: t.properties?.name ?? 'Desconhecido', phone: t.phone, email: t.email, cpf: t.cpf,
    start_date: t.start_date, end_date: endDate, rent_amount: t.rent_amount, notes: args.notes ?? t.notes,
  });
  await s.from('tenants').delete().eq('id', args.tenantId);
  return { ok: true, name: t.name, end_date: endDate };
}

async function createCharge(args: { tenantId: string; amount: number; dueDate: string; notes?: string }) {
  const s = sb();
  const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', args.tenantId).eq('status', 'active').limit(1).maybeSingle();
  if (!ct) return { error: 'sem contrato ativo' };
  const { error } = await s.from('payments').insert({
    tenant_id: args.tenantId, contract_id: ct.id, amount: args.amount, due_date: args.dueDate, status: 'pending', notes: args.notes,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

async function issueReceipt(args: { tenantId: string; amount: number; referenceMonth: string; notes?: string }) {
  const s = sb();
  const year = new Date().getFullYear();
  const { count } = await s.from('receipts_history').select('*', { count: 'exact', head: true })
    .gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, '0');
  const number = `${year}/${seq}`;
  await s.from('receipts_history').insert({
    tenant_id: args.tenantId, amount: args.amount, reference_month: args.referenceMonth, notes: args.notes ?? null, receipt_number: number,
  });
  return { ok: true, number };
}

async function draftMessage(args: { tenantId: string; type: 'friendly_charge' | 'formal_charge' | 'overdue' | 'renewal' | 'welcome' | 'thanks' }) {
  const s = sb();
  const { data: t } = await s.from('tenants').select('name, phone, rent_amount, due_day, pix_payer, properties(name)').eq('id', args.tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };
  const name = (t.name as string).split(' ')[0];
  const valor = brl(Number(t.rent_amount ?? 0));
  const pix = t.pix_payer ? `\n\nChave PIX: ${t.pix_payer}` : '';
  let msg = '';
  switch (args.type) {
    case 'friendly_charge':
      msg = `Olá, ${name}! Tudo bem? 😊\n\nPassando para lembrar do aluguel no valor de ${valor}${t.due_day ? ` (vencimento dia ${t.due_day})` : ''}.${pix}\n\nQualquer dúvida estou à disposição. Obrigada!`;
      break;
    case 'formal_charge':
      msg = `Prezado(a) ${t.name},\n\nVimos por meio desta solicitar a regularização do aluguel referente ao imóvel ${t.properties?.name ?? ''}, no valor de ${valor}.${pix}\n\nAtenciosamente,\nMesquita Administração de Imóveis.`;
      break;
    case 'overdue':
      msg = `Olá, ${name}. Tudo bem?\n\nO aluguel de ${valor} está em atraso. Pode me passar uma previsão de pagamento?${pix}\n\nObrigada.`;
      break;
    case 'renewal':
      msg = `Olá, ${name}! Tudo bem?\n\nGostaria de conversar sobre a renovação do nosso contrato. Você tem interesse em renovar?\n\nAguardo seu retorno.`;
      break;
    case 'welcome':
      msg = `Olá, ${name}! Seja muito bem-vindo(a) ao imóvel ${t.properties?.name ?? ''}. Qualquer necessidade, conte comigo!`;
      break;
    case 'thanks':
      msg = `Olá, ${name}! Recebemos o pagamento, muito obrigada! 🙏`;
      break;
  }
  const digits = (t.phone ?? '').replace(/\D/g, '');
  const full = digits ? (digits.startsWith('55') ? digits : `55${digits}`) : null;
  const link = full ? `https://wa.me/${full}?text=${encodeURIComponent(msg)}` : null;
  return { message: msg, whatsapp_link: link, tenant: t.name };
}

// ============== TOOL REGISTRY ==============
const TOOLS = [
  { name: 'search_tenants', description: 'Buscar inquilinos por nome ou telefone (parcial).', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, fn: (a: any) => searchTenants(a.query) },
  { name: 'list_active_tenants', description: 'Listar todos os inquilinos ativos.', parameters: { type: 'object', properties: {} }, fn: () => listActiveTenants() },
  { name: 'get_tenant_summary', description: 'Resumo completo do inquilino: dados, meses em aberto, últimos pagamentos.', parameters: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => getTenantSummary(a.tenantId) },
  { name: 'list_overdue', description: 'Lista inquilinos com pagamentos em atraso (inadimplentes).', parameters: { type: 'object', properties: {} }, fn: () => listOverdue() },
  { name: 'list_paid_this_month', description: 'Lista pagamentos recebidos no mês atual.', parameters: { type: 'object', properties: {} }, fn: () => listPaidThisMonth() },
  { name: 'list_vacant_properties', description: 'Lista imóveis vazios (sem inquilino ativo).', parameters: { type: 'object', properties: {} }, fn: () => listVacantProperties() },
  { name: 'list_contracts_ending', description: 'Contratos vencendo nos próximos N dias (default 60).', parameters: { type: 'object', properties: { days: { type: 'number' } } }, fn: (a: any) => listContractsEnding(a.days ?? 60) },
  { name: 'register_payment', description: 'Marca pagamento como pago. Se year/month omitidos, usa mês em aberto mais antigo. paidDate default hoje (YYYY-MM-DD).', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, year: { type: 'number' }, month: { type: 'number' }, paidDate: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => registerPayment(a) },
  { name: 'end_tenancy', description: 'Encerra contrato — move para ex-inquilinos. endDate default hoje.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, endDate: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => endTenancy(a) },
  { name: 'create_charge', description: 'Cria nova cobrança avulsa para um inquilino.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, amount: { type: 'number' }, dueDate: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId', 'amount', 'dueDate'] }, fn: (a: any) => createCharge(a) },
  { name: 'issue_receipt', description: 'Registra recibo no histórico. referenceMonth no formato YYYY-MM.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, amount: { type: 'number' }, referenceMonth: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId', 'amount', 'referenceMonth'] }, fn: (a: any) => issueReceipt(a) },
  { name: 'draft_message', description: 'Gera mensagem profissional para WhatsApp + link wa.me. Tipos: friendly_charge, formal_charge, overdue, renewal, welcome, thanks.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, type: { type: 'string', enum: ['friendly_charge','formal_charge','overdue','renewal','welcome','thanks'] } }, required: ['tenantId', 'type'] }, fn: (a: any) => draftMessage(a) },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t.fn]));
const OAI_TOOLS = TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

const SYSTEM = `Você é o ASSISTENTE OPERACIONAL da Mesquita Administração de Imóveis. Você gerencia inquilinos, imóveis, contratos, pagamentos, recibos e cobranças via conversa natural em português brasileiro.

REGRAS:
- Sempre que possível, EXECUTE a ação usando as ferramentas. Não apenas explique.
- Para encontrar um inquilino, use 'search_tenants' com parte do nome. Se houver 1 resultado claro, prossiga. Se houver múltiplos, pergunte ao usuário qual.
- Para "fulano pagou": chame 'register_payment' apenas com tenantId — o sistema escolhe o mês em aberto mais antigo automaticamente.
- Se o usuário citar um mês explícito ("pagou outubro"), passe year + month.
- Aluguel pode ser antecipado: se usuário diz "pagou dezembro hoje" mas só há novembro em aberto, ainda assim aplique como dezembro se ele especificou.
- Confirme APENAS ações destrutivas (encerrar contrato, excluir dados). Pagamentos simples podem ser registrados direto.
- Datas: use YYYY-MM-DD. Hoje é ${today()}.
- Após executar, responda de forma curta confirmando o que foi feito (ex: "✓ Maria — outubro/2025 marcado como pago").
- Para perguntas ("quem deve?", "imóveis vazios?"), use a ferramenta apropriada e responda com lista clara em markdown.
- Para mensagens de WhatsApp, use 'draft_message' e devolva o link clicável.
- Valores em reais: use vírgula (R$ 1.500,00).
- Seja direto, prático e amigável. Não invente IDs nem dados.`;

// ============== MAIN HANDLER ==============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { messages: userMessages } = await req.json();
    if (!Array.isArray(userMessages)) {
      return json({ error: 'messages obrigatório' }, 400);
    }

    const messages: any[] = [{ role: 'system', content: SYSTEM }, ...userMessages];
    const toolTrace: any[] = [];

    for (let step = 0; step < 8; step++) {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_KEY}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          tools: OAI_TOOLS,
          tool_choice: 'auto',
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        if (res.status === 429) return json({ error: 'Limite de uso atingido. Tente novamente em instantes.' }, 429);
        if (res.status === 402) return json({ error: 'Créditos esgotados. Adicione créditos no workspace.' }, 402);
        return json({ error: `IA: ${res.status} ${t}` }, res.status);
      }
      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return json({ error: 'resposta vazia' }, 500);
      messages.push(msg);

      const calls = msg.tool_calls ?? [];
      if (!calls.length) {
        return json({ reply: msg.content ?? '', toolTrace });
      }
      for (const c of calls) {
        const name = c.function?.name;
        let args: any = {};
        try { args = JSON.parse(c.function?.arguments ?? '{}'); } catch {}
        let result: any;
        try {
          const fn = TOOL_MAP[name];
          if (!fn) throw new Error(`ferramenta desconhecida: ${name}`);
          result = await fn(args);
        } catch (e: any) {
          result = { error: String(e?.message ?? e) };
        }
        toolTrace.push({ name, args, result });
        messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) });
      }
    }
    return json({ reply: 'Limite de passos atingido. Tente reformular.', toolTrace });
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}