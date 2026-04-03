
-- Add restaurant_id to products
ALTER TABLE public.products ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id);

-- Backfill from categories
UPDATE public.products p
SET restaurant_id = c.restaurant_id
FROM public.categories c
WHERE p.category_id = c.id AND p.restaurant_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.products ALTER COLUMN restaurant_id SET NOT NULL;
