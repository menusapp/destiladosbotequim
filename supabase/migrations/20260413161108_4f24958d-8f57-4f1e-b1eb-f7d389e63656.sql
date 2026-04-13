
ALTER TABLE public.extra_categories
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_quantity integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.extra_categories.is_required IS 'Whether the customer must select at least min_quantity items';
COMMENT ON COLUMN public.extra_categories.min_quantity IS 'Minimum number of items the customer must select (0 = no minimum)';
COMMENT ON COLUMN public.extra_categories.max_quantity IS 'Maximum number of items the customer can select (0 = unlimited)';
