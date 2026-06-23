DO $$
DECLARE
  v_owner_id uuid := '919c348c-9b22-4ba8-b21f-12af1487fd16';
  v_property_id uuid := '3ca413c6-b4b0-42e9-bd88-51e946385550';
  v_tenant_id uuid := gen_random_uuid();
BEGIN
  DELETE FROM public.alerts
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.bot_actions
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.payments
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.receipts
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.receipts_history
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.tasks
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.contracts
  WHERE tenant_id IN (
    SELECT id FROM public.tenants
    WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
       OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil')
  );

  DELETE FROM public.tenants
  WHERE regexp_replace(coalesce(cpf, ''), '\\D', '', 'g') = '46899503591'
     OR lower(name) IN ('dice brasil', 'deeci brasil', 'deci brasil');

  INSERT INTO public.tenants (
    id, owner_id, property_id, name, phone, email, cpf, house_number,
    rent_amount, deposit, due_day, payment_cycle, late_fee_percent,
    interest_percent, start_date, notes, status, pix_payer
  ) VALUES (
    v_tenant_id, v_owner_id, v_property_id, 'Dice Brasil', '', null, '468.995.035-91', '836 Altos',
    600.00, 600.00, 10, 'antecipado', 10.00,
    1.00, '2026-06-23', 'Contrato gerado em 23/06/2026 · Empresário', 'active', null
  );

  INSERT INTO public.contracts (
    owner_id, tenant_id, property_id, start_date, end_date, rent_amount,
    due_day, terms, duration_months, readjustment_index, auto_renew, status
  ) VALUES (
    v_owner_id, v_tenant_id, v_property_id, '2026-06-23', '2029-06-23', 600.00,
    10, null, 36, 'IGPM', true, 'active'
  );
END $$;