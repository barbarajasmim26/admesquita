// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

// All functions now use the standard supabase client.
// In a pure SPA, we cannot use service role keys (admin) securely.
// The user requested "sem pg de autenticação", which usually means 
// RLS is disabled or the client is pre-authenticated.

async function admin() {
  return supabase;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Recompute status for pending/overdue rows
async function syncOverdue() {
  const s = await admin();
  await s.from("payments").update({ status: "overdue" }).eq("status", "pending").lt("due_date", today());
}

// ---------- DASHBOARD ----------
export const getDashboard = async () => {
  await syncOverdue();
  const s = await admin();
  const [propsRes, tenantsRes, paymentsRes, formerRes, contractsRes] = await Promise.all([
    s.from("properties").select("id, category"),
    s.from("tenants").select("id,status"),
    s.from("payments").select("id,amount,paid_amount,status,due_date,paid_date,tenant_id,tenants(status)").limit(5000),
    s.from("former_tenants").select("id"),
    s.from("contracts").select("id, end_date, status, tenants(name)").eq("status", "active"),
  ]);
  // Ignore payments belonging to inactive/former tenants for live KPIs
  const payments = (paymentsRes.data ?? []).filter((p: any) => !p.tenants || p.tenants.status === "active");
  const now = new Date();
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = ym(now);
  const receitaMes = payments
    .filter(p => p.paid_date && ym(new Date(p.paid_date + "T12:00:00")) === thisMonth)
    .reduce((a, p) => a + Number(p.paid_amount ?? p.amount ?? 0), 0);
  const previstoMes = payments
    .filter(p => ym(new Date(p.due_date + "T12:00:00")) === thisMonth)
    .reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const inadimplencia = payments
    .filter(p => p.status !== "paid" && p.due_date < today())
    .reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const proximosVencimentos = payments
    .filter(p => p.status !== "paid" && p.due_date >= today())
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 6);

  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const contractsEndingSoon = (contractsRes.data ?? []).filter((c: any) => c.end_date && c.end_date <= in30 && c.end_date >= today());
  const condominios = (propsRes.data ?? []).filter((p: any) => p.category === "condominio").length;
  const overdueTenantIds = new Set(payments.filter((p: any) => p.status !== "paid" && p.due_date < today()).map((p: any) => p.tenant_id));

  const revenueByMonth: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = ym(d);
    const total = payments
      .filter(p => p.paid_date && ym(new Date(p.paid_date + "T12:00:00")) === k)
      .reduce((a, p) => a + Number(p.paid_amount ?? p.amount ?? 0), 0);
    revenueByMonth.push({ month: d.toLocaleDateString("pt-BR", { month: "short" }), total });
  }

  const inactiveCountRes = await s.from("tenants").select("id", { count: "exact", head: true }).eq("status", "inactive");
  const formerTotal = (formerRes.data?.length ?? 0) + (inactiveCountRes.count ?? 0);
  return {
    properties: propsRes.data?.length ?? 0,
    condominios,
    activeTenants: tenantsRes.data?.filter(t => t.status === "active").length ?? 0,
    overdueTenants: overdueTenantIds.size,
    formerTenants: formerTotal,
    receitaMes,
    previstoMes,
    inadimplencia,
    overdueCount: payments.filter(p => p.status !== "paid" && p.due_date < today()).length,
    pendingCount: payments.filter(p => p.status !== "paid").length,
    proximosVencimentos,
    revenueByMonth,
    contractsEndingSoon: contractsEndingSoon.length,
    contractsEndingList: contractsEndingSoon.slice(0, 5),
  };
};

// ---------- EXPORT ALL (backup JSON) ----------
export const exportAll = async () => {
  const s = await admin();
  const [properties, tenants, formerTenants, contracts, payments, receipts, leads, tasks, expenses, alerts] = await Promise.all([
    s.from("properties").select("*"),
    s.from("tenants").select("*"),
    s.from("former_tenants").select("*"),
    s.from("contracts").select("*"),
    s.from("payments").select("*"),
    s.from("receipts_history").select("*"),
    s.from("leads").select("*"),
    s.from("tasks").select("*"),
    s.from("expenses").select("*"),
    s.from("alerts").select("*"),
  ]);
  return {
    exported_at: new Date().toISOString(),
    properties: properties.data ?? [],
    tenants: tenants.data ?? [],
    former_tenants: formerTenants.data ?? [],
    contracts: contracts.data ?? [],
    payments: payments.data ?? [],
    receipts_history: receipts.data ?? [],
    leads: leads.data ?? [],
    tasks: tasks.data ?? [],
    expenses: expenses.data ?? [],
    alerts: alerts.data ?? [],
  };
};

