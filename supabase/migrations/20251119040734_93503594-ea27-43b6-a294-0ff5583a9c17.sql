-- Otimizar queries mais frequentes com índices
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created 
  ON orders(restaurant_id, created_at DESC)
  WHERE status != 'delivered';

CREATE INDEX IF NOT EXISTS idx_orders_status_type 
  ON orders(status, order_type)
  WHERE restaurant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_available 
  ON products(category_id, available)
  WHERE available = true;

CREATE INDEX IF NOT EXISTS idx_products_featured 
  ON products(is_featured, featured_display_order)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_order_items_order_product 
  ON order_items(order_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_extras_product 
  ON product_extras(product_id);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_cpf_restaurant 
  ON loyalty_points(customer_cpf, restaurant_id);

-- Adicionar proteção em functions sem search_path
ALTER FUNCTION update_coupons_updated_at() SET search_path = 'public';
ALTER FUNCTION cleanup_abandoned_tables() SET search_path = 'public';
ALTER FUNCTION auto_release_idle_tables() SET search_path = 'public';
ALTER FUNCTION auto_release_inactive_tables() SET search_path = 'public';