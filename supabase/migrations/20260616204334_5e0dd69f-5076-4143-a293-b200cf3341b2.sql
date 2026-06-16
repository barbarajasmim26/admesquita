CREATE TABLE public.bot_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  due_at date,
  payload jsonb DEFAULT '{}'::jsonb,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_actions TO anon, authenticated;
GRANT ALL ON public.bot_actions TO service_role;

ALTER TABLE public.bot_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_actions_all" ON public.bot_actions FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER set_bot_actions_updated_at BEFORE UPDATE ON public.bot_actions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX bot_actions_status_due ON public.bot_actions(status, due_at);
CREATE INDEX bot_actions_tenant ON public.bot_actions(tenant_id);