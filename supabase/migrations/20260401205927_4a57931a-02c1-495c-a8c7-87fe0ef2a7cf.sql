
CREATE TABLE public.kiosk_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  
  -- Payment methods
  payment_cash boolean NOT NULL DEFAULT true,
  payment_card boolean NOT NULL DEFAULT true,
  payment_pix boolean NOT NULL DEFAULT false,
  payment_online boolean NOT NULL DEFAULT false,
  
  -- Order types
  order_dine_in boolean NOT NULL DEFAULT true,
  order_takeaway boolean NOT NULL DEFAULT true,
  order_pickup boolean NOT NULL DEFAULT false,
  order_delivery boolean NOT NULL DEFAULT false,
  
  -- Customer identification
  require_cpf boolean NOT NULL DEFAULT true,
  
  -- Loyalty & coupons
  loyalty_enabled boolean NOT NULL DEFAULT true,
  coupons_enabled boolean NOT NULL DEFAULT true,
  promotions_enabled boolean NOT NULL DEFAULT true,
  
  -- Timeout settings
  inactivity_timeout_seconds integer NOT NULL DEFAULT 120,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.kiosk_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on kiosk_config"
ON public.kiosk_config
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
