WITH dupes AS (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY lower(name), coalesce(cpf,''), property_id, coalesce(house_number,'')
      ORDER BY created_at
    ) rn,
    (SELECT count(*) FROM public.payments p WHERE p.tenant_id = t.id AND p.status = 'paid') paid_cnt
    FROM public.tenants t WHERE status = 'active'
  ) x WHERE rn > 1 AND paid_cnt = 0
)
DELETE FROM public.payments WHERE tenant_id IN (SELECT id FROM dupes);

WITH dupes AS (
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY lower(name), coalesce(cpf,''), property_id, coalesce(house_number,'')
      ORDER BY created_at
    ) rn,
    (SELECT count(*) FROM public.payments p WHERE p.tenant_id = t.id AND p.status = 'paid') paid_cnt
    FROM public.tenants t WHERE status = 'active'
  ) x WHERE rn > 1 AND paid_cnt = 0
)
DELETE FROM public.contracts WHERE tenant_id IN (SELECT id FROM dupes);

DELETE FROM public.tenants t
WHERE t.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.tenant_id = t.id)
  AND EXISTS (
    SELECT 1 FROM public.tenants o
    WHERE o.id <> t.id
      AND lower(o.name) = lower(t.name)
      AND coalesce(o.cpf,'') = coalesce(t.cpf,'')
      AND o.property_id = t.property_id
      AND coalesce(o.house_number,'') = coalesce(t.house_number,'')
      AND o.created_at < t.created_at
  );