
-- Backfill any NULL owner_id with the first auth user (solo-landlord app)
DO $$
DECLARE
  default_owner uuid;
BEGIN
  SELECT id INTO default_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF default_owner IS NOT NULL THEN
    UPDATE public.alerts SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.contracts SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.expenses SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.former_tenants SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.leads SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.payments SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.properties SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.receipts SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.tasks SET owner_id = default_owner WHERE owner_id IS NULL;
    UPDATE public.tenants SET owner_id = default_owner WHERE owner_id IS NULL;
  END IF;
END $$;

-- Default owner_id to auth.uid() on insert
ALTER TABLE public.alerts ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.contracts ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.expenses ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.former_tenants ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.leads ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.payments ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.properties ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.receipts ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.tasks ALTER COLUMN owner_id SET DEFAULT auth.uid();
ALTER TABLE public.tenants ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- Replace permissive policies with owner-scoped ones
DROP POLICY IF EXISTS a_all ON public.alerts;
CREATE POLICY a_owner ON public.alerts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS t_all ON public.tenants;
CREATE POLICY t_owner ON public.tenants FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS p_all ON public.properties;
CREATE POLICY p_owner ON public.properties FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS ft_all ON public.former_tenants;
CREATE POLICY ft_owner ON public.former_tenants FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS c_all ON public.contracts;
CREATE POLICY c_owner ON public.contracts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS pay_all ON public.payments;
CREATE POLICY pay_owner ON public.payments FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS exp_all ON public.expenses;
CREATE POLICY exp_owner ON public.expenses FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS r_all ON public.receipts;
CREATE POLICY r_owner ON public.receipts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS leads_all ON public.leads;
CREATE POLICY leads_owner ON public.leads FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS tasks_all ON public.tasks;
CREATE POLICY tasks_owner ON public.tasks FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- lead_activities: scope via parent lead
DROP POLICY IF EXISTS la_all ON public.lead_activities;
CREATE POLICY la_owner ON public.lead_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_activities.lead_id AND l.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_activities.lead_id AND l.owner_id = auth.uid()));

-- receipts_history: scope via related payment
DROP POLICY IF EXISTS rh_all ON public.receipts_history;
CREATE POLICY rh_owner ON public.receipts_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = receipts_history.payment_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = receipts_history.payment_id AND p.owner_id = auth.uid()));

-- bot_actions: was open to anon (public role). Lock to authenticated + scope via tenant ownership.
DROP POLICY IF EXISTS bot_actions_all ON public.bot_actions;
REVOKE ALL ON public.bot_actions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_actions TO authenticated;
CREATE POLICY bot_actions_owner ON public.bot_actions FOR ALL TO authenticated
  USING (
    tenant_id IS NULL
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = bot_actions.tenant_id AND t.owner_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IS NULL
    OR EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = bot_actions.tenant_id AND t.owner_id = auth.uid())
  );
