ALTER TABLE public.product_extras ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;
ALTER TABLE public.extra_category_items ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;