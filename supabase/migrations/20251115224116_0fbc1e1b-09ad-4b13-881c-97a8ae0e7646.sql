-- Remove todas as restrições RLS para funcionamento local
-- Permite operações anônimas completas em todas as tabelas necessárias

-- counter_orders
DROP POLICY IF EXISTS "Allow anonymous read of counter orders" ON counter_orders;
DROP POLICY IF EXISTS "Allow authenticated users to manage counter orders" ON counter_orders;
DROP POLICY IF EXISTS "Restaurant admins can manage counter orders" ON counter_orders;

CREATE POLICY "Allow all operations on counter orders"
ON counter_orders
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- counter_order_items
DROP POLICY IF EXISTS "Restaurant admins can manage counter order items" ON counter_order_items;

CREATE POLICY "Allow all operations on counter order items"
ON counter_order_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- counter_order_item_extras
DROP POLICY IF EXISTS "Restaurant admins can manage counter order extras" ON counter_order_item_extras;

CREATE POLICY "Allow all operations on counter order item extras"
ON counter_order_item_extras
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- stock_items
DROP POLICY IF EXISTS "Public can view stock availability" ON stock_items;
DROP POLICY IF EXISTS "Restaurant admins can manage stock items" ON stock_items;

CREATE POLICY "Allow all operations on stock items"
ON stock_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- stock_movements
DROP POLICY IF EXISTS "Restaurant admins can manage stock movements" ON stock_movements;

CREATE POLICY "Allow all operations on stock movements"
ON stock_movements
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- stock_categories
DROP POLICY IF EXISTS "Restaurant admins can manage stock categories" ON stock_categories;

CREATE POLICY "Allow all operations on stock categories"
ON stock_categories
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- products
DROP POLICY IF EXISTS "Produtos são públicos" ON products;
DROP POLICY IF EXISTS "Restaurant admins can manage products" ON products;
DROP POLICY IF EXISTS "Restaurant admins can delete products" ON products;
DROP POLICY IF EXISTS "Restaurant admins can update products" ON products;

CREATE POLICY "Allow all operations on products"
ON products
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- product_extras
DROP POLICY IF EXISTS "Adicionais são públicos" ON product_extras;
DROP POLICY IF EXISTS "Restaurant admins can manage extras" ON product_extras;

CREATE POLICY "Allow all operations on product extras"
ON product_extras
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- product_ingredients
DROP POLICY IF EXISTS "Public can view product ingredients" ON product_ingredients;
DROP POLICY IF EXISTS "Restaurant admins can manage product ingredients" ON product_ingredients;

CREATE POLICY "Allow all operations on product ingredients"
ON product_ingredients
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- product_extra_ingredients
DROP POLICY IF EXISTS "Public can view extra ingredients" ON product_extra_ingredients;
DROP POLICY IF EXISTS "Restaurant admins can manage extra ingredients" ON product_extra_ingredients;

CREATE POLICY "Allow all operations on product extra ingredients"
ON product_extra_ingredients
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- categories
DROP POLICY IF EXISTS "Categorias são públicas" ON categories;
DROP POLICY IF EXISTS "Restaurant admins can manage categories" ON categories;

CREATE POLICY "Allow all operations on categories"
ON categories
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- tables
DROP POLICY IF EXISTS "Mesas são públicas" ON tables;
DROP POLICY IF EXISTS "Public can occupy tables in open restaurants" ON tables;

CREATE POLICY "Allow all operations on tables"
ON tables
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- orders
DROP POLICY IF EXISTS "Public can create orders for open restaurants" ON orders;
DROP POLICY IF EXISTS "Public can view orders for open restaurants" ON orders;
DROP POLICY IF EXISTS "Restaurant admins can manage orders" ON orders;

CREATE POLICY "Allow all operations on orders"
ON orders
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- order_items
DROP POLICY IF EXISTS "Qualquer um pode ver itens de pedido" ON order_items;
DROP POLICY IF EXISTS "Qualquer um pode criar itens de pedido" ON order_items;
DROP POLICY IF EXISTS "Delete order_items when restaurant is closed" ON order_items;

CREATE POLICY "Allow all operations on order items"
ON order_items
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- order_item_extras
DROP POLICY IF EXISTS "Qualquer um pode ver extras dos itens do pedido" ON order_item_extras;
DROP POLICY IF EXISTS "Qualquer um pode criar extras dos itens do pedido" ON order_item_extras;
DROP POLICY IF EXISTS "Delete order_item_extras when restaurant is closed" ON order_item_extras;

CREATE POLICY "Allow all operations on order item extras"
ON order_item_extras
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- bills
DROP POLICY IF EXISTS "Public can view bills for open restaurants" ON bills;
DROP POLICY IF EXISTS "Public can create bills for open restaurants" ON bills;
DROP POLICY IF EXISTS "Restaurant admins can view bills" ON bills;
DROP POLICY IF EXISTS "Restaurant admins can create bills" ON bills;
DROP POLICY IF EXISTS "Restaurant admins can update bills" ON bills;

CREATE POLICY "Allow all operations on bills"
ON bills
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- restaurants
DROP POLICY IF EXISTS "Qualquer um pode ver restaurantes" ON restaurants;
DROP POLICY IF EXISTS "Qualquer um pode ver status do restaurante" ON restaurants;
DROP POLICY IF EXISTS "Restaurant admins can update own restaurant" ON restaurants;
DROP POLICY IF EXISTS "CEOs can manage restaurants" ON restaurants;

CREATE POLICY "Allow all operations on restaurants"
ON restaurants
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);