// ---------- CUSTOM RECEIPT ISSUE ----------
export const issueCustomReceipt = async (data: { tenantId: string; amount: number; referenceMonth: string; notes?: string }) => {
    const s = await admin();
    const year = new Date().getFullYear();
    const { count } = await s.from("receipts_history").select("*", { count: "exact", head: true })
      .gte("issued_at", `${year}-01-01`).lt("issued_at", `${year + 1}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(4, "0");
    const number = `${year}/${seq}`;
    await s.from("receipts_history").insert({
      tenant_id: data.tenantId, amount: data.amount,
      reference_month: data.referenceMonth, notes: data.notes ?? null, receipt_number: number,
    });
    return { ok: true, number };
  };


// ---------- PAYMENTS / FINANCEIRO ----------
export const listPayments = async (data: { month?: string; status?: string; tenantId?: string } = {}) => {
    await syncOverdue();
    const s = await admin();
    let q = s.from("payments").select(
      "id, amount, paid_amount, due_date, paid_date, status, late_fee, interest, notes, tenant_id, contract_id, " +
      "tenants(id, name, phone, late_fee_percent, interest_percent, house_number, cpf, pix_payer, properties(id, name, address))"
    ).order("due_date", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
    if (data.month) {
      const [y, m] = data.month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const endDate = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate).padStart(2, "0")}`;
      q = q.gte("due_date", start).lte("due_date", end);
    }
    const { data: rows, error } = await q.limit(2000);
    if (error) throw error;
    return rows ?? [];
  };

export const registerPayment = async (data: { paymentId: string; paidAmount: number; paidDate: string; lateFee?: number; interest?: number; notes?: string }) => {
    const s = await admin();
    const { error } = await s.from("payments").update({
      paid_amount: data.paidAmount,
      paid_date: data.paidDate,
      status: "paid",
      late_fee: data.lateFee ?? 0,
      interest: data.interest ?? 0,
      notes: data.notes ?? null,
    }).eq("id", data.paymentId);
    if (error) throw error;
    return { ok: true };
  };

export const unmarkPayment = async (data: { paymentId: string }) => {
    const s = await admin();
    const { error } = await s.from("payments").update({
      paid_amount: null, paid_date: null, status: "pending", late_fee: 0, interest: 0,
    }).eq("id", data.paymentId);
    if (error) throw error;
    return { ok: true };
  };

// Manually set / create / clear the payment for a tenant in a specific month.
// status: 'paid' | 'pending' | 'overdue' | 'none' (none = delete the row)
export const setMonthStatus = async (data: { tenantId: string; year: number; month: number; status: "paid" | "pending" | "overdue" | "none" }) => {
    const s = await admin();
    const { data: t } = await s.from("tenants").select("id, rent_amount, due_day").eq("id", data.tenantId).single();
    if (!t) throw new Error("Inquilino não encontrado");
    const mm = String(data.month).padStart(2, "0");
    const start = `${data.year}-${mm}-01`;
    const lastDay = new Date(data.year, data.month, 0).getDate();
    const end = `${data.year}-${mm}-${String(lastDay).padStart(2, "0")}`;
    const { data: existing } = await s.from("payments")
      .select("id").eq("tenant_id", data.tenantId).gte("due_date", start).lte("due_date", end).limit(1).maybeSingle();

    if (data.status === "none") {
      if (existing) await s.from("payments").delete().eq("id", existing.id);
      return { ok: true };
    }

    let paymentId = existing?.id;
    if (!paymentId) {
      const { data: ct } = await s.from("contracts").select("id").eq("tenant_id", data.tenantId).eq("status", "active").limit(1).maybeSingle();
      if (!ct) throw new Error("Contrato ativo não encontrado");
      const dueDay = Math.min(Number(t.due_day ?? 10), lastDay);
      const dueDate = `${data.year}-${mm}-${String(dueDay).padStart(2, "0")}`;
      const { data: row, error } = await s.from("payments").insert({
        tenant_id: data.tenantId, contract_id: ct.id,
        amount: Number(t.rent_amount ?? 0), due_date: dueDate, status: "pending",
      }).select("id").single();
      if (error) throw error;
      paymentId = row.id;
    }

    if (data.status === "paid") {
      const today = new Date().toISOString().slice(0, 10);
      await s.from("payments").update({ status: "paid", paid_date: today, paid_amount: Number(t.rent_amount ?? 0) }).eq("id", paymentId);
    } else {
      await s.from("payments").update({ status: data.status, paid_date: null, paid_amount: null, late_fee: 0, interest: 0 }).eq("id", paymentId);
    }
    return { ok: true };
  };

