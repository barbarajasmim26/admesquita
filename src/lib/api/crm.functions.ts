import { createServerFn } from "@tanstack/react-start";

// All server functions use supabaseAdmin (service role) — no auth required.
// This is an internal-only tool per user request ("sem pg de autenticação").

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await syncOverdue();
  const s = await admin();
  const [propsRes, tenantsRes, paymentsRes, formerRes, contractsRes] = await Promise.all([
    s.from("properties").select("id, category"),
    s.from("tenants").select("id,status"),
    s.from("payments").select("id,amount,paid_amount,status,due_date,paid_date,tenant_id").limit(5000),
    s.from("former_tenants").select("id"),
    s.from("contracts").select("id, end_date, status, tenants(name)").eq("status", "active"),
  ]);
  const payments = paymentsRes.data ?? [];
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
  const overdueTenantIds = new Set(payments.filter(p => p.status !== "paid" && p.due_date < today()).map((p: any) => p.tenant_id));

  const revenueByMonth: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = ym(d);
    const total = payments
      .filter(p => p.paid_date && ym(new Date(p.paid_date + "T12:00:00")) === k)
      .reduce((a, p) => a + Number(p.paid_amount ?? p.amount ?? 0), 0);
    revenueByMonth.push({ month: d.toLocaleDateString("pt-BR", { month: "short" }), total });
  }

  return {
    properties: propsRes.data?.length ?? 0,
    condominios,
    activeTenants: tenantsRes.data?.filter(t => t.status === "active").length ?? 0,
    overdueTenants: overdueTenantIds.size,
    formerTenants: formerRes.data?.length ?? 0,
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
});

// ---------- EXPORT ALL (backup JSON) ----------
export const exportAll = createServerFn({ method: "GET" }).handler(async () => {
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
});

// ---------- CUSTOM RECEIPT ISSUE ----------
export const issueCustomReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; amount: number; referenceMonth: string; notes?: string }) => d)
  .handler(async ({ data }) => {
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
  });


// ---------- PAYMENTS / FINANCEIRO ----------
export const listPayments = createServerFn({ method: "GET" })
  .inputValidator((d: { month?: string; status?: string; tenantId?: string } = {}) => d)
  .handler(async ({ data }) => {
    await syncOverdue();
    const s = await admin();
    let q = s.from("payments").select(
      "id, amount, paid_amount, due_date, paid_date, status, late_fee, interest, notes, tenant_id, contract_id, " +
      "tenants(id, name, phone, late_fee_percent, interest_percent, house_number, cpf, properties(id, name, address))"
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
  });

export const registerPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId: string; paidAmount: number; paidDate: string; lateFee?: number; interest?: number; notes?: string }) => d)
  .handler(async ({ data }) => {
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
  });

export const unmarkPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { error } = await s.from("payments").update({
      paid_amount: null, paid_date: null, status: "pending", late_fee: 0, interest: 0,
    }).eq("id", data.paymentId);
    if (error) throw error;
    return { ok: true };
  });

export const createCharge = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string; amount: number; dueDate: string; notes?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: ct } = await s.from("contracts").select("id").eq("tenant_id", data.tenantId).eq("status", "active").limit(1).single();
    if (!ct) throw new Error("Contrato ativo não encontrado para este inquilino");
    const { error } = await s.from("payments").insert({
      tenant_id: data.tenantId, contract_id: ct.id,
      amount: data.amount, due_date: data.dueDate, status: "pending", notes: data.notes ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const getPaymentForReceipt = createServerFn({ method: "GET" })
  .inputValidator((d: { paymentId: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: p, error } = await s.from("payments").select(
      "id, amount, paid_amount, due_date, paid_date, status, contract_id, tenant_id, " +
      "tenants(id, name, cpf, phone, house_number, late_fee_percent, interest_percent, properties(id, name, address))"
    ).eq("id", data.paymentId).single();
    if (error) throw error;
    return p;
  });

// ---------- INADIMPLENCIA ----------
export const listOverdueByTenant = createServerFn({ method: "GET" }).handler(async () => {
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
});

// ---------- TENANTS ----------
export const listTenants = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data, error } = await s.from("tenants").select(
    "id, name, phone, email, cpf, status, rent_amount, due_day, start_date, house_number, properties(id, name, address)"
  ).eq("status", "active").order("name").limit(1000);
  if (error) throw error;
  return data ?? [];
});

