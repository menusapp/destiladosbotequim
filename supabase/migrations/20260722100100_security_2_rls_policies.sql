-- =====================================================================
-- SECURITY HARDENING — Parte 2: políticas RLS (Estágio A)
-- ---------------------------------------------------------------------
-- O que esta parte FAZ (seguro assim que o login por token JWT estiver
-- ativo — ver runbook):
--   * Trava TODAS as tabelas só-de-staff (financeiro, PII interno, estoque,
--     custos, fiscal, fornecedores, whatsapp, marketing interno, assinatura,
--     etc.) para `authenticated` do próprio restaurante. Zero acesso anônimo.
--   * Remove a ESCRITA anônima do catálogo público (produtos, preços,
--     configurações do restaurante) — só staff autenticado escreve.
--   * Habilita RLS em tudo e apaga as políticas permissivas antigas.
--
-- O que esta parte NÃO faz ainda (fica para a Parte 5, após os refactors
-- de frontend): fechar a LEITURA anônima das tabelas que o cliente do
-- cardápio toca (customers, orders, loyalty, cupons, comandas, contas,
-- endereços...). Essas mantêm um acesso anônimo TEMPORÁRIO (políticas
-- prefixadas com `zz_temp_`) para não quebrar o app enquanto a Parte 4/5
-- não entra. Elas ainda aparecem como "PII legível por anon" até lá.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Habilita RLS e limpa TODAS as políticas antigas das tabelas alvo.
--    (Drop dinâmico por nome descoberto — não dependemos de nomes legados.)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  r record;
  target_tables text[] := ARRAY[
    -- staff-only
    'cash_movements','cash_register_sessions','printer_settings','order_fiscal_notes',
    'suppliers','employee_credits','nfe_imports','stock_items','stock_categories',
    'stock_movements','variable_costs','fixed_costs','labor_costs','fiscal_configs',
    'delivery_config','marketing_campaigns','marketing_campaign_rules',
    'whatsapp_conversations','whatsapp_config','whatsapp_ai_config',
    'whatsapp_notification_configs','whatsapp_menu_options','owner_notification_config',
    'counter_orders','counter_order_items','customer_loyalty_progress',
    'product_ingredients','product_extra_ingredients','extra_category_item_ingredients',
    -- billing / platform
    'restaurant_subscriptions','subscription_payments','subscription_plans','plan_payment_links',
    -- auth
    'restaurant_staff','restaurant_credentials','ceo_users','user_roles','profiles',
    -- public catalog
    'restaurants','products','product_extras','product_complement_groups','categories',
    'extra_categories','extra_category_items','business_hours','reservation_hours',
    'reservation_tables','delivery_zones','payment_methods','loyalty_programs',
    'loyalty_program_rewards',
    -- customer-touched (tier 2)
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

-- ---------------------------------------------------------------------
-- 1) Tabelas SÓ-DE-STAFF com restaurant_id → política FOR ALL uniforme.
--    Anon não tem política ⇒ nenhum acesso anônimo.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2) Tabelas SÓ-DE-STAFF sem restaurant_id → escopo via JOIN no pai.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3) Billing / plataforma (staff do restaurante OU CEO).
-- ---------------------------------------------------------------------
CREATE POLICY "staff_or_ceo_read" ON public.restaurant_subscriptions
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_write" ON public.restaurant_subscriptions
  FOR ALL TO authenticated
  USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "staff_or_ceo_read" ON public.subscription_payments
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_write" ON public.subscription_payments
  FOR ALL TO authenticated
  USING (public.is_ceo()) WITH CHECK (public.is_ceo());

-- Catálogo global de planos: legível por qualquer autenticado; escrita só CEO.
CREATE POLICY "auth_read" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo_write" ON public.subscription_plans
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

CREATE POLICY "auth_read" ON public.plan_payment_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo_write" ON public.plan_payment_links
  FOR ALL TO authenticated USING (public.is_ceo()) WITH CHECK (public.is_ceo());

-- ---------------------------------------------------------------------
-- 4) Tabelas de autenticação/autorização (mais restritas).
--    Sem escrita pelo cliente — criação/edição é via RPC/service_role.
--    Colunas de senha (password_hash) já não são lidas pelo app.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 5) Catálogo público (leitura anônima OK; escrita só staff autenticado).
--    Correção-chave: remove a ESCRITA anônima (adulteração de preços,
--    disponibilidade, configurações do restaurante, etc.).
-- ---------------------------------------------------------------------