export const createCharge = async (data: { tenantId: string; amount: number; dueDate: string; notes?: string }) => {
    const s = await admin();
    const { data: ct } = await s.from("contracts").select("id").eq("tenant_id", data.tenantId).eq("status", "active").limit(1).single();
    if (!ct) throw new Error("Contrato ativo não encontrado para este inquilino");
    const { error } = await s.from("payments").insert({
      tenant_id: data.tenantId, contract_id: ct.id,
      amount: data.amount, due_date: data.dueDate, status: "pending", notes: data.notes ?? null,
    });
    if (error) throw error;
    return { ok: true };
  };

export const getPaymentForReceipt = async (data: { paymentId: string }) => {
    const s = await admin();
    const { data: p, error } = await s.from("payments").select(
      "id, amount, paid_amount, due_date, paid_date, status, contract_id, tenant_id, " +
      "tenants(id, name, cpf, phone, house_number, late_fee_percent, interest_percent, pix_payer, properties(id, name, address))"
    ).eq("id", data.paymentId).single();
    if (error) throw error;
    return p;
  };

// ---------- INADIMPLENCIA ----------
export const listOverdueByTenant = async () => {
  await syncOverdue();
  const s = await admin();
  const { data, error } = await s.from("payments").select(
    "id, amount, due_date, status, tenant_id, tenants(id, name, phone, properties(name, address))"
  ).neq("status", "paid").lt("due_date", today()).limit(3000);
  if (error) throw error;
  const map = new Map<string, { tenant: any; total: number; count: number; oldest: string }>();
  (data ?? []).forEach((p: any) => {
    const key = p.tenant_id;
    const cur = map.get(key) ?? { tenant: p.tenants, total: 0, count: 0, oldest: p.due_date };
    cur.total += Number(p.amount ?? 0);
    cur.count += 1;
    if (p.due_date < cur.oldest) cur.oldest = p.due_date;
    map.set(key, cur);
  });
  return Array.from(map.values()).sort((a, b) => a.oldest.localeCompare(b.oldest));
};

// ---------- TENANTS ----------
export const listTenants = async () => {
  const s = await admin();
  const { data, error } = await s.from("tenants").select(
    "id, name, phone, email, cpf, status, rent_amount, due_day, start_date, house_number, properties(id, name, address)"
  ).eq("status", "active").order("name").limit(1000);
  if (error) throw error;
  return data ?? [];
};

export const getTenant = async (data: { id: string }) => {
    await syncOverdue();
    const s = await admin();
    const [{ data: tenant }, { data: contracts }, { data: payments }] = await Promise.all([
      s.from("tenants").select("*, properties(id, name, address)").eq("id", data.id).single(),
      s.from("contracts").select("*").eq("tenant_id", data.id),
      s.from("payments").select("*").eq("tenant_id", data.id).order("due_date", { ascending: false }),
    ]);
    return { tenant, contracts: contracts ?? [], payments: payments ?? [] };
  };

