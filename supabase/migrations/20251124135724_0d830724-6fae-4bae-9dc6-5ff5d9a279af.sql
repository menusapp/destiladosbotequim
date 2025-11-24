-- Remover constraint antiga e criar nova com picked_up
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'delivered', 'picked_up', 'cancelled'));