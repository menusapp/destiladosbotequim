-- ===================================================================
-- SECURITY FIX: Restrict Financial Tables to Restaurant Admins Only
-- ===================================================================

-- Drop overly permissive policies on fixed_costs
DROP POLICY IF EXISTS "Anyone can view fixed costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "Anyone can create fixed costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "Anyone can update fixed costs" ON public.fixed_costs;
DROP POLICY IF EXISTS "Anyone can delete fixed costs" ON public.fixed_costs;

CREATE POLICY "Restaurant admins can manage fixed costs"
ON public.fixed_costs FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Drop overly permissive policies on variable_costs
DROP POLICY IF EXISTS "Anyone can view variable costs" ON public.variable_costs;
DROP POLICY IF EXISTS "Anyone can create variable costs" ON public.variable_costs;
DROP POLICY IF EXISTS "Anyone can update variable costs" ON public.variable_costs;
DROP POLICY IF EXISTS "Anyone can delete variable costs" ON public.variable_costs;

CREATE POLICY "Restaurant admins can manage variable costs"
ON public.variable_costs FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Drop overly permissive policies on labor_costs
DROP POLICY IF EXISTS "Anyone can view labor costs" ON public.labor_costs;
DROP POLICY IF EXISTS "Anyone can create labor costs" ON public.labor_costs;
DROP POLICY IF EXISTS "Anyone can update labor costs" ON public.labor_costs;
DROP POLICY IF EXISTS "Anyone can delete labor costs" ON public.labor_costs;

CREATE POLICY "Restaurant admins can manage labor costs"
ON public.labor_costs FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Drop overly permissive policies on card_fees
DROP POLICY IF EXISTS "Qualquer um pode ver taxas de cartões" ON public.card_fees;
DROP POLICY IF EXISTS "Qualquer um pode criar taxas de cartões" ON public.card_fees;
DROP POLICY IF EXISTS "Qualquer um pode atualizar taxas de cartões" ON public.card_fees;
DROP POLICY IF EXISTS "Qualquer um pode deletar taxas de cartões" ON public.card_fees;

CREATE POLICY "Restaurant admins can manage card fees"
ON public.card_fees FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Drop overly permissive policies on operational_costs
DROP POLICY IF EXISTS "Qualquer um pode ver custos operacionais" ON public.operational_costs;
DROP POLICY IF EXISTS "Qualquer um pode criar custos operacionais" ON public.operational_costs;
DROP POLICY IF EXISTS "Qualquer um pode atualizar custos operacionais" ON public.operational_costs;
DROP POLICY IF EXISTS "Qualquer um pode deletar custos operacionais" ON public.operational_costs;

CREATE POLICY "Restaurant admins can manage operational costs"
ON public.operational_costs FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Drop overly permissive policies on card_fees_config
DROP POLICY IF EXISTS "Anyone can view card fees config" ON public.card_fees_config;
DROP POLICY IF EXISTS "Anyone can create card fees config" ON public.card_fees_config;
DROP POLICY IF EXISTS "Anyone can update card fees config" ON public.card_fees_config;

CREATE POLICY "Restaurant admins can manage card fees config"
ON public.card_fees_config FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- ===================================================================
-- SECURITY FIX: Restrict Cash Register to Restaurant Admins Only
-- ===================================================================

DROP POLICY IF EXISTS "Anyone can view cash sessions" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "Anyone can create cash sessions" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "Anyone can update cash sessions" ON public.cash_register_sessions;

CREATE POLICY "Restaurant admins can manage cash sessions"
ON public.cash_register_sessions FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Anyone can view cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Anyone can create cash movements" ON public.cash_movements;
DROP POLICY IF EXISTS "Anyone can update cash movements" ON public.cash_movements;

CREATE POLICY "Restaurant admins can manage cash movements"
ON public.cash_movements FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- ===================================================================
-- SECURITY FIX: Restrict Stock Tables to Restaurant Admins
-- ===================================================================

DROP POLICY IF EXISTS "Insumos são públicos" ON public.stock_items;
DROP POLICY IF EXISTS "Qualquer um pode criar insumos" ON public.stock_items;
DROP POLICY IF EXISTS "Qualquer um pode atualizar insumos" ON public.stock_items;
DROP POLICY IF EXISTS "Qualquer um pode deletar insumos" ON public.stock_items;

-- Keep SELECT public for menu availability checks
CREATE POLICY "Public can view stock availability"
ON public.stock_items FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage stock items"
ON public.stock_items FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Categorias de estoque são públicas" ON public.stock_categories;
DROP POLICY IF EXISTS "Qualquer um pode criar categorias de estoque" ON public.stock_categories;
DROP POLICY IF EXISTS "Qualquer um pode atualizar categorias de estoque" ON public.stock_categories;
DROP POLICY IF EXISTS "Qualquer um pode deletar categorias de estoque" ON public.stock_categories;