export const upsertTenant = async (data: {
    id?: string; name: string; propertyId: string; phone?: string; email?: string; cpf?: string;
    houseNumber?: string; rentAmount: number; dueDay: number; deposit?: number; startDate: string;
    lateFeePercent?: number; interestPercent?: number; notes?: string; pixPayer?: string;
  }) => {
    const s = await admin();
    const payload = {
      name: data.name,
      property_id: data.propertyId,
      phone: data.phone || null,
      email: data.email || null,
      cpf: data.cpf || null,
      house_number: data.houseNumber || null,
      rent_amount: data.rent_amount,
      due_day: data.due_day,
      deposit: data.deposit ?? 0,
      start_date: data.startDate,
      late_fee_percent: data.lateFeePercent ?? 2,
      interest_percent: data.interest_percent ?? 1,
      notes: data.notes || null,
      pix_payer: data.pixPayer || null,
      status: "active",
    };
    if (data.id) {
      const { error } = await s.from("tenants").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await s.from("tenants").insert(payload).select("id").single();
    if (error) throw error;
    // Auto-create active contract
    await s.from("contracts").insert({
      tenant_id: row.id, property_id: data.propertyId,
      rent_amount: data.rent_amount, due_day: data.due_day, start_date: data.startDate, status: "active",
    });
    return { ok: true, id: row.id };
  };

export const deactivateTenant = async (data: { id: string; exitDate?: string; notes?: string }) => {
  const s = await admin();
  const { data: t } = await s.from("tenants").select("*").eq("id", data.id).single();
  if (!t) throw new Error("Inquilino não encontrado");
  
  // Move to former_tenants table
  await s.from("former_tenants").insert({
    name: t.name,
    property_id: t.property_id,
    house_number: t.house_number,
    phone: t.phone,
    email: t.email,
    cpf: t.cpf,
    start_date: t.start_date,
    exit_date: data.exitDate || today(),
    rent_amount: t.rent_amount,
    deposit: t.deposit,
    due_day: t.due_day,
    notes: data.notes || t.notes,
  });

  await s.from("tenants").update({ status: "inactive" }).eq("id", data.id);
  await s.from("contracts").update({ status: "ended" }).eq("tenant_id", data.id).eq("status", "active");
  return { ok: true };
};

export const reactivateTenant = async (data: { id: string }) => {
  const s = await admin();
  // We re-activate the tenant row
  await s.from("tenants").update({ status: "active" }).eq("id", data.id);
  
  // Re-activate or create a new contract
  const { data: t } = await s.from("tenants").select("*").eq("id", data.id).single();
  if (t) {
    await s.from("contracts").insert({
      tenant_id: t.id, property_id: t.property_id,
      rent_amount: t.rent_amount, due_day: t.due_day, start_date: today(), status: "active",
    });
  }
  
  // Delete from former_tenants if exists
  await s.from("former_tenants").delete().eq("name", t.name).eq("property_id", t.property_id);
  
  return { ok: true };
};

// ---------- PROPERTIES ----------
export const listProperties = async () => {
  const s = await admin();
  const { data, error } = await s
    .from("properties")
    .select("*, tenants(id, name, phone, rent_amount, due_day, start_date, house_number, status)")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    ...p,
    tenants: (p.tenants ?? []).filter((t: any) => t.status === "active"),
  }));
};

export const getProperty = async (data: { id: string }) => {
  const s = await admin();
  const { data: p } = await s
    .from("properties")
    .select("*, tenants(*)")
    .eq("id", data.id)
    .maybeSingle();
  
  const { data: former } = await s
    .from("former_tenants")
    .select("*")
    .eq("property_id", data.id)
    .order("exit_date", { ascending: false });
    
  const tenants = ((p as any)?.tenants ?? []).filter((t: any) => t.status === "active");
  const formerTenants = former ?? [];
  return { property: p, tenants, formerTenants };
};

export const upsertProperty = async (data: { id?: string; name: string; address?: string; category?: string }) => {
  const s = await admin();
  const payload = { name: data.name, address: data.address || null, category: data.category || "casa" };
  if (data.id) {
    await s.from("properties").update(payload).eq("id", data.id);
    return { ok: true, id: data.id };
  }
  const { data: row } = await s.from("properties").insert(payload).select("id").single();
  return { ok: true, id: row?.id };
};

// ---------- CONTRACTS ----------
export const listContracts = async () => {
  const s = await admin();
  const { data } = await s.from("contracts").select("*, tenants(id, name), properties(id, name)").order("start_date", { ascending: false });
  return data ?? [];
};

// ---------- EX-INQUILINOS / FORMER ----------
export const listFormerTenants = async () => {
  const s = await admin();
  // 1. Get explicit former tenants
  const { data: former } = await s.from("former_tenants").select("*, properties(id, name, address)").order("exit_date", { ascending: false });
  
  // 2. Get inactive tenants that are not in former_tenants yet
  const { data: inactive } = await s.from("tenants").select("*, properties(id, name, address)").eq("status", "inactive");
  
  const formerList = former ?? [];
  const inactiveList = (inactive ?? []).map(t => ({
    ...t,
    exit_date: t.updated_at || t.start_date, // fallback
    is_legacy_inactive: true
  }));

  // Merge and avoid duplicates by name+property
  const merged = [...formerList];
  inactiveList.forEach(t => {
    const exists = merged.some(f => f.name === t.name && f.property_id === t.property_id);
    if (!exists) merged.push(t);
  });

  return merged.sort((a, b) => (b.exit_date || "").localeCompare(a.exit_date || ""));
};

