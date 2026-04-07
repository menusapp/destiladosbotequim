ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurant_subscriptions ADD COLUMN IF NOT EXISTS mp_preapproval_id text;

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS mp_payer_email text;