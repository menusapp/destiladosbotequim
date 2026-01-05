-- Add columns to orders table for tracking reward discounts
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS reward_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS reward_id uuid REFERENCES loyalty_program_rewards(id);