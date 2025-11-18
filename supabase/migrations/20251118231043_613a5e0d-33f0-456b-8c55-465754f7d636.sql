-- Add picked_up status as a valid option for orders
-- This allows differentiation between delivered orders and picked up orders

COMMENT ON COLUMN orders.status IS 'Valid values: pending, accepted, ready, delivered, picked_up, cancelled';
