
ALTER TABLE public.product_extras ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.extra_categories ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.extra_category_items ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
