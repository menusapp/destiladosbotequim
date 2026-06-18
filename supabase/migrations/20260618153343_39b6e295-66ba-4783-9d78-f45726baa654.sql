
-- ============================================================
-- Security hardening — Phase 0
-- ============================================================
-- 1) Lock down `backups` and `fiscal-certificates` storage buckets:
--    drop ALL anon/public policies. Access will go through the
--    `restaurant-storage-ops` edge function (service_role).
-- 2) Revoke EXECUTE from anon on SECURITY DEFINER functions that
--    are internal triggers / never need client invocation.
-- ============================================================

-- ---- 1) Storage buckets ----
DROP POLICY IF EXISTS "Restaurant can manage own backups" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_select_scoped" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_insert_scoped" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_update_scoped" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_delete_scoped" ON storage.objects;

-- After dropping, no policy matches `backups` or `fiscal-certificates`
-- for anon/authenticated. RLS denies by default, so only service_role
-- (edge functions) can read/write — which is exactly what we want.

-- ---- 2) Revoke EXECUTE on internal SECURITY DEFINER funcs ----
-- These are trigger functions or maintenance helpers; no client
-- should call them directly. `service_role` keeps full access.
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at_column()',
    'public.update_online_payments_updated_at()',
    'public.update_coupons_updated_at()',
    'public.update_cash_movement_payment()',
    'public.enforce_admin_order_permissions()',
    'public.add_local_order_to_cash_register()',
    'public.process_counter_order_finalization()',
    'public.process_order_stock_movement()',
    'public.revert_order_stock_movement()',
    'public.revert_stock_on_cancel()',
    'public.deduct_stock_for_order_item(uuid)',
    'public.cleanup_abandoned_tables()',
    'public.auto_release_idle_tables()'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Function % not found, skipping', fn;
    END;
  END LOOP;
END
$$;