CREATE POLICY "Restaurant admins can manage stock categories"
ON public.stock_categories FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Movimentações são públicas" ON public.stock_movements;
DROP POLICY IF EXISTS "Qualquer um pode criar movimentações" ON public.stock_movements;

CREATE POLICY "Restaurant admins can manage stock movements"
ON public.stock_movements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.stock_items si
    WHERE si.id = stock_movements.stock_item_id
    AND public.is_restaurant_admin(auth.uid(), si.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stock_items si
    WHERE si.id = stock_movements.stock_item_id
    AND public.is_restaurant_admin(auth.uid(), si.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Ingredientes de produtos são públicos" ON public.product_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode criar ingredientes de produtos" ON public.product_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode atualizar ingredientes de produtos" ON public.product_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode deletar ingredientes de produtos" ON public.product_ingredients;

-- Keep SELECT public for menu display
CREATE POLICY "Public can view product ingredients"
ON public.product_ingredients FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage product ingredients"
ON public.product_ingredients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = product_ingredients.product_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = product_ingredients.product_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Ingredientes de adicionais são públicos" ON public.product_extra_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode criar ingredientes de adicionais" ON public.product_extra_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode atualizar ingredientes de adicionais" ON public.product_extra_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode deletar ingredientes de adicionais" ON public.product_extra_ingredients;

CREATE POLICY "Public can view extra ingredients"
ON public.product_extra_ingredients FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage extra ingredients"
ON public.product_extra_ingredients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.product_extras pe
    JOIN public.products p ON p.id = pe.product_id
    JOIN public.categories c ON c.id = p.category_id
    WHERE pe.id = product_extra_ingredients.product_extra_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_extras pe
    JOIN public.products p ON p.id = pe.product_id
    JOIN public.categories c ON c.id = p.category_id
    WHERE pe.id = product_extra_ingredients.product_extra_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

-- ===================================================================
-- SECURITY FIX: Remove Public Write Access from Admin Tables
-- ===================================================================

DROP POLICY IF EXISTS "Qualquer um pode criar categorias" ON public.categories;
DROP POLICY IF EXISTS "Qualquer um pode atualizar categorias" ON public.categories;
DROP POLICY IF EXISTS "Qualquer um pode deletar categorias" ON public.categories;

DROP POLICY IF EXISTS "Qualquer um pode criar adicionais" ON public.product_extras;
DROP POLICY IF EXISTS "Qualquer um pode atualizar adicionais" ON public.product_extras;
DROP POLICY IF EXISTS "Qualquer um pode deletar adicionais" ON public.product_extras;

-- Keep public SELECT for menu (already have "Adicionais são públicos")
CREATE POLICY "Restaurant admins can manage extras"
ON public.product_extras FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = product_extras.product_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = product_extras.product_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Qualquer um pode criar mesas" ON public.tables;
DROP POLICY IF EXISTS "Qualquer um pode atualizar mesas" ON public.tables;
DROP POLICY IF EXISTS "Qualquer um pode deletar mesas" ON public.tables;

-- Allow public UPDATE for table occupation (QR code flow)
CREATE POLICY "Public can occupy tables in open restaurants"
ON public.tables FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = tables.restaurant_id AND r.is_open = true
  )
);

DROP POLICY IF EXISTS "Categorias de adicionais são públicas" ON public.extra_categories;
DROP POLICY IF EXISTS "Qualquer um pode criar categorias de adicionais" ON public.extra_categories;
DROP POLICY IF EXISTS "Qualquer um pode atualizar categorias de adicionais" ON public.extra_categories;
DROP POLICY IF EXISTS "Qualquer um pode deletar categorias de adicionais" ON public.extra_categories;

CREATE POLICY "Public can view extra categories"
ON public.extra_categories FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage extra categories"
ON public.extra_categories FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Itens de categorias são públicos" ON public.extra_category_items;
DROP POLICY IF EXISTS "Qualquer um pode criar itens de categorias" ON public.extra_category_items;
DROP POLICY IF EXISTS "Qualquer um pode atualizar itens de categorias" ON public.extra_category_items;
DROP POLICY IF EXISTS "Qualquer um pode deletar itens de categorias" ON public.extra_category_items;

