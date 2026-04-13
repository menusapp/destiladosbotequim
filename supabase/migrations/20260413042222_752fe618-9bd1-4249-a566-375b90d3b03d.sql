
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pending_plan_slug text;

ALTER TABLE public.restaurant_subscriptions ADD COLUMN IF NOT EXISTS failed_payments integer NOT NULL DEFAULT 0;
