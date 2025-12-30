-- Add coupon_id to marketing_campaign_rules
ALTER TABLE marketing_campaign_rules
ADD COLUMN coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL;

-- Create table to track reward redemptions
CREATE TABLE loyalty_reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_cpf text NOT NULL,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES loyalty_program_rewards(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  trigger_value numeric NOT NULL,
  redeemed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on loyalty_reward_redemptions"
ON loyalty_reward_redemptions
FOR ALL
USING (true)
WITH CHECK (true);