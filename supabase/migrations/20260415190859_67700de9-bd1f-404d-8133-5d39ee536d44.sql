UPDATE product_extras
SET is_required = false
WHERE product_id IN (
  SELECT id FROM products WHERE restaurant_id = 'c9740e47-2c55-4015-9cc8-ab6c7fa9d543'
)
AND is_required = true;