CREATE POLICY "Public can view extra category items"
ON public.extra_category_items FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage extra category items"
ON public.extra_category_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.extra_categories ec
    WHERE ec.id = extra_category_items.category_id
    AND public.is_restaurant_admin(auth.uid(), ec.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.extra_categories ec
    WHERE ec.id = extra_category_items.category_id
    AND public.is_restaurant_admin(auth.uid(), ec.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Ingredientes de itens de categoria são públicos" ON public.extra_category_item_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode criar ingredientes de itens de categoria" ON public.extra_category_item_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode atualizar ingredientes de itens de categoria" ON public.extra_category_item_ingredients;
DROP POLICY IF EXISTS "Qualquer um pode deletar ingredientes de itens de categoria" ON public.extra_category_item_ingredients;

CREATE POLICY "Public can view extra category item ingredients"
ON public.extra_category_item_ingredients FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage extra category item ingredients"
ON public.extra_category_item_ingredients FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.extra_category_items eci
    JOIN public.extra_categories ec ON ec.id = eci.category_id
    WHERE eci.id = extra_category_item_ingredients.category_item_id
    AND public.is_restaurant_admin(auth.uid(), ec.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.extra_category_items eci
    JOIN public.extra_categories ec ON ec.id = eci.category_id
    WHERE eci.id = extra_category_item_ingredients.category_item_id
    AND public.is_restaurant_admin(auth.uid(), ec.restaurant_id)
  )
);

-- ===================================================================
-- SECURITY FIX: Restrict Counter Orders to Restaurant Admins
-- ===================================================================

DROP POLICY IF EXISTS "Qualquer um pode ver pedidos de balcão" ON public.counter_orders;
DROP POLICY IF EXISTS "Qualquer um pode criar pedidos de balcão" ON public.counter_orders;
DROP POLICY IF EXISTS "Qualquer um pode atualizar pedidos de balcão" ON public.counter_orders;
DROP POLICY IF EXISTS "Qualquer um pode deletar pedidos de balcão" ON public.counter_orders;

CREATE POLICY "Restaurant admins can manage counter orders"
ON public.counter_orders FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Itens de pedidos de balcão são públicos" ON public.counter_order_items;
DROP POLICY IF EXISTS "Qualquer um pode criar itens de pedidos de balcão" ON public.counter_order_items;
DROP POLICY IF EXISTS "Qualquer um pode atualizar itens de pedidos de balcão" ON public.counter_order_items;
DROP POLICY IF EXISTS "Qualquer um pode deletar itens de pedidos de balcão" ON public.counter_order_items;

CREATE POLICY "Restaurant admins can manage counter order items"
ON public.counter_order_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.counter_orders co
    WHERE co.id = counter_order_items.counter_order_id
    AND public.is_restaurant_admin(auth.uid(), co.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.counter_orders co
    WHERE co.id = counter_order_items.counter_order_id
    AND public.is_restaurant_admin(auth.uid(), co.restaurant_id)
  )
);

DROP POLICY IF EXISTS "Extras de itens de balcão são públicos" ON public.counter_order_item_extras;
DROP POLICY IF EXISTS "Qualquer um pode criar extras de itens de balcão" ON public.counter_order_item_extras;
DROP POLICY IF EXISTS "Qualquer um pode deletar extras de itens de balcão" ON public.counter_order_item_extras;

CREATE POLICY "Restaurant admins can manage counter order extras"
ON public.counter_order_item_extras FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.counter_order_items coi
    JOIN public.counter_orders co ON co.id = coi.counter_order_id
    WHERE coi.id = counter_order_item_extras.counter_order_item_id
    AND public.is_restaurant_admin(auth.uid(), co.restaurant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.counter_order_items coi
    JOIN public.counter_orders co ON co.id = coi.counter_order_id
    WHERE coi.id = counter_order_item_extras.counter_order_item_id
    AND public.is_restaurant_admin(auth.uid(), co.restaurant_id)
  )
);

-- ===================================================================
-- SECURITY FIX: Restrict WhatsApp & Delivery Config to Admins
-- ===================================================================

DROP POLICY IF EXISTS "Anyone can view whatsapp config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Anyone can create whatsapp config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Anyone can update whatsapp config" ON public.whatsapp_config;

CREATE POLICY "Restaurant admins can manage whatsapp config"
ON public.whatsapp_config FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Anyone can view delivery config" ON public.delivery_config;
DROP POLICY IF EXISTS "Anyone can create delivery config" ON public.delivery_config;
DROP POLICY IF EXISTS "Anyone can update delivery config" ON public.delivery_config;

-- Keep SELECT public for customers to see delivery fees/minimums
CREATE POLICY "Public can view delivery config"
ON public.delivery_config FOR SELECT
USING (true);

CREATE POLICY "Restaurant admins can manage delivery config"
ON public.delivery_config FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));