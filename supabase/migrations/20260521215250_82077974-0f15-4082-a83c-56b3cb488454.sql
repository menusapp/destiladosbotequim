-- Add daily sequential order number per restaurant, resets at midnight (America/Sao_Paulo)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS daily_order_number integer;

CREATE INDEX IF NOT EXISTS idx_orders_daily_number
  ON public.orders (restaurant_id, daily_order_number, created_at);

CREATE OR REPLACE FUNCTION public.assign_daily_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date;
  v_next integer;
BEGIN
  IF NEW.daily_order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_day := ((COALESCE(NEW.created_at, now())) AT TIME ZONE 'America/Sao_Paulo')::date;

  -- Serialize concurrent inserts per restaurant+day
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.restaurant_id::text || '|' || v_day::text, 0)
  );

  SELECT COALESCE(MAX(daily_order_number), 0) + 1
    INTO v_next
    FROM public.orders
   WHERE restaurant_id = NEW.restaurant_id
     AND ((created_at AT TIME ZONE 'America/Sao_Paulo')::date) = v_day;

  NEW.daily_order_number := v_next;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_daily_order_number ON public.orders;
CREATE TRIGGER trg_assign_daily_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_daily_order_number();

-- Backfill existing rows so old receipts also have a number
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY restaurant_id,
                        ((created_at AT TIME ZONE 'America/Sao_Paulo')::date)
           ORDER BY created_at, id
         ) AS rn
    FROM public.orders
   WHERE daily_order_number IS NULL
)
UPDATE public.orders o
   SET daily_order_number = n.rn
  FROM numbered n
 WHERE o.id = n.id;