-- restaurants: leitura pública (resolvido por slug em toda página); escrita
-- só do próprio restaurante ou CEO.
CREATE POLICY "public_read" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "staff_write" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (id = public.current_restaurant_id() OR public.is_ceo())
  WITH CHECK (id = public.current_restaurant_id() OR public.is_ceo());
CREATE POLICY "ceo_insert" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (public.is_ceo());
CREATE POLICY "ceo_delete" ON public.restaurants
  FOR DELETE TO authenticated USING (public.is_ceo());

-- Catálogo com restaurant_id direto: leitura pública + escrita staff.
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

-- Catálogo por JOIN (sem restaurant_id): leitura pública + escrita staff.
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

-- ---------------------------------------------------------------------
-- 6) Tabelas que o CLIENTE toca (tier 2).
--    Estágio A: staff = acesso total do restaurante; anon = apenas o
--    MÍNIMO para o app funcionar hoje. As leituras anônimas de PII ficam
--    em políticas `zz_temp_anon_*` (fechadas na Parte 5 via RPCs).
-- ---------------------------------------------------------------------

-- ---- ORDERS + itens (INSERT anônimo é legítimo no checkout) ----
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

-- ---- CUSTOMERS + endereços (leitura vira RPC na Parte 5) ----
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

-- ---- LOYALTY (leitura/escrita vira RPC atômica na Parte 5) ----
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

-- ---- COUPONS (validação/uso vira RPC na Parte 5) ----
CREATE POLICY "staff_all" ON public.coupons
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.coupons FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_update" ON public.coupons
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

-- ---- COMANDAS / BILLS / TABLES (mesa/autoatendimento) ----
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

-- tables: leitura pública (QR/ocupação, baixa sensibilidade) permanente;
-- update de ocupação anônimo é temporário (fecha para colunas específicas na Parte 5).
CREATE POLICY "staff_all" ON public.tables
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "public_read" ON public.tables FOR SELECT USING (true);
CREATE POLICY "zz_temp_anon_update" ON public.tables
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

-- ---- ONLINE PAYMENTS / CARDS (leitura de status vira RPC; escrita é service_role) ----
CREATE POLICY "staff_read" ON public.online_payments
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.online_payments FOR SELECT TO anon USING (true);

CREATE POLICY "staff_read" ON public.customer_cards
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.customer_cards FOR SELECT TO anon USING (true);
CREATE POLICY "zz_temp_anon_delete" ON public.customer_cards
  FOR DELETE TO anon USING (restaurant_id = public.default_restaurant_id());

-- ---- RESERVATIONS (INSERT anônimo legítimo; leitura vira RPC) ----
CREATE POLICY "staff_all" ON public.reservations
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.reservations
  FOR INSERT TO anon
  WITH CHECK (restaurant_id = public.default_restaurant_id() AND status = 'pending');
CREATE POLICY "zz_temp_anon_read" ON public.reservations FOR SELECT TO anon USING (true);

-- ---- MARKETING scheduled messages (leitura de cupom vira RPC) ----
CREATE POLICY "staff_all" ON public.marketing_scheduled_messages
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "zz_temp_anon_read" ON public.marketing_scheduled_messages FOR SELECT TO anon USING (true);

-- ---- CUSTOMER SESSIONS (tracking anônimo: escreve, nunca lê) ----
-- Sem SELECT anônimo ⇒ carrinho/telefone não são dumpáveis já no Estágio A.
CREATE POLICY "staff_read" ON public.customer_sessions
  FOR SELECT TO authenticated USING (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.customer_sessions
  FOR INSERT TO anon WITH CHECK (restaurant_id = public.default_restaurant_id());
CREATE POLICY "anon_update" ON public.customer_sessions
  FOR UPDATE TO anon
  USING (restaurant_id = public.default_restaurant_id())
  WITH CHECK (restaurant_id = public.default_restaurant_id());

-- ---- RESTAURANT REVIEWS (avaliações públicas) ----
CREATE POLICY "public_read" ON public.restaurant_reviews FOR SELECT USING (true);
CREATE POLICY "staff_moderate" ON public.restaurant_reviews
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());
CREATE POLICY "anon_insert" ON public.restaurant_reviews
  FOR INSERT TO anon
  WITH CHECK (restaurant_id = public.default_restaurant_id()
             AND rating BETWEEN 1 AND 5);
