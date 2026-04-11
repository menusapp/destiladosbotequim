ALTER TABLE public.online_payment_config
  ADD COLUMN IF NOT EXISTS mp_external_pos_id text;