ALTER TABLE public.products ADD COLUMN featured_active boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN featured_schedule jsonb DEFAULT null;