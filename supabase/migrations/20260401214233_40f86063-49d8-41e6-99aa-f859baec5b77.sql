-- Add order_channel column to identify the source of orders (totem, delivery, local, pdv, ifood, dd)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_channel text DEFAULT NULL;

-- Add an index for filtering by channel
CREATE INDEX IF NOT EXISTS idx_orders_order_channel ON public.orders(order_channel);
