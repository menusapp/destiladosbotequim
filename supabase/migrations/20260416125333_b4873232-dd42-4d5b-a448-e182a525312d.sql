
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify product belongs to restaurant (supports products without category)
  SELECT true INTO v_exists
  FROM products p
  WHERE p.id = p_product_id AND p.restaurant_id = p_restaurant_id
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
