DELETE FROM public.payments p
WHERE p.status <> 'paid'
  AND EXISTS (
    SELECT 1 FROM public.payments q
    WHERE q.id <> p.id
      AND q.tenant_id = p.tenant_id
      AND q.status = 'paid'
      AND q.amount = p.amount
      AND date_trunc('month', q.due_date) = date_trunc('month', p.due_date)
  );