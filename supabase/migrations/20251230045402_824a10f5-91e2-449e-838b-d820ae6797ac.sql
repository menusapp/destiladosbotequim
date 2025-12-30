-- Add column to support legacy product_extras system for free product variations
ALTER TABLE coupons 
ADD COLUMN IF NOT EXISTS target_product_extra_id uuid REFERENCES product_extras(id) ON DELETE SET NULL;

-- Add comment explaining the two columns
COMMENT ON COLUMN coupons.target_extra_id IS 'ID from extra_category_items (new complement system)';
COMMENT ON COLUMN coupons.target_product_extra_id IS 'ID from product_extras (legacy variation system)';