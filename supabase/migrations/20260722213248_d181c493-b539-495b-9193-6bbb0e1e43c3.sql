-- =====================================================================
-- FASE 1 — SECURITY HARDENING (partes 1 + 2 + 3 + 4)
-- =====================================================================

-- ============================================================
-- PARTE 1 — helpers de identidade + ajustes de schema
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'restaurant_id'),
    ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'staff_id'),
    ''
  )::uuid
$$;

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'staff_role'
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.current_restaurant_id() IS NOT NULL
     AND public.current_staff_id() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'ceo')::boolean,
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.default_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.restaurants ORDER BY created_at LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_restaurant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ceo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_restaurant_id() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.customer_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_cpf text NOT NULL,
  customer_phone text NOT NULL,
  card_id text NOT NULL,
  mp_customer_id text NOT NULL,
  payment_method_id text NOT NULL,
  last_four_digits text NOT NULL,
  first_six_digits text,
  expiration_month integer,
  expiration_year integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.customer_cards ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;

UPDATE public.customer_addresses ca
   SET restaurant_id = c.restaurant_id
  FROM public.customers c
 WHERE c.cpf = ca.customer_cpf
   AND ca.restaurant_id IS NULL;

UPDATE public.customer_addresses
   SET restaurant_id = public.default_restaurant_id()
 WHERE restaurant_id IS NULL
   AND public.default_restaurant_id() IS NOT NULL;

ALTER TABLE public.customer_addresses
  ALTER COLUMN restaurant_id SET DEFAULT public.default_restaurant_id();