export const getFormerTenant = async (data: { id: string }) => {
  const s = await admin();
  // Try former_tenants first
  const { data: f } = await s.from("former_tenants").select("*, properties(id, name, address)").eq("id", data.id).maybeSingle();
  if (f) return { tenant: f };

  // Try inactive tenants
  const { data: t } = await s.from("tenants").select("*, properties(id, name, address)").eq("id", data.id).eq("status", "inactive").maybeSingle();
  if (t) return { tenant: { ...t, exit_date: t.updated_at } };

  throw new Error("Inquilino não encontrado");
};

export const endTenancy = async (data: { tenantId: string; endDate: string; notes?: string }) => {
  return deactivateTenant({ id: data.tenantId, exitDate: data.endDate, notes: data.notes });
};

// ---------- EXPENSES ----------
export const listExpenses = async (data: { month?: string; propertyId?: string } = {}) => {
  const s = await admin();
  let q = s.from("expenses").select("*, properties(id, name)").order("date", { ascending: false });
  if (data.propertyId) q = q.eq("property_id", data.propertyId);
  if (data.month) {
    const [y, m] = data.month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const last = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    q = q.gte("date", start).lte("date", end);
  }
  const { data: rows } = await q;
  return rows ?? [];
};

export const upsertExpense = async (data: { id?: string; description: string; amount: number; date: string; category?: string; propertyId?: string }) => {
  const s = await admin();
  const payload = { description: data.description, amount: data.amount, date: data.date, category: data.category || "outros", property_id: data.propertyId };
  if (data.id) {
    await s.from("expenses").update(payload).eq("id", data.id);
    return { ok: true, id: data.id };
  }
  const { data: row } = await s.from("expenses").insert(payload).select("id").single();
  return { ok: true, id: row?.id };
};

// ---------- RECEIPTS ----------
export const listReceipts = async (data: { tenantId?: string } = {}) => {
  const s = await admin();
  let q = s.from("receipts_history").select("*, tenants(id, name, cpf, phone, house_number, pix_payer, properties(id, name, address))").order("issued_at", { ascending: false });
  if (data.tenantId) q = q.eq("tenant_id", data.tenantId);
  const { data: rows } = await q;
  return rows ?? [];
};

export const registerReceipt = async (data: { tenantId: string; amount: number; referenceMonth: string; notes?: string; receiptNumber: string }) => {
  const s = await admin();
  await s.from("receipts_history").insert({
    tenant_id: data.tenantId, amount: data.amount, reference_month: data.referenceMonth, notes: data.notes, receipt_number: data.receiptNumber
  });
  return { ok: true };
};

export const getAnyPaymentForReceipt = async (data: { tenantId: string }) => {
  const s = await admin();
  const { data: p } = await s.from("payments").select("*, tenants(*)").eq("tenant_id", data.tenantId).order("due_date", { ascending: false }).limit(1).maybeSingle();
  return p;
};

// ---------- REPORTS ----------
export const getFinancialReport = async (data: { year: number }) => {
  const s = await admin();
  const start = `${data.year}-01-01`;
  const end = `${data.year}-12-31`;
  const [paymentsRes, expensesRes] = await Promise.all([
    s.from("payments").select("amount, paid_amount, paid_date, status").gte("paid_date", start).lte("paid_date", end).eq("status", "paid"),
    s.from("expenses").select("amount, date").gte("date", start).lte("date", end),
  ]);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const revenue = new Array(12).fill(0);
  const expenses = new Array(12).fill(0);
  (paymentsRes.data ?? []).forEach(p => {
    const m = new Date(p.paid_date!).getMonth();
    revenue[m] += Number(p.paid_amount ?? p.amount ?? 0);
  });
  (expensesRes.data ?? []).forEach(e => {
    const m = new Date(e.date).getMonth();
    expenses[m] += Number(e.amount ?? 0);
  });
  return months.map((name, i) => ({ name, revenue: revenue[i], expenses: expenses[i], profit: revenue[i] - expenses[i] }));
};

