-- Admin cascade delete: product
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify product belongs to restaurant
  SELECT true INTO v_exists
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.id = p_product_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this product';
  END IF;

  -- Delete extra ingredients linked to product extras
  DELETE FROM product_extra_ingredients pei
  USING product_extras pe
  WHERE pei.product_extra_id = pe.id
    AND pe.product_id = p_product_id;

  -- Delete product extras
  DELETE FROM product_extras
  WHERE product_id = p_product_id;

  -- Delete product ingredients
  DELETE FROM product_ingredients
  WHERE product_id = p_product_id;

  -- Finally delete product
  DELETE FROM products WHERE id = p_product_id;
END;
$$;

-- Admin cascade delete: category (deletes products + links)
CREATE OR REPLACE FUNCTION public.admin_delete_category(p_category_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
  v_product RECORD;
BEGIN
  -- Verify category belongs to restaurant
  SELECT true INTO v_exists
  FROM categories c
  WHERE c.id = p_category_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this category';
  END IF;

  -- Delete all products in this category using the product delete function
  FOR v_product IN
    SELECT id FROM products WHERE category_id = p_category_id
  LOOP
    PERFORM public.admin_delete_product(v_product.id, p_restaurant_id);
  END LOOP;

  -- Delete the category itself
  DELETE FROM categories WHERE id = p_category_id;
END;
$$;

-- Admin delete stock item (insumo) and remove links
CREATE OR REPLACE FUNCTION public.admin_delete_stock_item(p_stock_item_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify stock item belongs to restaurant
  SELECT true INTO v_exists
  FROM stock_items si
  WHERE si.id = p_stock_item_id AND si.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this stock item';
  END IF;

  -- Remove links from products and extras that use this stock item
  DELETE FROM product_ingredients WHERE stock_item_id = p_stock_item_id;
  DELETE FROM product_extra_ingredients WHERE stock_item_id = p_stock_item_id;

  -- Finally delete stock item
  DELETE FROM stock_items WHERE id = p_stock_item_id;
END;
$$;

-- Admin delete single product extra (does not touch orders history)
CREATE OR REPLACE FUNCTION public.admin_delete_product_extra(p_product_extra_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify extra belongs to restaurant through product -> category -> restaurant
  SELECT true INTO v_exists
  FROM product_extras pe
  JOIN products p ON p.id = pe.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE pe.id = p_product_extra_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this extra';
  END IF;

  -- Delete ingredients of the extra
  DELETE FROM product_extra_ingredients WHERE product_extra_id = p_product_extra_id;

  -- Delete the extra
  DELETE FROM product_extras WHERE id = p_product_extra_id;
END;
$$;

-- Realtime publication and replica identity for key tables
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.stock_items REPLICA IDENTITY FULL;
ALTER TABLE public.restaurants REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;