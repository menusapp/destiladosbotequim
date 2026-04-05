
-- Repair: set extra_category_id on product_extras that match extra_category_items by name and price
UPDATE product_extras pe
SET extra_category_id = eci.category_id
FROM extra_category_items eci
WHERE pe.name = eci.name
  AND pe.price = eci.price
  AND pe.extra_category_id IS NULL;
