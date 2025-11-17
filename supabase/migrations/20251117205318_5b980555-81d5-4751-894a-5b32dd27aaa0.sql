-- Liberar acesso completo para tabelas administrativas e de configuração
-- Para permitir uso local sem autenticação

-- labor_costs (funcionários)
DROP POLICY IF EXISTS "Restaurant admins can manage labor costs" ON public.labor_costs;
CREATE POLICY "Allow all operations on labor costs"
ON public.labor_costs
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- fixed_costs (custos fixos)
DROP POLICY IF EXISTS "Restaurant admins can manage fixed costs" ON public.fixed_costs;
CREATE POLICY "Allow all operations on fixed costs"
ON public.fixed_costs
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- card_fees
DROP POLICY IF EXISTS "Restaurant admins can manage card fees" ON public.card_fees;
CREATE POLICY "Allow all operations on card fees"
ON public.card_fees
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- card_fees_config
DROP POLICY IF EXISTS "Restaurant admins can manage card fees config" ON public.card_fees_config;
CREATE POLICY "Allow all operations on card fees config"
ON public.card_fees_config
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- variable_costs (custos variáveis)
DROP POLICY IF EXISTS "Restaurant admins can manage variable costs" ON public.variable_costs;
CREATE POLICY "Allow all operations on variable costs"
ON public.variable_costs
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- operational_costs (custos operacionais)
DROP POLICY IF EXISTS "Restaurant admins can manage operational costs" ON public.operational_costs;
CREATE POLICY "Allow all operations on operational costs"
ON public.operational_costs
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- delivery_config (configuração de delivery)
DROP POLICY IF EXISTS "Public can view delivery config" ON public.delivery_config;
DROP POLICY IF EXISTS "Restaurant admins can manage delivery config" ON public.delivery_config;
CREATE POLICY "Allow all operations on delivery config"
ON public.delivery_config
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- whatsapp_config (configuração do WhatsApp)
DROP POLICY IF EXISTS "Restaurant admins can manage whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Allow all operations on whatsapp config"
ON public.whatsapp_config
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- extra_categories (categorias de extras)
DROP POLICY IF EXISTS "Public can view extra categories" ON public.extra_categories;
DROP POLICY IF EXISTS "Restaurant admins can manage extra categories" ON public.extra_categories;
CREATE POLICY "Allow all operations on extra categories"
ON public.extra_categories
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- extra_category_items (itens de categorias de extras)
DROP POLICY IF EXISTS "Public can view extra category items" ON public.extra_category_items;
DROP POLICY IF EXISTS "Restaurant admins can manage extra category items" ON public.extra_category_items;
CREATE POLICY "Allow all operations on extra category items"
ON public.extra_category_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- extra_category_item_ingredients (ingredientes de itens de extras)
DROP POLICY IF EXISTS "Public can view extra category item ingredients" ON public.extra_category_item_ingredients;
DROP POLICY IF EXISTS "Restaurant admins can manage extra category item ingredients" ON public.extra_category_item_ingredients;
CREATE POLICY "Allow all operations on extra category item ingredients"
ON public.extra_category_item_ingredients
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);