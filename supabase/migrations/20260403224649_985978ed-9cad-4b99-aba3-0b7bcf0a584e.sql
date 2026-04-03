UPDATE public.order_item_extras oie
SET extra_name = pe.name
FROM public.product_extras pe
WHERE oie.product_extra_id = pe.id
AND oie.extra_name IS NULL;