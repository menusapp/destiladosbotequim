
-- 1. Drop old CHECK constraint on bills.payment_method and recreate with broader values
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_payment_method_check;

-- 2. Backfill extra_name for order_item_extras where it's null but product_extra_id is not null
UPDATE public.order_item_extras oie
SET extra_name = pe.name
FROM public.product_extras pe
WHERE oie.product_extra_id = pe.id
  AND oie.extra_name IS NULL
  AND oie.product_extra_id IS NOT NULL;
