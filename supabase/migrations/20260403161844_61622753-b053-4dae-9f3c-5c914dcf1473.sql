
-- 1. Make category_id nullable
ALTER TABLE public.products ALTER COLUMN category_id DROP NOT NULL;

-- 2. Drop old CASCADE FK and recreate with SET NULL
ALTER TABLE public.products DROP CONSTRAINT products_category_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Drop and recreate unique constraint to handle NULL category_id
ALTER TABLE public.products DROP CONSTRAINT products_name_category_unique;
CREATE UNIQUE INDEX products_name_category_unique ON public.products (name, category_id) WHERE category_id IS NOT NULL;

-- 4. Replace admin_delete_category function: unlink products instead of deleting them
CREATE OR REPLACE FUNCTION public.admin_delete_category(p_category_id uuid, p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify category belongs to restaurant
  SELECT true INTO v_exists
  FROM categories c
  WHERE c.id = p_category_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this category';
  END IF;

  -- Unlink products: set category_id to NULL instead of deleting
  UPDATE products SET category_id = NULL WHERE category_id = p_category_id;

  -- Delete the category itself
  DELETE FROM categories WHERE id = p_category_id;
END;
$$;