export const getTenant = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await syncOverdue();
    const s = await admin();
    const [{ data: tenant }, { data: contracts }, { data: payments }] = await Promise.all([
      s.from("tenants").select("*, properties(id, name, address)").eq("id", data.id).single(),
      s.from("contracts").select("*").eq("tenant_id", data.id),
      s.from("payments").select("*").eq("tenant_id", data.id).order("due_date", { ascending: false }),
    ]);
    return { tenant, contracts: contracts ?? [], payments: payments ?? [] };
  });

export const upsertTenant = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id?: string; name: string; propertyId: string; phone?: string; email?: string; cpf?: string;
    houseNumber?: string; rentAmount: number; dueDay: number; deposit?: number; startDate: string;
    lateFeePercent?: number; interestPercent?: number; notes?: string;
  }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const payload = {
      name: data.name,
      property_id: data.propertyId,
      phone: data.phone || null,
      email: data.email || null,
      cpf: data.cpf || null,
      house_number: data.houseNumber || null,
      rent_amount: data.rentAmount,
      due_day: data.dueDay,
      deposit: data.deposit ?? 0,
      start_date: data.startDate,
      late_fee_percent: data.lateFeePercent ?? 2,
      interest_percent: data.interestPercent ?? 1,
      notes: data.notes || null,
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
      rent_amount: data.rentAmount, due_day: data.dueDay, start_date: data.startDate, status: "active",
    });
    return { ok: true, id: row.id };
  });

export const deactivateTenant = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; exitDate: string; notes?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: t } = await s.from("tenants").select("*").eq("id", data.id).single();
    if (!t) throw new Error("Inquilino não encontrado");
    await s.from("former_tenants").insert({
      property_id: t.property_id, name: t.name, email: t.email, phone: t.phone, cpf: t.cpf,
      house_number: t.house_number, rent_amount: t.rent_amount, deposit: t.deposit, due_day: t.due_day,
      start_date: t.start_date, exit_date: data.exitDate, notes: data.notes ?? null,
    });
    await s.from("tenants").update({ status: "inactive", exit_date: data.exitDate }).eq("id", data.id);
    await s.from("contracts").update({ status: "ended", end_date: data.exitDate }).eq("tenant_id", data.id);
    return { ok: true };
  });

// ---------- PROPERTIES ----------
export const listProperties = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data: props } = await s.from("properties").select("*").order("name");
  const { data: tenants } = await s.from("tenants").select("id, name, property_id, status, house_number, rent_amount, phone").eq("status", "active");
  return (props ?? []).map(p => ({
    ...p,
    tenants: (tenants ?? []).filter(t => t.property_id === p.id),
  }));
});

export const getProperty = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const [{ data: prop }, { data: tenants }, { data: former }] = await Promise.all([
      s.from("properties").select("*").eq("id", data.id).single(),
      s.from("tenants").select("*").eq("property_id", data.id).eq("status", "active").order("house_number"),
      s.from("former_tenants").select("*").eq("property_id", data.id).order("exit_date", { ascending: false, nullsFirst: false }),
    ]);
    return { property: prop, tenants: tenants ?? [], formerTenants: former ?? [] };
  });

export const upsertProperty = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; name: string; address?: string; type?: string; category?: string; ownerName?: string; ownerPhone?: string; notes?: string; iptu?: number }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const payload: any = {
      name: data.name,
      address: data.address || null,
      type: data.type || "house",
      category: data.category || "residencial",
      owner_name: data.ownerName || null,
      owner_phone: data.ownerPhone || null,
      notes: data.notes || null,
      iptu: data.iptu ?? 0,
    };
    if (data.id) {
      const { error } = await s.from("properties").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await s.from("properties").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });


// ---------- CONTRACTS ----------
export const listContracts = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data, error } = await s.from("contracts").select(
    "*, tenants(id, name), properties(id, name, address)"
  ).order("start_date", { ascending: false }).limit(1000);
  if (error) throw error;
  return data ?? [];
});

// ---------- FORMER TENANTS ----------
export const listFormerTenants = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data, error } = await s.from("former_tenants").select(
    "*, properties(id, name, address)"
  ).order("exit_date", { ascending: false, nullsFirst: false }).limit(1000);
  if (error) throw error;
  return data ?? [];
});

export const getFormerTenant = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { data: tenant, error } = await s
      .from("former_tenants")
      .select("*, properties(id, name, address)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    return { tenant };
  });