CREATE INDEX IF NOT EXISTS idx_customer_addresses_cpf ON public.customer_addresses (customer_cpf);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_restaurant ON public.customer_addresses (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_extras_item_id ON public.order_item_extras (order_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_cards_cpf ON public.customer_cards (customer_cpf);

-- ============================================================
-- PARTE 2 — políticas RLS (Estágio A)
-- ============================================================
DO $$
DECLARE
  t text;
  r record;
  target_tables text[] := ARRAY[
    'cash_movements','cash_register_sessions','printer_settings','order_fiscal_notes',
    'suppliers','employee_credits','nfe_imports','stock_items','stock_categories',
    'stock_movements','variable_costs','fixed_costs','labor_costs','fiscal_configs',
    'delivery_config','marketing_campaigns','marketing_campaign_rules',
    'whatsapp_conversations','whatsapp_config','whatsapp_ai_config',
    'whatsapp_notification_configs','whatsapp_menu_options','owner_notification_config',
    'counter_orders','counter_order_items','customer_loyalty_progress',
    'product_ingredients','product_extra_ingredients','extra_category_item_ingredients',
    'restaurant_subscriptions','subscription_payments','subscription_plans','plan_payment_links',
    'restaurant_staff','restaurant_credentials','ceo_users','user_roles','profiles',
    'restaurants','products','product_extras','product_complement_groups','categories',
    'extra_categories','extra_category_items','business_hours','reservation_hours',
    'reservation_tables','delivery_zones','payment_methods','loyalty_programs',
    'loyalty_program_rewards',
    'customers','customer_addresses','orders','order_items','order_item_extras',
    'loyalty_points','loyalty_transactions','loyalty_reward_redemptions','coupons',
    'comandas','bills','tables','online_payments','customer_cards','reservations',
    'marketing_scheduled_messages','kiosk_config','customer_sessions','restaurant_reviews'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR r IN SELECT policyname FROM pg_policies
               WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  t text;
  staff_only text[] := ARRAY[
    'cash_movements','cash_register_sessions','printer_settings','order_fiscal_notes',
    'suppliers','employee_credits','nfe_imports','stock_items','stock_categories',
    'variable_costs','fixed_costs','labor_costs','fiscal_configs','delivery_config',
    'marketing_campaigns','whatsapp_conversations','whatsapp_config','whatsapp_ai_config',
    'whatsapp_notification_configs','whatsapp_menu_options','owner_notification_config',
    'counter_orders','customer_loyalty_progress'
  ];
BEGIN
  FOREACH t IN ARRAY staff_only LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        || 'USING (restaurant_id = public.current_restaurant_id()) '
        || 'WITH CHECK (restaurant_id = public.current_restaurant_id())',
        'staff_all', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "staff_all" ON public.counter_order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.counter_orders co
                 WHERE co.id = counter_order_id AND co.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.counter_orders co
                 WHERE co.id = counter_order_id AND co.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.stock_movements
  FOR ALL TO authenticated
  USING (stock_item_id IN (SELECT id FROM public.stock_items WHERE restaurant_id = public.current_restaurant_id()))
  WITH CHECK (stock_item_id IN (SELECT id FROM public.stock_items WHERE restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.marketing_campaign_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketing_campaigns c
                 WHERE c.id = campaign_id AND c.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketing_campaigns c
                 WHERE c.id = campaign_id AND c.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.product_ingredients
  FOR ALL TO authenticated
  USING (product_id IN (SELECT p.id FROM public.products p
                        JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (product_id IN (SELECT p.id FROM public.products p
                        JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.product_extra_ingredients
  FOR ALL TO authenticated
  USING (product_extra_id IN (SELECT pe.id FROM public.product_extras pe
                        JOIN public.products p ON p.id = pe.product_id
                        JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (product_extra_id IN (SELECT pe.id FROM public.product_extras pe
                        JOIN public.products p ON p.id = pe.product_id
                        JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.extra_category_item_ingredients
  FOR ALL TO authenticated
  USING (category_item_id IN (SELECT eci.id FROM public.extra_category_items eci
                        JOIN public.extra_categories ec ON ec.id = eci.category_id
                        WHERE ec.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (category_item_id IN (SELECT eci.id FROM public.extra_category_items eci
                        JOIN public.extra_categories ec ON ec.id = eci.category_id
                        WHERE ec.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_or_ceo_read" ON public.restaurant_subscriptions
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_write" ON public.restaurant_subscriptions
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "staff_or_ceo_read" ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_write" ON public.subscription_payments
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "auth_read" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo_write" ON public.subscription_plans
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "auth_read" ON public.plan_payment_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo_write" ON public.plan_payment_links
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "staff_read_same_restaurant" ON public.restaurant_staff
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());

CREATE POLICY "staff_read_same_restaurant" ON public.restaurant_credentials
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());

CREATE POLICY "ceo_read" ON public.ceo_users
  FOR SELECT TO authenticated USING (public.is_ceo());

CREATE POLICY "self_read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ceo());

CREATE POLICY "self_all" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid() OR public.is_ceo())
  WITH CHECK (id = auth.uid());

CREATE POLICY "public_read" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (id = public.current_restaurant_id() OR public.is_ceo())
  WITH CHECK (id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_insert" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (public.is_ceo());
CREATE POLICY "ceo_delete" ON public.restaurants
  FOR DELETE TO authenticated USING (public.is_ceo());

DO $$
DECLARE
  t text;
  catalog_simple text[] := ARRAY[
    'categories','business_hours','reservation_hours','reservation_tables',
    'delivery_zones','payment_methods','loyalty_programs','extra_categories','kiosk_config'
  ];
BEGIN
  FOREACH t IN ARRAY catalog_simple LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (true)', 'public_read', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        || 'USING (restaurant_id = public.current_restaurant_id()) '
        || 'WITH CHECK (restaurant_id = public.current_restaurant_id())',
        'staff_write', t);
    END IF;
  END LOOP;
END $$;

CREATE POLICY "public_read" ON public.products FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.products
  FOR ALL TO authenticated
  USING (category_id IN (SELECT id FROM public.categories WHERE restaurant_id = public.current_restaurant_id()))
  WITH CHECK (category_id IN (SELECT id FROM public.categories WHERE restaurant_id = public.current_restaurant_id()));

CREATE POLICY "public_read" ON public.product_extras FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.product_extras
  FOR ALL TO authenticated
  USING (product_id IN (SELECT p.id FROM public.products p JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (product_id IN (SELECT p.id FROM public.products p JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "public_read" ON public.product_complement_groups FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.product_complement_groups
  FOR ALL TO authenticated
  USING (product_id IN (SELECT p.id FROM public.products p JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (product_id IN (SELECT p.id FROM public.products p JOIN public.categories c ON c.id = p.category_id
                        WHERE c.restaurant_id = public.current_restaurant_id()));

CREATE POLICY "public_read" ON public.extra_category_items FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.extra_category_items
  FOR ALL TO authenticated
  USING (category_id IN (SELECT id FROM public.extra_categories WHERE restaurant_id = public.current_restaurant_id()))
  WITH CHECK (category_id IN (SELECT id FROM public.extra_categories WHERE restaurant_id = public.current_restaurant_id()));

CREATE POLICY "public_read" ON public.loyalty_program_rewards FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.loyalty_program_rewards
  FOR ALL TO authenticated
  USING (program_id IN (SELECT id FROM public.loyalty_programs WHERE restaurant_id = public.current_restaurant_id()))
  WITH CHECK (program_id IN (SELECT id FROM public.loyalty_programs WHERE restaurant_id = public.current_restaurant_id()));

CREATE POLICY "staff_all" ON public.orders
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.orders
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.orders FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_update" ON public.orders
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.order_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.restaurant_id = public.current_restaurant_id()));
CREATE POLICY "anon_insert" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.restaurant_id = public.default_restaurant_id()));
CREATE POLICY "zz_temp_anon_read" ON public.order_items FOR SELECT TO anon USING (true);

CREATE POLICY "staff_all" ON public.order_item_extras
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                 WHERE oi.id = order_item_id AND o.restaurant_id = public.current_restaurant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                 WHERE oi.id = order_item_id AND o.restaurant_id = public.current_restaurant_id()));
CREATE POLICY "anon_insert" ON public.order_item_extras
  FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                 WHERE oi.id = order_item_id AND o.restaurant_id = public.default_restaurant_id()));
CREATE POLICY "zz_temp_anon_read" ON public.order_item_extras FOR SELECT TO anon USING (true);

CREATE POLICY "staff_all" ON public.customers
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.customers FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.customers
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "zz_temp_anon_update" ON public.customers
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.customer_addresses FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.customer_addresses
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "zz_temp_anon_delete" ON public.customer_addresses
  FOR DELETE TO anon USING (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.loyalty_points
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.loyalty_points FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.loyalty_points
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "zz_temp_anon_update" ON public.loyalty_points
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.loyalty_transactions
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_insert" ON public.loyalty_transactions
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.loyalty_reward_redemptions
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.loyalty_reward_redemptions FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.loyalty_reward_redemptions
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.coupons
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.coupons FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_update" ON public.coupons
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.comandas
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.comandas FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.comandas
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "zz_temp_anon_update" ON public.comandas
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.bills
  FOR ALL TO authenticated
  USING (table_id IN (SELECT id FROM public.tables WHERE restaurant_id = public.current_restaurant_id()))
  WITH CHECK (table_id IN (SELECT id FROM public.tables WHERE restaurant_id = public.current_restaurant_id()));
CREATE POLICY "zz_temp_anon_read" ON public.bills FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_insert" ON public.bills
  FOR INSERT TO anon
  WITH CHECK (table_id IN (SELECT id FROM public.tables WHERE restaurant_id = public.default_restaurant_id()));
CREATE POLICY "zz_temp_anon_update" ON public.bills
  FOR UPDATE TO anon
  USING (table_id IN (SELECT id FROM public.tables WHERE restaurant_id = public.default_restaurant_id()))
  WITH CHECK (table_id IN (SELECT id FROM public.tables WHERE restaurant_id = public.default_restaurant_id()));

CREATE POLICY "staff_all" ON public.tables
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "public_read" ON public.tables FOR SELECT USING (true);
CREATE POLICY "zz_temp_anon_update" ON public.tables
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_read" ON public.online_payments
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.online_payments FOR SELECT TO anon USING (true);

CREATE POLICY "staff_read" ON public.customer_cards
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.customer_cards FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_delete" ON public.customer_cards
  FOR DELETE TO anon USING (restaurant_id = public.default_restaurant_id());

CREATE POLICY "staff_all" ON public.reservations
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.reservations
  FOR INSERT TO anon
  WITH CHECK (restaurant_id = public.default_restaurant_id() AND status = 'pending');
CREATE POLICY "zz_temp_anon_read" ON public.reservations FOR SELECT TO anon USING (true);

CREATE POLICY "staff_all" ON public.marketing_scheduled_messages
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.marketing_scheduled_messages FOR SELECT TO anon USING (true);

CREATE POLICY "staff_read" ON public.customer_sessions
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.customer_sessions
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "anon_update" ON public.customer_sessions
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

CREATE POLICY "public_read" ON public.restaurant_reviews FOR SELECT USING (true);
CREATE POLICY "staff_moderate" ON public.restaurant_reviews
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.restaurant_reviews
  FOR INSERT TO anon
  WITH CHECK (restaurant_id = public.default_restaurant_id()
             AND rating BETWEEN 1 AND 5);

-- ============================================================
-- PARTE 3 — storage policies + grants
-- (buckets já existem e product-images/table-images já são públicos)
-- ============================================================
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

DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'insert_point_order_payment','update_point_order_payment','get_point_order_payment',
    'try_acquire_polling_lock','release_polling_lock','trigger_ifood_polling_all','cron_ifood_polling_30s',
    'deduct_stock_for_order_item','is_restaurant_closed_by_order_item','check_product_availability',
    'auto_release_idle_tables','auto_release_inactive_tables','cleanup_abandoned_tables',
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

-- ============================================================
-- PARTE 4 — RPCs seguras do fluxo do cliente
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_customer_by_cpf(p_cpf text)
RETURNS TABLE(id uuid, cpf text, name text, phone text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.cpf, c.name, c.phone, c.email
  FROM public.customers c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND c.cpf = p_cpf
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.upsert_customer(
  p_cpf text, p_name text, p_phone text DEFAULT NULL, p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rid uuid := public.default_restaurant_id();
  v_id uuid;
BEGIN
  INSERT INTO public.customers (restaurant_id, cpf, name, phone, email)
  VALUES (v_rid, p_cpf, p_name, p_phone, p_email)
  ON CONFLICT (restaurant_id, cpf) DO UPDATE
    SET name = EXCLUDED.name,
        phone = COALESCE(EXCLUDED.phone, customers.phone),
        email = COALESCE(EXCLUDED.email, customers.email),
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT to_jsonb(o) || jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(oi) || jsonb_build_object(
        'extras', COALESCE((
          SELECT jsonb_agg(to_jsonb(oie))
          FROM public.order_item_extras oie WHERE oie.order_item_id = oi.id
        ), '[]'::jsonb)
      ))
      FROM public.order_items oi WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.restaurant_id = public.default_restaurant_id()
$$;

CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT status FROM public.orders
  WHERE id = p_order_id AND restaurant_id = public.default_restaurant_id()
$$;

CREATE OR REPLACE FUNCTION public.get_customer_orders(p_cpf text, p_phone text)
RETURNS SETOF public.orders
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_rid uuid := public.default_restaurant_id();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.restaurant_id = v_rid AND c.cpf = p_cpf
      AND (p_phone IS NOT NULL AND regexp_replace(COALESCE(c.phone,''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT * FROM public.orders o
    WHERE o.restaurant_id = v_rid AND o.customer_cpf = p_cpf
    ORDER BY o.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_customer_addresses(p_cpf text, p_phone text)
RETURNS SETOF public.customer_addresses
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.customer_addresses ca
  WHERE ca.restaurant_id = public.default_restaurant_id()
    AND ca.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(ca.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
  ORDER BY ca.is_default DESC, ca.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.add_customer_address(
  p_cpf text, p_name text, p_phone text, p_street text, p_number text,
  p_neighborhood text, p_city text, p_state text, p_zip_code text,
  p_complement text DEFAULT NULL, p_is_default boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.customer_addresses (
    restaurant_id, customer_cpf, customer_name, customer_phone,
    street, number, complement, neighborhood, city, state, zip_code, is_default
  ) VALUES (
    public.default_restaurant_id(), p_cpf, p_name, p_phone,
    p_street, p_number, p_complement, p_neighborhood, p_city, p_state, p_zip_code, p_is_default
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_customer_address(p_id uuid, p_cpf text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.customer_addresses
  WHERE id = p_id AND customer_cpf = p_cpf
    AND restaurant_id = public.default_restaurant_id();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_cpf text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT points_balance FROM public.loyalty_points
    WHERE restaurant_id = public.default_restaurant_id() AND customer_cpf = p_cpf
    LIMIT 1
  ), 0)
$$;

CREATE OR REPLACE FUNCTION public.apply_loyalty(
  p_cpf text, p_points integer, p_type text, p_order_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_rid uuid := public.default_restaurant_id();
  v_balance integer;
BEGIN
  IF p_type NOT IN ('earn','redeem') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  INSERT INTO public.loyalty_points (restaurant_id, customer_cpf, points_balance, total_earned, total_redeemed)
  VALUES (v_rid, p_cpf, 0, 0, 0)
  ON CONFLICT (restaurant_id, customer_cpf) DO NOTHING;

  IF p_type = 'earn' THEN
    UPDATE public.loyalty_points
       SET points_balance = points_balance + p_points,
           total_earned = total_earned + p_points,
           last_updated = now()
     WHERE restaurant_id = v_rid AND customer_cpf = p_cpf
     RETURNING points_balance INTO v_balance;
  ELSE
    UPDATE public.loyalty_points
       SET points_balance = points_balance - p_points,
           total_redeemed = total_redeemed + p_points,
           last_updated = now()
     WHERE restaurant_id = v_rid AND customer_cpf = p_cpf
       AND points_balance >= p_points
     RETURNING points_balance INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Saldo de pontos insuficiente';
    END IF;
  END IF;

  INSERT INTO public.loyalty_transactions (restaurant_id, customer_cpf, order_id, points, type)
  VALUES (v_rid, p_cpf, p_order_id, p_points, p_type);

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_customer_coupons(p_cpf text)
RETURNS TABLE(coupon_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT m.coupon_code
  FROM public.marketing_scheduled_messages m
  WHERE m.restaurant_id = public.default_restaurant_id()
    AND m.customer_cpf = p_cpf
    AND m.coupon_code IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS SETOF public.coupons
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.coupons c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND upper(c.code) = upper(p_code)
    AND c.is_active = true
    AND (c.valid_from IS NULL OR c.valid_from <= now())
    AND (c.valid_until IS NULL OR c.valid_until >= now())
    AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_code text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_ok boolean;
BEGIN
  UPDATE public.coupons
     SET used_count = used_count + 1, updated_at = now()
   WHERE restaurant_id = public.default_restaurant_id()
     AND upper(code) = upper(p_code)
     AND is_active = true
     AND (usage_limit IS NULL OR used_count < usage_limit)
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_payment_status(p_payment_id uuid)
RETURNS TABLE(status text, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT status, paid_at FROM public.online_payments
  WHERE id = p_payment_id AND restaurant_id = public.default_restaurant_id()
$$;

CREATE OR REPLACE FUNCTION public.get_saved_cards(p_cpf text, p_phone text)
RETURNS TABLE(
  id uuid, last_four_digits text, payment_method_id text,
  expiration_month integer, expiration_year integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT cc.id, cc.last_four_digits, cc.payment_method_id,
         cc.expiration_month, cc.expiration_year
  FROM public.customer_cards cc
  WHERE cc.restaurant_id = public.default_restaurant_id()
    AND cc.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(cc.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.delete_saved_card(p_id uuid, p_cpf text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.customer_cards
  WHERE id = p_id AND customer_cpf = p_cpf
    AND restaurant_id = public.default_restaurant_id();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_reservation_availability(p_date date)
RETURNS TABLE(reservation_table_id uuid, reservation_date date, reservation_time time, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT r.reservation_table_id, r.reservation_date, r.reservation_time, r.status
  FROM public.reservations r
  WHERE r.restaurant_id = public.default_restaurant_id()
    AND r.reservation_date = p_date
    AND r.status IN ('pending','confirmed')
$$;

CREATE OR REPLACE FUNCTION public.get_my_reservations(p_cpf text, p_phone text)
RETURNS SETOF public.reservations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.reservations r
  WHERE r.restaurant_id = public.default_restaurant_id()
    AND r.customer_cpf = p_cpf
    AND regexp_replace(COALESCE(r.customer_phone,''), '\D', '', 'g') = regexp_replace(COALESCE(p_phone,''), '\D', '', 'g')
  ORDER BY r.reservation_date DESC, r.reservation_time DESC
$$;

CREATE OR REPLACE FUNCTION public.get_comanda_status(p_table_id uuid, p_cpf text)
RETURNS TABLE(id uuid, status text, table_id uuid, created_at timestamptz, closed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT c.id, c.status, c.table_id, c.created_at, c.closed_at
  FROM public.comandas c
  WHERE c.restaurant_id = public.default_restaurant_id()
    AND c.table_id = p_table_id
    AND c.customer_cpf = p_cpf
  ORDER BY c.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_public_config(p_restaurant_id uuid)
RETURNS TABLE(enabled boolean, instance_status text, message_reservation_created text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT w.enabled, w.instance_status, w.message_reservation_created
  FROM public.whatsapp_config w
  WHERE w.restaurant_id = p_restaurant_id
  LIMIT 1
$$;

DO $$
DECLARE
  r record;
  fns text[] := ARRAY[
    'get_customer_by_cpf','upsert_customer','get_order_details','get_order_status',
    'get_customer_orders','list_customer_addresses','add_customer_address',
    'delete_customer_address','get_loyalty_balance','apply_loyalty','get_customer_coupons',
    'validate_coupon','redeem_coupon','get_payment_status','get_saved_cards',
    'delete_saved_card','get_reservation_availability','get_my_reservations','get_comanda_status',
    'get_whatsapp_public_config'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY(fns)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;