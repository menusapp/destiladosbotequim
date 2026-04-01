ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS dd_scheduled_for timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason text;