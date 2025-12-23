-- Add columns for Evolution API instance management
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS instance_name TEXT,
ADD COLUMN IF NOT EXISTS instance_status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS connected_phone TEXT,
ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Add index for faster lookups by instance_name
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_instance_name ON public.whatsapp_config(instance_name);

-- Add index for restaurant_id (already unique but good for lookups)
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_restaurant_id ON public.whatsapp_config(restaurant_id);