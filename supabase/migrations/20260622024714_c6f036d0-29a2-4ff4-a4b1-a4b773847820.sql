
-- 1) bot_actions: owner_id + tighter policy
ALTER TABLE public.bot_actions
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS bot_actions_owner ON public.bot_actions;

CREATE POLICY bot_actions_owner ON public.bot_actions
  FOR ALL
  TO authenticated
  USING (
    (tenant_id IS NULL AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = bot_actions.tenant_id AND t.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    (tenant_id IS NULL AND owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = bot_actions.tenant_id AND t.owner_id = auth.uid()
    )
  );

-- 2) receipts_history: owner_id + backfill + policy using owner_id
ALTER TABLE public.receipts_history
  ADD COLUMN IF NOT EXISTS owner_id uuid DEFAULT auth.uid();

UPDATE public.receipts_history rh
SET owner_id = p.owner_id
FROM public.payments p
WHERE rh.payment_id = p.id
  AND rh.owner_id IS NULL
  AND p.owner_id IS NOT NULL;

DROP POLICY IF EXISTS rh_owner ON public.receipts_history;

CREATE POLICY rh_owner ON public.receipts_history
  FOR ALL
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (
      payment_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id = receipts_history.payment_id AND p.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (
      payment_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.id = receipts_history.payment_id AND p.owner_id = auth.uid()
      )
    )
  );