// ---------- ALERTS ----------
export const listAlerts = createServerFn({ method: "GET" }).handler(async () => {
  await syncOverdue();
  const s = await admin();
  const [{ data: overdue }, { data: dueSoon }] = await Promise.all([
    s.from("payments").select("id, due_date, amount, tenants(id, name)").neq("status", "paid").lt("due_date", today()).limit(50),
    s.from("payments").select("id, due_date, amount, tenants(id, name)").neq("status", "paid").gte("due_date", today()).limit(50).order("due_date"),
  ]);
  const alerts: { id: string; payment_id: string; tenant_id: string | null; tenant_name: string; type: string; title: string; message: string; date: string; amount: number }[] = [];
  (overdue ?? []).slice(0, 30).forEach((p: any) => {
    alerts.push({
      id: `o-${p.id}`, payment_id: p.id, tenant_id: p.tenants?.id ?? null, tenant_name: p.tenants?.name ?? "",
      type: "overdue",
      title: `Pagamento atrasado — ${p.tenants?.name ?? ""}`,
      message: `Vencimento em ${p.due_date}, valor R$ ${Number(p.amount).toFixed(2)}`,
      date: p.due_date, amount: Number(p.amount ?? 0),
    });
  });
  (dueSoon ?? []).slice(0, 20).forEach((p: any) => {
    alerts.push({
      id: `d-${p.id}`, payment_id: p.id, tenant_id: p.tenants?.id ?? null, tenant_name: p.tenants?.name ?? "",
      type: "due_soon",
      title: `Próximo vencimento — ${p.tenants?.name ?? ""}`,
      message: `Vence em ${p.due_date}`,
      date: p.due_date, amount: Number(p.amount ?? 0),
    });
  });
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
});