// ---------- ASSISTANT / BOT ----------
export const getAssistantSuggestions = async () => {
  const s = await admin();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const [paymentsRes, contractsRes, propertiesRes] = await Promise.all([
    s.from("payments").select("id, amount, due_date, status, tenant_id, tenants(name)").eq("status", "overdue"),
    s.from("contracts").select("id, end_date, tenants(name)").eq("status", "active").lte("end_date", in30).gte("end_date", todayStr),
    s.from("properties").select("id, name, tenants(id, status)"),
  ]);

  const suggestions: any[] = [];

  // 1. Inadimplência
  const overdue = paymentsRes.data ?? [];
  if (overdue.length > 0) {
    const total = overdue.reduce((a, p) => a + Number(p.amount), 0);
    suggestions.push({
      id: "overdue",
      title: "Cobranças atrasadas",
      description: `Existem ${overdue.length} cobranças em atraso totalizando ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}.`,
      action: "Ver inadimplência",
      link: "/inadimplencia",
      severity: "destructive"
    });
  }

  // 2. Contratos vencendo
  const contracts = contractsRes.data ?? [];
  if (contracts.length > 0) {
    suggestions.push({
      id: "contracts",
      title: "Contratos vencendo",
      description: `${contracts.length} contrato(s) vencem nos próximos 30 dias.`,
      action: "Ver contratos",
      link: "/contratos",
      severity: "warning"
    });
  }

  // 3. Imóveis vagos
  const vacant = (propertiesRes.data ?? []).filter((p: any) => !p.tenants || p.tenants.filter((t: any) => t.status === "active").length === 0);
  if (vacant.length > 0) {
    suggestions.push({
      id: "vacant",
      title: "Imóveis vagos",
      description: `Você tem ${vacant.length} imóvel(eis) sem inquilinos ativos no momento.`,
      action: "Ver imóveis",
      link: "/imoveis",
      severity: "info"
    });
  }

  return suggestions;
};

// ---------- BOT SUGGESTIONS ----------
export const listBotSuggestions = async (): Promise<any[]> => {
  // Stub: returns no pending suggestions. Real logic to be wired later.
  return [];
};

export const resolveBotSuggestion = async (_args?: any) => {
  // Stub: acknowledges a suggestion resolution. No-op until bot_actions wiring is restored.
  return { ok: true };
};

// ---------- DEMO SEED ----------
export const seedDemoLeads = async () => {
  // Stub: demo seeding disabled in production data.
  return { ok: true, inserted: 0 };
};

// ---------- REPORTS (aggregated) ----------
export const getReports = async () => {
  const s = await admin();
  const year = new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [paymentsRes, expensesRes, propsRes, tenantsRes] = await Promise.all([
    s.from("payments").select("amount, paid_amount, paid_date, status, due_date"),
    s.from("expenses").select("amount, date").gte("date", start).lte("date", end),
    s.from("properties").select("id, name"),
    s.from("tenants").select("id, property_id, status").eq("status", "active"),
  ]);
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const received = new Array(12).fill(0);
  const expByMonth = new Array(12).fill(0);
  let totalReceived = 0;
  let totalOverdue = 0;
  (paymentsRes.data ?? []).forEach((p: any) => {
    if (p.status === "paid" && p.paid_date) {
      const d = new Date(p.paid_date);
      if (d.getFullYear() === year) {
        const v = Number(p.paid_amount ?? p.amount ?? 0);
        received[d.getMonth()] += v;
        totalReceived += v;
      }
    }
    if (p.status === "overdue") totalOverdue += Number(p.amount ?? 0);
  });
  let totalExpenses = 0;
  (expensesRes.data ?? []).forEach((e: any) => {
    const m = new Date(e.date).getMonth();
    const v = Number(e.amount ?? 0);
    expByMonth[m] += v;
    totalExpenses += v;
  });
  const cashflow = months.map((name, i) => ({
    month: name,
    received: received[i],
    expenses: expByMonth[i],
    profit: received[i] - expByMonth[i],
  }));
  const tenantsByProp = new Map<string, number>();
  (tenantsRes.data ?? []).forEach((t: any) => {
    if (!t.property_id) return;
    tenantsByProp.set(t.property_id, (tenantsByProp.get(t.property_id) ?? 0) + 1);
  });
  const occupancyByProperty = (propsRes.data ?? []).map((p: any) => ({
    property: p.name,
    tenants: tenantsByProp.get(p.id) ?? 0,
  }));
  return {
    totalReceived,
    totalOverdue,
    totalExpenses,
    profit: totalReceived - totalExpenses,
    cashflow,
    occupancyByProperty,
  };
};
