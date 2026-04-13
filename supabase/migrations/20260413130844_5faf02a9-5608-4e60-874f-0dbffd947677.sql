
CREATE TABLE public.whatsapp_inbound_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_inbound_events_unique UNIQUE (restaurant_id, message_id)
);

ALTER TABLE public.whatsapp_inbound_events ENABLE ROW LEVEL SECURITY;

-- No public access - only service role key used by edge functions
CREATE INDEX idx_whatsapp_inbound_events_created ON public.whatsapp_inbound_events (created_at);
