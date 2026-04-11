ALTER TABLE public.online_payment_config
  ADD COLUMN IF NOT EXISTS mp_pos_id text,
  ADD COLUMN IF NOT EXISTS mp_pos_name text;