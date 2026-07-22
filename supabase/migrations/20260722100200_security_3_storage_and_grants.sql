-- =====================================================================
-- SECURITY HARDENING — Parte 3: storage + grants de funções
-- ---------------------------------------------------------------------
-- Seguro no Estágio A (não depende dos refactors de frontend):
--   * Storage: remove escrita/listagem anônima dos buckets; escrita passa a
--     exigir usuário autenticado (staff). Leitura pública das imagens
--     continua via CDN (/object/public/...), que não usa política SELECT.
--   * Funções SECURITY DEFINER: revoga EXECUTE de anon (e de authenticated
--     onde aplicável) das funções internas/administrativas, silenciando os
--     alertas 0028/0029 sem quebrar login público nem os gatilhos (triggers
--     disparam independente de GRANT) nem as edge functions (service_role).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Garante que os buckets de imagem sejam PÚBLICOS (renderização via CDN).
--    Ao remover a política de SELECT anônima abaixo, a leitura das imagens
--    continua funcionando SOMENTE se o bucket for público. Idempotente.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('table-images', 'table-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ---------------------------------------------------------------------
-- 1) STORAGE — remove políticas amplas dos buckets sensíveis/públicos.
--    Drop por bucket (via texto da expressão), independente do nome.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  b text;
  buckets text[] := ARRAY[
    'product-images','table-images','products','reservation-tables','fiscal-certificates'
  ];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND (COALESCE(qual, '') LIKE '%' || b || '%'
             OR COALESCE(with_check, '') LIKE '%' || b || '%')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
  END LOOP;
END $$;

-- Escrita nos buckets de imagem: apenas usuário autenticado (staff logado).
-- Leitura das imagens continua funcionando pelo CDN público.
CREATE POLICY "auth_write_product_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth_update_product_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "auth_delete_product_images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "auth_write_table_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'table-images');
CREATE POLICY "auth_update_table_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'table-images') WITH CHECK (bucket_id = 'table-images');
CREATE POLICY "auth_delete_table_images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'table-images');

-- Buckets 'products' (sem uploader no código), 'reservation-tables' (órfão) e
-- 'fiscal-certificates' (chaves A1 — só via edge function service_role) ficam
-- sem política de cliente: nenhum acesso anônimo/autenticado direto.

-- ---------------------------------------------------------------------
-- 2) FUNÇÕES — revoga EXECUTE (assinatura-agnóstico via regprocedure).
-- ---------------------------------------------------------------------

-- 2a) Internas / gatilhos / cron / pagamento-point → só service_role.
DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    -- pagamento point (edge/webhook service_role)
    'insert_point_order_payment','update_point_order_payment','get_point_order_payment',
    -- polling ifood (edge/cron service_role)
    'try_acquire_polling_lock','release_polling_lock','trigger_ifood_polling_all','cron_ifood_polling_30s',
    -- helpers internos (chamados por triggers/outras definer)
    'deduct_stock_for_order_item','is_restaurant_closed_by_order_item','check_product_availability',
    'auto_release_idle_tables','auto_release_inactive_tables','cleanup_abandoned_tables',
    -- funções de trigger (disparam independente de GRANT)
    'handle_new_user','process_order_stock_movement','revert_order_stock_movement',
    'revert_stock_on_cancel','revert_counter_order_deletion','process_counter_order_finalization',
    'add_delivery_order_to_cash_register','add_local_order_to_cash_register',
    'add_totem_order_to_cash_on_insert','assign_daily_order_number','ensure_order_phone_from_customer',
    'mark_table_occupied','check_table_release','check_table_release_on_delete',
    'update_cash_movement_payment','update_updated_at_column','enforce_admin_order_permissions',
    'update_coupons_updated_at','update_online_payment_config_updated_at','update_online_payments_updated_at'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 2b) Administrativas/PDV → revoga anon, mantém authenticated (staff logado).
DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'admin_update_order_status','admin_cancel_order_item','admin_delete_order',
    'admin_delete_category','admin_delete_product','admin_delete_stock_item',
    'admin_list_staff','admin_upsert_staff','admin_create_staff','admin_delete_staff',
    'admin_toggle_staff_active','admin_get_whatsapp_status','admin_get_point_terminals',
    'admin_upsert_point_terminal','admin_delete_point_terminal','check_mp_token_expiry',
    'restore_stock_for_order_item','admin_delete_bill','admin_delete_bill_and_orders',
    'admin_delete_order_and_bill','admin_delete_product_extra','admin_mark_bill_on_the_way',
    'admin_mark_bill_paid','admin_update_restaurant_settings','admin_delete_payment_config',
    'admin_get_payment_config','admin_upsert_payment_config','admin_ensure_payment_config',
    'admin_get_ifood_config','admin_toggle_ifood','admin_toggle_dd','admin_get_dd_config'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

-- 2c) Mantidas anon-executáveis (login/entrada pública, pré-sessão):
--     validate_restaurant_credentials, validate_staff_credentials,
--     validate_ceo_credentials, create_kiosk_order, get_kiosk_point_terminal,
--     get_restaurant_rating_stats, admin_check_has_staff, admin_create_first_staff,
--     get_public_payment_config, default_restaurant_id.
--     (Não são revogadas aqui; permanecem como estão.)
