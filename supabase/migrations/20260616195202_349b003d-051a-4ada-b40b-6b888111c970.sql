
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  name TEXT NOT NULL,
  address TEXT,
  type TEXT NOT NULL DEFAULT 'house' CHECK (type IN ('house','apartment','commercial','other')),
  category TEXT DEFAULT 'residencial',
  owner_name TEXT,
  owner_phone TEXT,
  iptu NUMERIC DEFAULT 0,
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  rg TEXT,
  birth_date DATE,
  profession TEXT,
  emergency_contact TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  house_number TEXT,
  rent_amount NUMERIC(10,2) NOT NULL,
  deposit NUMERIC(10,2) DEFAULT 0,
  due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  payment_cycle TEXT NOT NULL DEFAULT 'postecipado' CHECK (payment_cycle IN ('antecipado','postecipado')),
  late_fee_percent NUMERIC(5,2) DEFAULT 0,
  interest_percent NUMERIC(5,2) DEFAULT 0,
  start_date DATE NOT NULL,
  exit_date DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tenants_property ON public.tenants(property_id);

CREATE TABLE public.former_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  house_number TEXT,
  rent_amount NUMERIC(10,2),
  deposit NUMERIC(10,2) DEFAULT 0,
  due_day INT,
  start_date DATE,
  exit_date DATE,
  final_balance NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  rent_amount NUMERIC(10,2) NOT NULL,
  due_day INT NOT NULL,
  terms TEXT,
  duration_months INTEGER DEFAULT 12,
  readjustment_index TEXT DEFAULT 'IGPM',
  guarantor_name TEXT,
  guarantor_cpf TEXT,
  guarantor_phone TEXT,
  auto_renew BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_tenant ON public.contracts(tenant_id);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2),
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','partial')),
  late_fee NUMERIC(10,2) DEFAULT 0,
  interest NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_due ON public.payments(due_date);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_tenant ON public.payments(tenant_id);

CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  receipt_number TEXT,
  amount NUMERIC(10,2) NOT NULL,
  issued_date DATE NOT NULL DEFAULT current_date,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expiring','expired','overdue','info')),
  title TEXT NOT NULL,
  message TEXT,
  due_date DATE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  interest TEXT,
  budget NUMERIC,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  notes TEXT,
  next_followup DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID,
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.receipts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_month TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties, public.tenants, public.former_tenants, public.contracts, public.payments, public.receipts, public.alerts, public.leads, public.lead_activities, public.tasks, public.expenses, public.receipts_history TO authenticated;
GRANT ALL ON public.properties, public.tenants, public.former_tenants, public.contracts, public.payments, public.receipts, public.alerts, public.leads, public.lead_activities, public.tasks, public.expenses, public.receipts_history TO service_role;

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.former_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_all ON public.properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY t_all ON public.tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY ft_all ON public.former_tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY c_all ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pay_all ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY r_all ON public.receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY a_all ON public.alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leads_all ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY la_all ON public.lead_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tasks_all ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exp_all ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rh_all ON public.receipts_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_former_tenants_updated BEFORE UPDATE ON public.former_tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_receipts_updated BEFORE UPDATE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
