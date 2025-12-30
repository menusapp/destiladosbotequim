-- Fix coupons discount_value constraint to allow 0 for free_* coupons
ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_discount_value_check;

-- For discount coupons, discount_value must be > 0.
-- For free_product/free_delivery coupons, discount_value must be = 0.
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_discount_value_check
  CHECK (
    (coupon_type = 'discount' AND discount_value > 0)
    OR (coupon_type IN ('free_product', 'free_delivery') AND discount_value = 0)
  );