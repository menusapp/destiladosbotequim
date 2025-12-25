-- Add order_type_filter column to marketing_campaign_rules
-- Values: 'all' (default), 'online' (delivery/pickup), 'local' (table orders)
ALTER TABLE marketing_campaign_rules 
ADD COLUMN IF NOT EXISTS order_type_filter text DEFAULT 'all';