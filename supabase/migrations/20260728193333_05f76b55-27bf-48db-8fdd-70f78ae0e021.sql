UPDATE public.whatsapp_config
   SET enabled = true, updated_at = now()
 WHERE instance_status IN ('connected', 'open')
   AND enabled IS DISTINCT FROM true;

ALTER TABLE public.customer_sessions
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_type text;