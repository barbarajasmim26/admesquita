
-- Generate one active contract per active tenant (idempotent)
INSERT INTO public.contracts (tenant_id, property_id, start_date, rent_amount, due_day, status, owner_id)
SELECT t.id, t.property_id, t.start_date, t.rent_amount, t.due_day, 'active', t.owner_id
FROM public.tenants t
WHERE t.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.contracts c WHERE c.tenant_id = t.id);

-- Generate monthly payments for each active contract from start_date to current month
WITH months AS (
  SELECT c.id AS contract_id, c.tenant_id, c.owner_id, c.rent_amount, c.due_day,
         generate_series(
           date_trunc('month', c.start_date)::date,
           date_trunc('month', CURRENT_DATE)::date,
           interval '1 month'
         )::date AS month_start
  FROM public.contracts c
  WHERE c.status = 'active'
)
INSERT INTO public.payments (contract_id, tenant_id, owner_id, amount, due_date, status)
SELECT m.contract_id, m.tenant_id, m.owner_id, m.rent_amount,
       (m.month_start + (LEAST(m.due_day, EXTRACT(day FROM (m.month_start + interval '1 month' - interval '1 day'))::int) - 1) * interval '1 day')::date AS due_date,
       CASE
         WHEN (m.month_start + (LEAST(m.due_day, EXTRACT(day FROM (m.month_start + interval '1 month' - interval '1 day'))::int) - 1) * interval '1 day')::date < CURRENT_DATE THEN 'overdue'
         ELSE 'pending'
       END
FROM months m
WHERE NOT EXISTS (
  SELECT 1 FROM public.payments p
  WHERE p.contract_id = m.contract_id
    AND date_trunc('month', p.due_date) = date_trunc('month', m.month_start)
);