// ---------- CALENDAR ----------
export const listMonthPayments = createServerFn({ method: "GET" })
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const start = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const endDay = new Date(data.year, data.month, 0).getDate();
    const end = `${data.year}-${String(data.month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    const { data: rows } = await s.from("payments")
      .select("id, due_date, amount, status, tenants(name, properties(name))")
      .gte("due_date", start).lte("due_date", end);
    return rows ?? [];
  });

// ---------- LEADS (CRM) ----------
export const listLeads = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data, error } = await s.from("leads").select("*, properties(id, name)").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
});

export const upsertLead = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; name: string; phone?: string; email?: string; source?: string; interest?: string; budget?: number; propertyId?: string; status?: string; notes?: string; nextFollowup?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const payload: any = {
      name: data.name, phone: data.phone || null, email: data.email || null,
      source: data.source || null, interest: data.interest || null,
      budget: data.budget ?? null, property_id: data.propertyId || null,
      status: data.status || "novo", notes: data.notes || null,
      next_followup: data.nextFollowup || null, updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await s.from("leads").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await s.from("leads").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { error } = await s.from("leads").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    await s.from("leads").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- TASKS ----------
export const listTasks = createServerFn({ method: "GET" })
  .inputValidator((d: { status?: string } = {}) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    let q = s.from("tasks").select("*, tenants(id, name), leads(id, name), properties(id, name)").order("due_date");
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q.limit(500);
    if (error) throw error;
    return rows ?? [];
  });

export const upsertTask = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; title: string; description?: string; dueDate: string; priority?: string; tenantId?: string; leadId?: string; propertyId?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const payload: any = {
      title: data.title, description: data.description || null,
      due_date: data.dueDate, priority: data.priority || "normal",
      tenant_id: data.tenantId || null, lead_id: data.leadId || null, property_id: data.propertyId || null,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await s.from("tasks").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await s.from("tasks").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const toggleTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const { error } = await s.from("tasks").update({
      status: data.status,
      completed_at: data.status === "done" ? new Date().toISOString() : null,
    }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    await s.from("tasks").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- EXPENSES ----------
export const listExpenses = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data } = await s.from("expenses").select("*, properties(id, name)").order("expense_date", { ascending: false }).limit(500);
  return data ?? [];
});

export const upsertExpense = createServerFn({ method: "POST" })
  .inputValidator((d: { id?: string; description: string; category?: string; amount: number; expenseDate: string; propertyId?: string; notes?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const payload: any = {
      description: data.description, category: data.category || null,
      amount: data.amount, expense_date: data.expenseDate,
      property_id: data.propertyId || null, notes: data.notes || null,
    };
    if (data.id) { await s.from("expenses").update(payload).eq("id", data.id); return { ok: true }; }
    await s.from("expenses").insert(payload);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    await s.from("expenses").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- RECEIPTS HISTORY ----------
export const listReceipts = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  const { data } = await s.from("receipts_history")
    .select("*, tenants(id, name, properties(id, name))")
    .order("issued_at", { ascending: false }).limit(500);
  return data ?? [];
});

export const registerReceipt = createServerFn({ method: "POST" })
  .inputValidator((d: { paymentId?: string; tenantId?: string; amount: number; referenceMonth?: string; notes?: string }) => d)
  .handler(async ({ data }) => {
    const s = await admin();
    const year = new Date().getFullYear();
    const { count } = await s.from("receipts_history").select("*", { count: "exact", head: true })
      .gte("issued_at", `${year}-01-01`).lt("issued_at", `${year + 1}-01-01`);
    const seq = String((count ?? 0) + 1).padStart(4, "0");
    const number = `${year}/${seq}`;
    await s.from("receipts_history").insert({
      payment_id: data.paymentId || null, tenant_id: data.tenantId || null,
      amount: data.amount, reference_month: data.referenceMonth || null,
      notes: data.notes || null, receipt_number: number,
    });
    return { ok: true, number };
  });

export const getAnyPaymentForReceipt = createServerFn({ method: "GET" }).handler(async () => {
  const s = await admin();
  let { data } = await s.from("payments")
    .select("id, amount, paid_amount, due_date, paid_date, status, tenant_id, tenants(id, name, cpf, house_number, properties(id, name, address))")
    .eq("status", "paid").order("paid_date", { ascending: false }).limit(1).maybeSingle();
  if (!data) {
    const r = await s.from("payments")
      .select("id, amount, paid_amount, due_date, paid_date, status, tenant_id, tenants(id, name, cpf, house_number, properties(id, name, address))")
      .order("due_date", { ascending: false }).limit(1).maybeSingle();
    data = r.data;
  }
  return data;
});

// ---------- REPORTS ----------
export const getReports = createServerFn({ method: "GET" }).handler(async () => {
  await syncOverdue();
  const s = await admin();
  const [paymentsRes, propsRes, tenantsRes, expensesRes] = await Promise.all([
    s.from("payments").select("amount, paid_amount, status, due_date, paid_date").limit(5000),
    s.from("properties").select("id, name"),
    s.from("tenants").select("id, status, property_id, rent_amount"),
    s.from("expenses").select("amount, expense_date, category"),
  ]);
  const payments = paymentsRes.data ?? [];
  const props = propsRes.data ?? [];
  const tenants = tenantsRes.data ?? [];
  const expenses = expensesRes.data ?? [];

  const totalReceived = payments.filter(p => p.status === "paid").reduce((a, p) => a + Number(p.paid_amount ?? p.amount ?? 0), 0);
  const totalOverdue = payments.filter(p => p.status !== "paid" && p.due_date < today()).reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount ?? 0), 0);

  const occupancyByProperty = props.map(p => ({
    property: p.name,
    tenants: tenants.filter(t => t.property_id === p.id && t.status === "active").length,
  }));

  const monthly: Record<string, { received: number; expenses: number }> = {};
  payments.forEach(p => {
    if (p.paid_date) {
      const k = p.paid_date.slice(0, 7);
      monthly[k] = monthly[k] || { received: 0, expenses: 0 };
      monthly[k].received += Number(p.paid_amount ?? p.amount ?? 0);
    }
  });
  expenses.forEach(e => {
    const k = e.expense_date.slice(0, 7);
    monthly[k] = monthly[k] || { received: 0, expenses: 0 };
    monthly[k].expenses += Number(e.amount ?? 0);
  });
  const cashflow = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v, profit: v.received - v.expenses }));

  return { totalReceived, totalOverdue, totalExpenses, profit: totalReceived - totalExpenses, occupancyByProperty, cashflow };
});

// ---------- SEED DEMO LEADS ----------
export const seedDemoLeads = createServerFn({ method: "POST" }).handler(async () => {
  const s = await admin();
  const { count } = await s.from("leads").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { ok: true, skipped: true };
  await s.from("leads").insert([
    { name: "Carlos Pereira", phone: "(85) 98888-1111", email: "carlos@email.com", source: "Instagram", interest: "Casa 2 quartos", budget: 1200, status: "novo" },
    { name: "Ana Souza", phone: "(85) 98888-2222", email: "ana@email.com", source: "Indicação", interest: "Apartamento", budget: 1500, status: "contato" },
    { name: "João Lima", phone: "(85) 98888-3333", source: "Site", interest: "Comercial", budget: 2500, status: "visita" },
    { name: "Maria Costa", phone: "(85) 98888-4444", email: "maria@email.com", source: "Facebook", interest: "Casa térrea", budget: 1100, status: "proposta" },
  ]);
  return { ok: true };
});

