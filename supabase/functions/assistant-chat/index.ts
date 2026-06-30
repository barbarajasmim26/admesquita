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
const norm = (s: string) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = (s: string) => (s ?? '').toString().replace(/\D/g, '');

function tokenScore(query: string, haystack: string) {
  const q = norm(query);
  const hay = norm(haystack);
  if (!q || !hay) return 0;
  let score = 0;
  if (hay === q) score += 300;
  if (hay.includes(q)) score += 140;
  const qDigits = digits(query);
  if (qDigits.length >= 4 && digits(haystack).includes(qDigits)) score += 180;
  const qTokens = q.split(' ').filter(t => t.length >= 2);
  const hayTokens = hay.split(' ').filter(Boolean);
  for (const tk of qTokens) {
    if (hayTokens.includes(tk)) score += 30;
    else if (hayTokens.some(h => h.startsWith(tk) || tk.startsWith(h))) score += 16;
    else if (hay.includes(tk)) score += 8;
  }
  return score;
}

function firstDayOfMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ============== SMART SEARCH ==============
// Busca AMPLA: por nome, telefone, endereço, imóvel, proprietário, número da casa.
// Retorna ranking de candidatos com score.
async function smartFindTenants(query: string) {
  const s = sb();
  const q = norm(query);
  if (!q) return [];
  const [{ data: tenants }, { data: former }] = await Promise.all([
    s.from('tenants')
      .select('id, name, phone, email, status, house_number, rent_amount, due_day, cpf, property_id, start_date, properties(id, name, address, owner_name, owner_phone)')
      .limit(4000),
    s.from('former_tenants')
      .select('id, name, phone, email, house_number, rent_amount, due_day, cpf, property_id, start_date, exit_date, properties(id, name, address, owner_name, owner_phone)')
      .limit(4000),
  ]);
  const current = (tenants ?? []).map((t: any) => ({ ...t, source: 'tenants', kind: t.status === 'active' ? 'active_tenant' : 'inactive_tenant' }));
  const archived = (former ?? []).map((t: any) => ({ ...t, status: 'former', source: 'former_tenants', kind: 'former_tenant' }));
  const scored = [...current, ...archived].map((t: any) => {
    const hay = [t.name, t.phone, t.email, t.cpf, t.house_number, t.properties?.name, t.properties?.address, t.properties?.owner_name, t.properties?.owner_phone].filter(Boolean).join(' ');
    let score = tokenScore(query, hay);
    if (t.status === 'active') score += 8;
    if (t.status === 'former') score += 3;
    return { t, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
  return scored.map(({ t, score }) => ({
    id: t.id, source: t.source, kind: t.kind,
    name: t.name, phone: t.phone, email: t.email, cpf: t.cpf,
    status: t.status, house_number: t.house_number,
    rent: Number(t.rent_amount ?? 0), due_day: t.due_day,
    property_id: t.property_id,
    property: t.properties?.name, address: t.properties?.address,
    owner: t.properties?.owner_name, owner_phone: t.properties?.owner_phone,
    start_date: t.start_date, exit_date: t.exit_date, score,
  }));
}

async function smartFindProperties(query: string) {
  const s = sb();
  const q = norm(query);
  const { data } = await s.from('properties').select('id, name, address, owner_name, owner_phone, category, tenants(id, name, status)').limit(2000);
  const scored = (data ?? []).map((p: any) => {
    const hay = [p.name, p.address, p.owner_name, p.owner_phone, ...(p.tenants ?? []).map((x: any) => x.name)].filter(Boolean).join(' ');
    const score = tokenScore(query, hay);
    return { p, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
  return scored.map(({ p, score }) => ({
    id: p.id, name: p.name, address: p.address, owner: p.owner_name, owner_phone: p.owner_phone,
    category: p.category, score,
    active_tenants: (p.tenants ?? []).filter((x: any) => x.status === 'active').map((x: any) => x.name),
  }));
}

async function resolveTenant(queryOrId: string, preferActive = true) {
  if (!queryOrId) return { error: 'informe o inquilino' };
  if (/^[0-9a-f-]{36}$/i.test(queryOrId)) {
    const s = sb();
    const { data: t } = await s.from('tenants').select('id, name, status').eq('id', queryOrId).maybeSingle();
    if (t) return { tenant: { ...t, source: 'tenants' } };
    const { data: f } = await s.from('former_tenants').select('id, name').eq('id', queryOrId).maybeSingle();
    if (f) return { tenant: { ...f, status: 'former', source: 'former_tenants' } };
  }
  const found = await smartFindTenants(queryOrId);
  const ranked = preferActive ? [...found].sort((a: any, b: any) => (b.status === 'active' ? 10 : 0) + b.score - ((a.status === 'active' ? 10 : 0) + a.score)) : found;
  if (!ranked.length) return { error: `não encontrei inquilino para "${queryOrId}"` };
  if (ranked.length > 1 && ranked[0].score > 0 && Math.abs(ranked[0].score - ranked[1].score) <= 6) {
    return { ambiguous: true, candidates: ranked.slice(0, 5) };
  }
  return { tenant: ranked[0] };
}

async function resolveProperty(queryOrId: string) {
  if (!queryOrId) return { error: 'informe o imóvel' };
  if (/^[0-9a-f-]{36}$/i.test(queryOrId)) {
    const s = sb();
    const { data: p } = await s.from('properties').select('id, name').eq('id', queryOrId).maybeSingle();
    if (p) return { property: p };
  }
  const found = await smartFindProperties(queryOrId);
  if (!found.length) return { error: `não encontrei imóvel para "${queryOrId}"` };
  if (found.length > 1 && Math.abs(found[0].score - found[1].score) <= 6) return { ambiguous: true, candidates: found.slice(0, 5) };
  return { property: found[0] };
}

function csvEscape(value: any) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: any[]) {
  const headers = Array.from(rows.reduce((set: Set<string>, row: any) => {
    Object.keys(row ?? {}).forEach(k => set.add(k));
    return set;
  }, new Set<string>()));
  return [headers.join(';'), ...rows.map(row => headers.map(h => csvEscape(row?.[h])).join(';'))].join('\n');
}

// ============== TOOLS ==============

async function searchTenants(q: string) {
  return smartFindTenants(q);
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
  const resolved = await resolveTenant(tenantId, false);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const hit = (resolved as any).tenant;
  if (hit.source === 'former_tenants') {
    const { data: f } = await s.from('former_tenants').select('*, properties(id,name,address,owner_name,owner_phone)').eq('id', hit.id).maybeSingle();
    if (!f) return { error: 'ex-inquilino não encontrado' };
    return {
      tenant: { id: f.id, name: f.name, phone: f.phone, cpf: f.cpf, rent: Number(f.rent_amount ?? 0), due_day: f.due_day, status: 'former', property: f.properties?.name, house_number: f.house_number, exit_date: f.exit_date },
      open_months: [], overdue_count: 0, last_payments: [],
      note: 'Registro localizado em ex-inquilinos.'
    };
  }
  const [{ data: t }, { data: pays }] = await Promise.all([
    s.from('tenants').select('*, properties(id,name,address)').eq('id', hit.id).maybeSingle(),
    s.from('payments').select('id, amount, paid_amount, due_date, paid_date, status').eq('tenant_id', hit.id).order('due_date', { ascending: false }).limit(36),
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
  const { data } = await s.from('payments').select('id, amount, due_date, tenant_id, tenants(id,name,phone,status,properties(name))')
    .neq('status', 'paid').lt('due_date', today()).limit(500);
  const map: Record<string, any> = {};
  (data ?? []).forEach((p: any) => {
    if (!p.tenants || p.tenants.status !== 'active') return;
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
async function registerPayment(args: { tenantId: string; year?: number; month?: number; paidDate?: string; amount?: number }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const { data: t } = await s.from('tenants').select('id, rent_amount, due_day, name, status').eq('id', tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };
  if (t.status !== 'active') return { error: 'inquilino não está ativo; não posso registrar pagamento em locação encerrada' };

  let year = args.year, month = args.month;
  if (!year || !month) {
    // pick oldest open
    const { data: open } = await s.from('payments').select('id, due_date').eq('tenant_id', tenantId).neq('status', 'paid').order('due_date').limit(1);
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
  const { data: existing } = await s.from('payments').select('id').eq('tenant_id', tenantId).gte('due_date', start).lte('due_date', end).limit(1).maybeSingle();

  let pid = existing?.id;
  const valor = Number(args.amount ?? t.rent_amount ?? 0);
  if (!pid) {
    const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', tenantId).eq('status', 'active').limit(1).maybeSingle();
    if (!ct) return { error: 'sem contrato ativo' };
    const dueDay = Math.min(Number(t.due_day ?? 10), lastDay);
    const dueDate = `${year}-${mm}-${String(dueDay).padStart(2, '0')}`;
    const { data: ins, error } = await s.from('payments').insert({
      tenant_id: tenantId, contract_id: ct.id, amount: valor, due_date: dueDate, status: 'pending',
    }).select('id').single();
    if (error) return { error: error.message };
    pid = ins.id;
  }
  const paidDate = args.paidDate ?? today();
  await s.from('payments').update({ status: 'paid', paid_date: paidDate, paid_amount: valor }).eq('id', pid);
  return { ok: true, tenant: t.name, competencia: `${MESES[month! - 1]}/${year}`, amount: valor, paid_date: paidDate };
}

// Desmarca pagamento (volta para pendente) — corrige erros
async function unmarkPayment(args: { tenantId: string; year: number; month: number }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const mm = String(args.month).padStart(2, '0');
  const start = `${args.year}-${mm}-01`;
  const lastDay = new Date(args.year, args.month, 0).getDate();
  const end = `${args.year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  const { data: p } = await s.from('payments').select('id').eq('tenant_id', tenantId).gte('due_date', start).lte('due_date', end).limit(1).maybeSingle();
  if (!p) return { error: 'sem pagamento neste mês' };
  await s.from('payments').update({ status: 'pending', paid_date: null, paid_amount: null }).eq('id', p.id);
  return { ok: true, competencia: `${MESES[args.month - 1]}/${args.year}` };
}

// Atualiza dados do inquilino (vários campos opcionais)
async function updateTenant(args: { tenantId: string; name?: string; phone?: string; cpf?: string; house_number?: string; rent_amount?: number; due_day?: number; pix_payer?: string; notes?: string; email?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  if ((resolved as any).tenant.source !== 'tenants') return { error: 'este registro está em ex-inquilinos; use update_former_tenant para alterar histórico' };
  const tenantId = (resolved as any).tenant.id;
  const payload: any = {};
  for (const k of ['name','phone','cpf','house_number','rent_amount','due_day','pix_payer','notes','email']) {
    if ((args as any)[k] !== undefined) payload[k] = (args as any)[k];
  }
  if (!Object.keys(payload).length) return { error: 'nenhum campo informado' };
  const { error } = await s.from('tenants').update(payload).eq('id', tenantId);
  if (error) return { error: error.message };
  // Se rent_amount mudou, propaga para contrato ativo e pagamentos pendentes
  if (payload.rent_amount !== undefined) {
    await s.from('contracts').update({ rent_amount: payload.rent_amount }).eq('tenant_id', tenantId).eq('status', 'active');
    await s.from('payments').update({ amount: payload.rent_amount }).eq('tenant_id', tenantId).neq('status', 'paid');
  }
  if (payload.due_day !== undefined) {
    await s.from('contracts').update({ due_day: payload.due_day }).eq('tenant_id', tenantId).eq('status', 'active');
  }
  return { ok: true, tenant: (resolved as any).tenant.name, updated: payload };
}

// Atualiza contrato ativo (datas, valor, índice, fiador)
async function updateContract(args: { tenantId: string; start_date?: string; end_date?: string; rent_amount?: number; due_day?: number; duration_months?: number; readjustment_index?: string; guarantor_name?: string; guarantor_cpf?: string; guarantor_phone?: string; auto_renew?: boolean; status?: string; terms?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const payload: any = {};
  for (const k of ['start_date','end_date','rent_amount','due_day','duration_months','readjustment_index','guarantor_name','guarantor_cpf','guarantor_phone','auto_renew','status','terms']) {
    if ((args as any)[k] !== undefined) payload[k] = (args as any)[k];
  }
  if (!Object.keys(payload).length) return { error: 'nenhum campo informado' };
  const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', tenantId).eq('status', 'active').limit(1).maybeSingle();
  if (!ct) return { error: 'sem contrato ativo' };
  const { error } = await s.from('contracts').update(payload).eq('id', ct.id);
  if (error) return { error: error.message };
  if (payload.rent_amount !== undefined) await s.from('tenants').update({ rent_amount: payload.rent_amount }).eq('id', tenantId);
  if (payload.due_day !== undefined) await s.from('tenants').update({ due_day: payload.due_day }).eq('id', tenantId);
  return { ok: true, tenant: (resolved as any).tenant.name, updated: payload };
}

// Transfere titularidade: encerra inquilino atual no imóvel e cria novo no mesmo imóvel
async function transferTitularity(args: { fromTenantId: string; newName: string; newPhone?: string; newCpf?: string; rent_amount?: number; due_day?: number; start_date?: string; house_number?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.fromTenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const fromTenantId = (resolved as any).tenant.id;
  const { data: from } = await s.from('tenants').select('*, properties(name)').eq('id', fromTenantId).maybeSingle();
  if (!from) return { error: 'inquilino atual não encontrado' };
  if (from.status !== 'active') return { error: 'inquilino de origem não está ativo' };
  const propertyId = from.property_id;
  const startDate = args.start_date ?? today();
  // arquivar antigo
  await s.from('former_tenants').insert({
    name: from.name, property_id: propertyId,
    phone: from.phone, email: from.email, cpf: from.cpf, house_number: from.house_number,
    start_date: from.start_date, exit_date: startDate, rent_amount: from.rent_amount, due_day: from.due_day,
    notes: `Transferência de titularidade para ${args.newName}`,
  });
  await s.from('tenants').update({ status: 'inactive' }).eq('id', fromTenantId);
  await s.from('contracts').update({ status: 'ended', end_date: startDate }).eq('tenant_id', fromTenantId).eq('status', 'active');
  // criar novo
  const rent = args.rent_amount ?? Number(from.rent_amount ?? 0);
  const dueDay = args.due_day ?? Number(from.due_day ?? 10);
  const { data: newT, error } = await s.from('tenants').insert({
    name: args.newName, property_id: propertyId, phone: args.newPhone ?? null, cpf: args.newCpf ?? null,
    house_number: args.house_number ?? from.house_number, rent_amount: rent, due_day: dueDay,
    start_date: startDate, status: 'active',
  }).select('id').single();
  if (error) return { error: error.message };
  // criar contrato
  await s.from('contracts').insert({
    tenant_id: newT.id, property_id: propertyId, start_date: startDate, rent_amount: rent, due_day: dueDay, status: 'active',
  });
  return { ok: true, new_tenant: args.newName, property: from.properties?.name, predecessor: from.name };
}

// Lista imóveis por proprietário
async function listPropertiesByOwner(ownerQuery: string) {
  const s = sb();
  const q = norm(ownerQuery);
  const { data } = await s.from('properties').select('id, name, address, owner_name, owner_phone, tenants(id, name, status)');
  return (data ?? []).filter((p: any) => norm(p.owner_name ?? '').includes(q))
    .map((p: any) => ({
      name: p.name, address: p.address, owner: p.owner_name,
      active_tenants: (p.tenants ?? []).filter((x: any) => x.status === 'active').map((x: any) => x.name),
    }));
}

async function endTenancy(args: { tenantId: string; endDate?: string; notes?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const { data: t } = await s.from('tenants').select('*, properties(name)').eq('id', tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };
  if (t.status !== 'active') return { error: 'inquilino já não está ativo' };
  const endDate = args.endDate ?? today();
  await s.from('former_tenants').insert({
    name: t.name, property_id: t.property_id, phone: t.phone, email: t.email, cpf: t.cpf, house_number: t.house_number,
    start_date: t.start_date, exit_date: endDate, rent_amount: t.rent_amount, due_day: t.due_day, notes: args.notes ?? t.notes,
  });
  await s.from('tenants').update({ status: 'inactive' }).eq('id', tenantId);
  await s.from('contracts').update({ status: 'ended', end_date: endDate }).eq('tenant_id', tenantId).eq('status', 'active');
  return { ok: true, name: t.name, end_date: endDate };
}

async function createCharge(args: { tenantId: string; amount: number; dueDate: string; notes?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', tenantId).eq('status', 'active').limit(1).maybeSingle();
  if (!ct) return { error: 'sem contrato ativo' };
  const { error } = await s.from('payments').insert({
    tenant_id: tenantId, contract_id: ct.id, amount: args.amount, due_date: args.dueDate, status: 'pending', notes: args.notes,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

async function getReceiptData(tenantId: string, amount: number, referenceMonth: string, notes?: string) {
  const s = sb();
  const resolved = await resolveTenant(tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return null;
  const id = (resolved as any).tenant.id;
  const { data: t } = await s.from("tenants").select("*, properties(*)").eq("id", id).maybeSingle();
  if (!t) return null;
  const [year, month] = referenceMonth.split("-").map(Number);
  return {
    tenantName: t.name,
    tenantCpf: t.cpf,
    amount,
    propertyName: t.properties?.name,
    propertyAddress: t.properties?.address,
    houseNumber: t.house_number,
    referenceMonth: month,
    referenceYear: year,
    pixPayer: t.pix_payer,
    notes
  };
}

async function issueReceipt(args: { tenantId: string; amount: number; referenceMonth: string; notes?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const year = new Date().getFullYear();
  const { count } = await s.from('receipts_history').select('*', { count: 'exact', head: true })
    .gte('issued_at', `${year}-01-01`).lt('issued_at', `${year + 1}-01-01`);
  const seq = String((count ?? 0) + 1).padStart(4, '0');
  const number = `${year}/${seq}`;
  await s.from('receipts_history').insert({
    tenant_id: tenantId, amount: args.amount, reference_month: args.referenceMonth, notes: args.notes ?? null, receipt_number: number,
  });
  const receiptData = await getReceiptData(tenantId, args.amount, args.referenceMonth, args.notes);
  return { ok: true, number, __action: "download_receipt_pdf", filename: `recibo-${number.replace("/", "-")}.pdf`, receiptData };
}

async function draftMessage(args: { tenantId: string; type: 'friendly_charge' | 'formal_charge' | 'overdue' | 'renewal' | 'welcome' | 'thanks' }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const { data: t } = await s.from('tenants').select('name, phone, rent_amount, due_day, pix_payer, properties(name)').eq('id', (resolved as any).tenant.id).maybeSingle();
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

// Prepara payload para o cliente gerar PDF de contrato (cópia de contrato existente com overrides).
// Retorna objeto ContractData compatível com src/lib/contract-pdf.ts.
async function prepareContractCopy(args: {
  tenantId?: string;
  contractId?: string;
  overrides?: Partial<{
    tenantName: string; tenantNationality: string; tenantMaritalStatus: string; tenantProfession: string;
    tenantRg: string; tenantCpf: string; tenantAddress: string;
    propertyAddress: string;
    rentAmount: number; depositAmount: number; dueDay: number;
    startDate: string; endDate: string; signDate: string;
    durationYears: number; readjustmentIndex: string;
  }>;
}) {
  const s = sb();
  let contract: any = null;
  if (args.contractId) {
    const { data } = await s.from('contracts').select('*, tenants(*), properties(*)').eq('id', args.contractId).maybeSingle();
    contract = data;
  } else if (args.tenantId) {
    const resolved = await resolveTenant(args.tenantId, false);
    if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
    const { data } = await s.from('contracts').select('*, tenants(*), properties(*)').eq('tenant_id', (resolved as any).tenant.id).order('start_date', { ascending: false }).limit(1).maybeSingle();
    contract = data;
  }
  if (!contract) return { error: 'contrato não encontrado' };
  const t = contract.tenants ?? {};
  const p = contract.properties ?? {};
  const o = args.overrides ?? {};
  const startDate = o.startDate ?? contract.start_date ?? today();
  const endDate = o.endDate ?? contract.end_date ?? (() => {
    const d = new Date(startDate); d.setFullYear(d.getFullYear() + (o.durationYears ?? 3)); return d.toISOString().slice(0,10);
  })();
  const propertyAddress = o.propertyAddress ?? [p.address, t.house_number ? `casa ${t.house_number}` : null].filter(Boolean).join(', ') ?? '';
  const rent = Number(o.rentAmount ?? contract.rent_amount ?? t.rent_amount ?? 0);
  const data = {
    tenantName: o.tenantName ?? t.name ?? '',
    tenantNationality: o.tenantNationality ?? 'brasileiro(a)',
    tenantMaritalStatus: o.tenantMaritalStatus,
    tenantProfession: o.tenantProfession,
    tenantRg: o.tenantRg,
    tenantCpf: o.tenantCpf ?? t.cpf ?? undefined,
    tenantAddress: o.tenantAddress ?? propertyAddress,
    propertyAddress,
    durationYears: o.durationYears ?? 3,
    startDate, endDate,
    rentAmount: rent,
    depositAmount: Number(o.depositAmount ?? rent),
    dueDay: Number(o.dueDay ?? contract.due_day ?? t.due_day ?? 10),
    readjustmentIndex: o.readjustmentIndex ?? contract.readjustment_index ?? 'IGP-M',
    signDate: o.signDate ?? today(),
  };
  const filename = `contrato-${(data.tenantName || 'novo').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-')}.pdf`;
  return { __action: 'download_contract_pdf', filename, contractData: data, source_tenant: t.name };
}

async function prepareReceiptPdf(args: { tenantId: string; amount?: number; referenceMonth?: string; issueDate?: string; pixPayer?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const { data: t } = await s.from('tenants').select('*, properties(*)').eq('id', tenantId).maybeSingle();
  if (!t) return { error: 'inquilino não encontrado' };

  let ref = args.referenceMonth;
  let amount = args.amount;
  if (!ref || !amount) {
    const { data: p } = await s.from('payments')
      .select('amount, paid_amount, due_date, paid_date, status')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ref && p?.due_date) ref = ymOf(p.due_date);
    if (!amount) amount = Number(p?.paid_amount ?? p?.amount ?? t.rent_amount ?? 0);
  }
  ref ||= today().slice(0, 7);
  const [year, month] = ref.includes('-') ? ref.split('-').map(Number) : [new Date().getFullYear(), Number(ref.split('/')[0])];
  const receiptData = {
    tenantName: t.name,
    tenantCpf: t.cpf,
    amount: Number(amount ?? t.rent_amount ?? 0),
    propertyName: t.properties?.name ?? '',
    propertyAddress: t.properties?.address ?? null,
    houseNumber: t.house_number ?? null,
    referenceMonth: month,
    referenceYear: year,
    issueDate: args.issueDate ?? today(),
    pixPayer: args.pixPayer ?? t.pix_payer ?? null,
  };
  const filename = `recibo-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(month).padStart(2, '0')}-${year}.pdf`;
  return { __action: 'download_receipt_pdf', filename, receiptData };
}

async function updateFormerTenant(args: { tenantId: string; name?: string; phone?: string; email?: string; cpf?: string; house_number?: string; rent_amount?: number; due_day?: number; start_date?: string; exit_date?: string; final_balance?: number; notes?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, false);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const hit = (resolved as any).tenant;
  const payload: any = {};
  for (const k of ['name','phone','email','cpf','house_number','rent_amount','due_day','start_date','exit_date','final_balance','notes']) {
    if ((args as any)[k] !== undefined) payload[k] = (args as any)[k];
  }
  if (!Object.keys(payload).length) return { error: 'nenhum campo informado' };
  if (hit.source === 'former_tenants') {
    const { error } = await s.from('former_tenants').update(payload).eq('id', hit.id);
    if (error) return { error: error.message };
    return { ok: true, tenant: hit.name, updated: payload };
  }
  if (hit.status === 'inactive') {
    const { error } = await s.from('tenants').update(payload).eq('id', hit.id);
    if (error) return { error: error.message };
    return { ok: true, tenant: hit.name, updated: payload };
  }
  return { error: 'este inquilino está ativo; use update_tenant' };
}

async function updateProperty(args: { propertyId: string; name?: string; address?: string; owner_name?: string; owner_phone?: string; category?: string; type?: string; iptu?: number; notes?: string }) {
  const s = sb();
  const resolved = await resolveProperty(args.propertyId);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const propertyId = (resolved as any).property.id;
  const payload: any = {};
  for (const k of ['name','address','owner_name','owner_phone','category','type','iptu','notes']) {
    if ((args as any)[k] !== undefined) payload[k] = (args as any)[k];
  }
  if (!Object.keys(payload).length) return { error: 'nenhum campo informado' };
  const { error } = await s.from('properties').update(payload).eq('id', propertyId);
  if (error) return { error: error.message };
  return { ok: true, property: (resolved as any).property.name, updated: payload };
}

async function createTask(args: { title: string; description?: string; dueDate?: string; dueTime?: string; priority?: string; tenantId?: string; propertyId?: string }) {
  const s = sb();
  let tenant_id: string | null = null;
  let property_id: string | null = null;
  if (args.tenantId) {
    const r = await resolveTenant(args.tenantId, true);
    if ((r as any).error || (r as any).ambiguous) return r;
    tenant_id = (r as any).tenant.id;
  }
  if (args.propertyId) {
    const r = await resolveProperty(args.propertyId);
    if ((r as any).error || (r as any).ambiguous) return r;
    property_id = (r as any).property.id;
  }
  const { data, error } = await s.from('tasks').insert({
    title: args.title,
    description: args.description ?? null,
    due_date: args.dueDate ?? today(),
    due_time: args.dueTime ?? null,
    priority: args.priority ?? 'normal',
    status: 'pending',
    tenant_id, property_id,
  }).select('id,title,due_date').single();
  if (error) return { error: error.message };
  return { ok: true, task: data };
}

async function createLead(args: { name: string; phone?: string; email?: string; source?: string; interest?: string; budget?: number; propertyId?: string; status?: string; notes?: string; next_followup?: string }) {
  const s = sb();
  let property_id: string | null = null;
  if (args.propertyId) {
    const r = await resolveProperty(args.propertyId);
    if ((r as any).error || (r as any).ambiguous) return r;
    property_id = (r as any).property.id;
  }
  const { data, error } = await s.from('leads').insert({
    name: args.name, phone: args.phone ?? null, email: args.email ?? null, source: args.source ?? null,
    interest: args.interest ?? null, budget: args.budget ?? null, property_id,
    status: args.status ?? 'novo', notes: args.notes ?? null, next_followup: args.next_followup ?? null,
  }).select('id,name,status').single();
  if (error) return { error: error.message };
  return { ok: true, lead: data };
}

async function updateMonthPayment(args: { tenantId: string; year: number; month: number; amount?: number; dueDate?: string; paidDate?: string; paidAmount?: number; status?: 'paid' | 'pending' | 'overdue'; notes?: string }) {
  const s = sb();
  const resolved = await resolveTenant(args.tenantId, true);
  if ((resolved as any).error || (resolved as any).ambiguous) return resolved;
  const tenantId = (resolved as any).tenant.id;
  const { data: t } = await s.from('tenants').select('rent_amount,due_day').eq('id', tenantId).maybeSingle();
  const start = firstDayOfMonth(args.year, args.month);
  const end = lastDayOfMonth(args.year, args.month);
  const { data: existing } = await s.from('payments').select('id').eq('tenant_id', tenantId).gte('due_date', start).lte('due_date', end).limit(1).maybeSingle();
  let paymentId = existing?.id;
  if (!paymentId) {
    const { data: ct } = await s.from('contracts').select('id').eq('tenant_id', tenantId).eq('status', 'active').limit(1).maybeSingle();
    if (!ct) return { error: 'sem contrato ativo' };
    const dueDay = Math.min(Number(t?.due_day ?? 10), new Date(args.year, args.month, 0).getDate());
    const { data: row, error } = await s.from('payments').insert({
      tenant_id: tenantId, contract_id: ct.id, amount: Number(args.amount ?? t?.rent_amount ?? 0),
      due_date: args.dueDate ?? `${args.year}-${String(args.month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`,
      status: args.status ?? 'pending', notes: args.notes ?? null,
    }).select('id').single();
    if (error) return { error: error.message };
    paymentId = row.id;
  }
  const payload: any = {};
  if (args.amount !== undefined) payload.amount = args.amount;
  if (args.dueDate !== undefined) payload.due_date = args.dueDate;
  if (args.notes !== undefined) payload.notes = args.notes;
  if (args.status !== undefined) payload.status = args.status;
  if (args.paidDate !== undefined) payload.paid_date = args.paidDate;
  if (args.paidAmount !== undefined) payload.paid_amount = args.paidAmount;
  if (args.status === 'paid') {
    payload.paid_date = args.paidDate ?? today();
    payload.paid_amount = args.paidAmount ?? args.amount ?? t?.rent_amount ?? 0;
  }
  if (args.status === 'pending' || args.status === 'overdue') {
    payload.paid_date = null;
    payload.paid_amount = null;
  }
  const { error } = await s.from('payments').update(payload).eq('id', paymentId);
  if (error) return { error: error.message };
  return { ok: true, competencia: `${MESES[args.month - 1]}/${args.year}`, updated: payload };
}

async function prepareDataDownload(args: { kind: string; format?: 'csv' | 'json'; tenantId?: string; year?: number; month?: number; status?: string }) {
  const s = sb();
  const kind = (args.kind ?? '').toLowerCase();
  const format = args.format ?? 'csv';
  let rows: any[] = [];
  let filename = `${kind || 'dados'}-${today()}.${format}`;

  if (kind === 'inquilinos' || kind === 'tenants') {
    const { data } = await s.from('tenants').select('name,phone,email,cpf,status,house_number,rent_amount,due_day,start_date,properties(name,address,owner_name)').order('name').limit(1000);
    rows = (data ?? []).map((t: any) => ({ nome: t.name, telefone: t.phone, email: t.email, cpf: t.cpf, status: t.status, casa: t.house_number, aluguel: t.rent_amount, vencimento: t.due_day, inicio: t.start_date, imovel: t.properties?.name, endereco: t.properties?.address, proprietario: t.properties?.owner_name }));
    filename = `inquilinos-${today()}.${format}`;
  } else if (kind === 'ex-inquilinos' || kind === 'former_tenants') {
    const { data } = await s.from('former_tenants').select('name,phone,email,cpf,house_number,rent_amount,due_day,start_date,exit_date,final_balance,notes,properties(name,address,owner_name)').order('exit_date', { ascending: false }).limit(1000);
    rows = (data ?? []).map((t: any) => ({ nome: t.name, telefone: t.phone, email: t.email, cpf: t.cpf, casa: t.house_number, aluguel: t.rent_amount, vencimento: t.due_day, entrada: t.start_date, saida: t.exit_date, saldo_final: t.final_balance, observacoes: t.notes, imovel: t.properties?.name, endereco: t.properties?.address, proprietario: t.properties?.owner_name }));
    filename = `ex-inquilinos-${today()}.${format}`;
  } else if (kind === 'imoveis' || kind === 'properties') {
    const { data } = await s.from('properties').select('name,address,category,type,owner_name,owner_phone,iptu,notes,tenants(name,status)').order('name').limit(1000);
    rows = (data ?? []).map((p: any) => ({ imovel: p.name, endereco: p.address, categoria: p.category, tipo: p.type, proprietario: p.owner_name, telefone_proprietario: p.owner_phone, iptu: p.iptu, observacoes: p.notes, inquilinos_ativos: (p.tenants ?? []).filter((t: any) => t.status === 'active').map((t: any) => t.name).join(', ') }));
    filename = `imoveis-${today()}.${format}`;
  } else if (kind === 'pagamentos' || kind === 'payments' || kind === 'inadimplencia') {
    let q: any = s.from('payments').select('amount,paid_amount,due_date,paid_date,status,notes,tenants(name,phone,status,properties(name,address))').order('due_date', { ascending: false });
    if (args.status) q = q.eq('status', args.status);
    if (kind === 'inadimplencia') q = q.neq('status', 'paid').lt('due_date', today());
    if (args.year && args.month) q = q.gte('due_date', firstDayOfMonth(args.year, args.month)).lte('due_date', lastDayOfMonth(args.year, args.month));
    const { data } = await q.limit(1500);
    rows = (data ?? []).filter((p: any) => !p.tenants || p.tenants.status === 'active').map((p: any) => ({ inquilino: p.tenants?.name, telefone: p.tenants?.phone, imovel: p.tenants?.properties?.name, valor: p.amount, valor_pago: p.paid_amount, vencimento: p.due_date, pagamento: p.paid_date, status: p.status, observacoes: p.notes }));
    filename = `${kind === 'inadimplencia' ? 'inadimplencia' : 'pagamentos'}-${today()}.${format}`;
  } else if (kind === 'contratos' || kind === 'contracts') {
    const { data } = await s.from('contracts').select('start_date,end_date,rent_amount,due_day,status,readjustment_index,guarantor_name,tenants(name,status),properties(name,address,owner_name)').order('start_date', { ascending: false }).limit(1000);
    rows = (data ?? []).map((c: any) => ({ inquilino: c.tenants?.name, status_inquilino: c.tenants?.status, imovel: c.properties?.name, endereco: c.properties?.address, proprietario: c.properties?.owner_name, inicio: c.start_date, fim: c.end_date, aluguel: c.rent_amount, vencimento: c.due_day, status: c.status, reajuste: c.readjustment_index, fiador: c.guarantor_name }));
    filename = `contratos-${today()}.${format}`;
  } else if (kind === 'recibos' || kind === 'receipts') {
    const { data } = await s.from('receipts_history').select('receipt_number,amount,reference_month,issued_at,notes,tenants(name,cpf,phone,properties(name,address))').order('issued_at', { ascending: false }).limit(1000);
    rows = (data ?? []).map((r: any) => ({ numero: r.receipt_number, inquilino: r.tenants?.name, cpf: r.tenants?.cpf, telefone: r.tenants?.phone, imovel: r.tenants?.properties?.name, valor: r.amount, competencia: r.reference_month, emitido_em: r.issued_at, observacoes: r.notes }));
    filename = `recibos-${today()}.${format}`;
  } else {
    return { error: 'tipo de download não reconhecido. Use: inquilinos, ex-inquilinos, imoveis, pagamentos, inadimplencia, contratos ou recibos.' };
  }

  const content = format === 'json' ? JSON.stringify(rows, null, 2) : toCsv(rows);
  return { __action: 'download_file', filename, mime: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8', content, rows: rows.length };
}

// ============== TOOL REGISTRY ==============
const TOOLS = [
  { name: 'search_tenants', description: 'Busca INTELIGENTE de inquilinos: por nome (mesmo parcial, sem acento), telefone, CPF, número da casa, nome do imóvel, endereço, OU nome do proprietário. Use sempre antes de dizer que não encontrou alguém.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, fn: (a: any) => smartFindTenants(a.query) },
  { name: 'search_properties', description: 'Busca imóveis por nome, endereço, proprietário ou nome de inquilino atual.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, fn: (a: any) => smartFindProperties(a.query) },
  { name: 'list_properties_by_owner', description: 'Lista todos os imóveis de um proprietário.', parameters: { type: 'object', properties: { owner: { type: 'string' } }, required: ['owner'] }, fn: (a: any) => listPropertiesByOwner(a.owner) },
  { name: 'list_active_tenants', description: 'Listar todos os inquilinos ativos.', parameters: { type: 'object', properties: {} }, fn: () => listActiveTenants() },
  { name: 'get_tenant_summary', description: 'Resumo completo do inquilino: dados, meses em aberto, últimos pagamentos.', parameters: { type: 'object', properties: { tenantId: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => getTenantSummary(a.tenantId) },
  { name: 'list_overdue', description: 'Lista inquilinos com pagamentos em atraso (inadimplentes).', parameters: { type: 'object', properties: {} }, fn: () => listOverdue() },
  { name: 'list_paid_this_month', description: 'Lista pagamentos recebidos no mês atual.', parameters: { type: 'object', properties: {} }, fn: () => listPaidThisMonth() },
  { name: 'list_vacant_properties', description: 'Lista imóveis vazios (sem inquilino ativo).', parameters: { type: 'object', properties: {} }, fn: () => listVacantProperties() },
  { name: 'list_contracts_ending', description: 'Contratos vencendo nos próximos N dias (default 60).', parameters: { type: 'object', properties: { days: { type: 'number' } } }, fn: (a: any) => listContractsEnding(a.days ?? 60) },
  { name: 'register_payment', description: 'Marca COMPETÊNCIA (year+month) como paga. paidDate é a DATA em que foi pago (pode ser mês diferente — ex: abril pago em maio). Se year/month omitidos, usa mês em aberto mais antigo. amount opcional (default = valor do aluguel).', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, year: { type: 'number' }, month: { type: 'number' }, paidDate: { type: 'string' }, amount: { type: 'number' } }, required: ['tenantId'] }, fn: (a: any) => registerPayment(a) },
  { name: 'unmark_payment', description: 'Desfaz pagamento errado: volta o mês para pendente. Use quando o usuário disser que um mês foi marcado por engano.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, year: { type: 'number' }, month: { type: 'number' } }, required: ['tenantId','year','month'] }, fn: (a: any) => unmarkPayment(a) },
  { name: 'update_tenant', description: 'Atualiza dados do inquilino (nome, telefone, cpf, house_number, rent_amount, due_day, pix_payer, email, notes). Se rent_amount mudar, propaga para contrato ativo e pagamentos pendentes.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, cpf: { type: 'string' }, house_number: { type: 'string' }, rent_amount: { type: 'number' }, due_day: { type: 'number' }, pix_payer: { type: 'string' }, email: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => updateTenant(a) },
  { name: 'update_former_tenant', description: 'Atualiza dados de ex-inquilino/histórico (nome, telefone, cpf, casa, valor, datas, saldo final, observações). Use para registros encerrados.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, cpf: { type: 'string' }, house_number: { type: 'string' }, rent_amount: { type: 'number' }, due_day: { type: 'number' }, start_date: { type: 'string' }, exit_date: { type: 'string' }, final_balance: { type: 'number' }, notes: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => updateFormerTenant(a) },
  { name: 'update_property', description: 'Atualiza dados de imóvel/proprietário: nome, endereço, proprietário, telefone do proprietário, categoria, IPTU, observações.', parameters: { type: 'object', properties: { propertyId: { type: 'string' }, name: { type: 'string' }, address: { type: 'string' }, owner_name: { type: 'string' }, owner_phone: { type: 'string' }, category: { type: 'string' }, type: { type: 'string' }, iptu: { type: 'number' }, notes: { type: 'string' } }, required: ['propertyId'] }, fn: (a: any) => updateProperty(a) },
  { name: 'update_contract', description: 'Atualiza contrato ativo: datas, valor, vencimento, índice, fiador, status.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' }, rent_amount: { type: 'number' }, due_day: { type: 'number' }, duration_months: { type: 'number' }, readjustment_index: { type: 'string' }, guarantor_name: { type: 'string' }, guarantor_cpf: { type: 'string' }, guarantor_phone: { type: 'string' }, auto_renew: { type: 'boolean' }, status: { type: 'string' }, terms: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => updateContract(a) },
  { name: 'transfer_titularity', description: 'Transfere titularidade do imóvel: arquiva inquilino atual em ex-inquilinos e cria novo no mesmo imóvel com novo contrato. Use para "troca o nome do contrato para X", "agora quem mora é X", "passa para o nome do X".', parameters: { type: 'object', properties: { fromTenantId: { type: 'string' }, newName: { type: 'string' }, newPhone: { type: 'string' }, newCpf: { type: 'string' }, rent_amount: { type: 'number' }, due_day: { type: 'number' }, start_date: { type: 'string' }, house_number: { type: 'string' } }, required: ['fromTenantId','newName'] }, fn: (a: any) => transferTitularity(a) },
  { name: 'end_tenancy', description: 'Encerra contrato — move para ex-inquilinos. endDate default hoje.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, endDate: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => endTenancy(a) },
  { name: 'create_charge', description: 'Cria nova cobrança avulsa para um inquilino.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, amount: { type: 'number' }, dueDate: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId', 'amount', 'dueDate'] }, fn: (a: any) => createCharge(a) },
  { name: 'update_month_payment', description: 'Altera ou cria cobrança de uma competência: valor, vencimento, status, data de pagamento e observações. Use para corrigir pagamentos sem depender de id técnico.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, year: { type: 'number' }, month: { type: 'number' }, amount: { type: 'number' }, dueDate: { type: 'string' }, paidDate: { type: 'string' }, paidAmount: { type: 'number' }, status: { type: 'string', enum: ['paid','pending','overdue'] }, notes: { type: 'string' } }, required: ['tenantId','year','month'] }, fn: (a: any) => updateMonthPayment(a) },
  { name: 'issue_receipt', description: 'Registra recibo no histórico e gera PDF para download. referenceMonth no formato YYYY-MM.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, amount: { type: 'number' }, referenceMonth: { type: 'string' }, notes: { type: 'string' } }, required: ['tenantId', 'amount', 'referenceMonth'] }, fn: (a: any) => issueReceipt(a) },
  { name: 'prepare_receipt_pdf', description: 'Prepara recibo PDF para download sem necessariamente registrar novo histórico. Se valor ou competência faltarem, usa o último pagamento/aluguel.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, amount: { type: 'number' }, referenceMonth: { type: 'string' }, issueDate: { type: 'string' }, pixPayer: { type: 'string' } }, required: ['tenantId'] }, fn: (a: any) => prepareReceiptPdf(a) },
  { name: 'draft_message', description: 'Gera mensagem profissional para WhatsApp + link wa.me. Tipos: friendly_charge, formal_charge, overdue, renewal, welcome, thanks.', parameters: { type: 'object', properties: { tenantId: { type: 'string' }, type: { type: 'string', enum: ['friendly_charge','formal_charge','overdue','renewal','welcome','thanks'] } }, required: ['tenantId', 'type'] }, fn: (a: any) => draftMessage(a) },
  { name: 'create_task', description: 'Cria tarefa/agenda/lembrete no sistema, podendo vincular a inquilino ou imóvel.', parameters: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, dueDate: { type: 'string' }, dueTime: { type: 'string' }, priority: { type: 'string' }, tenantId: { type: 'string' }, propertyId: { type: 'string' } }, required: ['title'] }, fn: (a: any) => createTask(a) },
  { name: 'create_lead', description: 'Cria interessado/lead no CRM com telefone, interesse, imóvel, orçamento e próximo follow-up.', parameters: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, source: { type: 'string' }, interest: { type: 'string' }, budget: { type: 'number' }, propertyId: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' }, next_followup: { type: 'string' } }, required: ['name'] }, fn: (a: any) => createLead(a) },
  { name: 'prepare_contract_copy', description: 'Gera um PDF de contrato copiando um contrato existente (do tenantId ou contractId) e aplicando overrides (novo nome, novo valor, novo endereço, novas datas, etc.). NÃO altera o contrato original — apenas devolve um PDF para download. Use quando o usuário pedir "faz um contrato igual o do X mudando isso", "copia o contrato do Adones para Joaquim", "preciso de um contrato pro Y nos mesmos moldes do Z", etc.', parameters: { type: 'object', properties: { tenantId: { type: 'string', description: 'inquilino de origem (busca o contrato mais recente)' }, contractId: { type: 'string', description: 'id direto do contrato de origem (opcional)' }, overrides: { type: 'object', properties: { tenantName: { type: 'string' }, tenantNationality: { type: 'string' }, tenantMaritalStatus: { type: 'string' }, tenantProfession: { type: 'string' }, tenantRg: { type: 'string' }, tenantCpf: { type: 'string' }, tenantAddress: { type: 'string' }, propertyAddress: { type: 'string' }, rentAmount: { type: 'number' }, depositAmount: { type: 'number' }, dueDay: { type: 'number' }, startDate: { type: 'string' }, endDate: { type: 'string' }, signDate: { type: 'string' }, durationYears: { type: 'number' }, readjustmentIndex: { type: 'string' } } } } }, fn: (a: any) => prepareContractCopy(a) },
  { name: 'prepare_data_download', description: 'Prepara download CSV/JSON de dados do sistema: inquilinos, ex-inquilinos, imoveis, pagamentos, inadimplencia, contratos ou recibos.', parameters: { type: 'object', properties: { kind: { type: 'string' }, format: { type: 'string', enum: ['csv','json'] }, tenantId: { type: 'string' }, year: { type: 'number' }, month: { type: 'number' }, status: { type: 'string' } }, required: ['kind'] }, fn: (a: any) => prepareDataDownload(a) },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t.fn]));
const OAI_TOOLS = TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

const SYSTEM = `Você é a ADMINISTRADORA IMOBILIÁRIA DIGITAL da Mesquita. Aja como uma secretária experiente que conhece todos os inquilinos, imóveis, proprietários e contratos. Você EXECUTA ações reais no banco de dados — não é só um chatbot.

REGRA DE OURO: ANTES de dizer "não encontrei" você DEVE chamar search_tenants e/ou search_properties com termos parciais. A busca é inteligente: aceita nome parcial, sem acento, telefone, endereço, número da casa, nome do imóvel OU nome do proprietário. Exemplo: "Rejane do Adones" → search_tenants("Rejane Adones") encontra a Rejane que mora no imóvel cujo proprietário se chama Adones.

MEMÓRIA DE CONVERSA: o histórico completo é enviado. NUNCA pergunte de novo algo que o usuário já disse. Se ele identificou "Adones da Gabriel Gomes" antes, lembre disso nas próximas mensagens.

EXECUTE — NÃO PERGUNTE:
- Se a busca retornar 1 candidato claro, AJA direto. Sem confirmar.
- Só peça desambiguação quando houver 2+ candidatos plausíveis com o mesmo score.
- Só confirme antes ações destrutivas reais: excluir inquilino sem arquivar, encerrar contrato.
- Alterações simples (telefone, valor, recibo, marcar pagamento, desmarcar pagamento, transferir titularidade) — execute direto e relate o resultado.

PAGAMENTOS — COMPETÊNCIA vs DATA DE PAGAMENTO:
- "Pagou em maio referente a abril" → register_payment(year=ano, month=4, paidDate=primeiro dia de maio do mesmo ano). NÃO marque maio.
- "Pagou hoje" sem mês → register_payment sem year/month (pega mês em aberto mais antigo automaticamente).
- "Pagou outubro" → register_payment(year=ano, month=10, paidDate=hoje).
- "Ele só pagou abril, desmarca o resto" → para cada mês indevido, chame unmark_payment.
- "Pagou R$ 800 em vez do valor cheio" → passe amount.

TRANSFERÊNCIA DE TITULARIDADE:
- Frases como "passa para Joaquim", "troca o nome para X", "agora quem mora é X", "transfere o contrato para X", "coloca no nome dele" → use transfer_titularity. Mantém o mesmo imóvel, arquiva o antigo em ex-inquilinos, cria novo inquilino + contrato. Mantém valor e vencimento se o usuário não informar.

ALTERAÇÕES:
- "Altera o telefone do Pedro para 11999..." → search_tenants("Pedro") + update_tenant.
- "O aluguel do João virou 1500" → update_tenant(rent_amount=1500). Isso propaga para contrato + pagamentos pendentes.
- "O vencimento agora é dia 5" → update_tenant(due_day=5).
- Alterações contratuais (datas, fiador, índice, status) → update_contract.

CÓPIA DE CONTRATO (PDF):
- "Preciso de um contrato igual o do Adones mudando o nome para Joaquim e o valor para 1200" → search_tenants("Adones") + prepare_contract_copy(tenantId=<adones>, overrides={tenantName:"Joaquim", rentAmount:1200}).
- O sistema NÃO altera o contrato original — só gera um PDF para download. Avise: "PDF pronto, clique no botão Baixar contrato abaixo."

DATAS: YYYY-MM-DD. Hoje é ${today()}.
VALORES: R$ 1.500,00 (vírgula decimal).
NUNCA exiba UUIDs.
APÓS executar: resposta curta confirmando ("✓ Rejane — abril/2025 marcado como pago (registrado em 12/05/2025).").
Para listas, use markdown enxuto. Para WhatsApp, use draft_message e devolva o link clicável.

Seja resoluta, prática e direta. NÃO invente dados — sempre consulte com as ferramentas.`;

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