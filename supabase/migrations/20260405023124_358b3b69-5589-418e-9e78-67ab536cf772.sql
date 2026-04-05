
-- Repair: rebuild product_extra_ingredients for all category-linked product_extras
-- that are missing ingredients but should have them based on extra_category_item_ingredients

-- Step 1: Delete all product_extra_ingredients for category-linked product_extras
-- (they may be empty or stale)
DELETE FROM public.product_extra_ingredients
WHERE product_extra_id IN (
  SELECT pe.id FROM public.product_extras pe
  WHERE pe.extra_category_id IS NOT NULL
);

-- Step 2: Recreate product_extra_ingredients from the source of truth
-- Maps: product_extras.name matches extra_category_items.name within the same category
INSERT INTO public.product_extra_ingredients (product_extra_id, stock_item_id, quantity)
SELECT 
  pe.id AS product_extra_id,
  eci_ing.stock_item_id,
  eci_ing.quantity
FROM public.product_extras pe
JOIN public.extra_category_items eci 
  ON eci.category_id = pe.extra_category_id 
  AND eci.name = pe.name
JOIN public.extra_category_item_ingredients eci_ing 
  ON eci_ing.category_item_id = eci.id
WHERE pe.extra_category_id IS NOT NULL;
