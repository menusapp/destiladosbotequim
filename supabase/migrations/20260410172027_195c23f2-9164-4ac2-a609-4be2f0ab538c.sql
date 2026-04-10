
-- Make order_id nullable
ALTER TABLE point_order_payments ALTER COLUMN order_id DROP NOT NULL;

-- Drop existing functions to allow return type change
DROP FUNCTION IF EXISTS public.insert_point_order_payment(uuid,uuid,text,text,text,text,text,numeric,text);
DROP FUNCTION IF EXISTS public.update_point_order_payment(text,text,jsonb);

-- Recreate insert RPC
CREATE OR REPLACE FUNCTION public.insert_point_order_payment(
  p_restaurant_id uuid,
  p_order_id uuid DEFAULT NULL,
  p_mp_order_id text DEFAULT '',
  p_mp_user_id text DEFAULT '',
  p_terminal_id text DEFAULT '',
  p_external_reference text DEFAULT '',
  p_idempotency_key text DEFAULT '',
  p_amount numeric DEFAULT 0,
  p_status text DEFAULT 'waiting_terminal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO point_order_payments (
    restaurant_id, order_id, mp_order_id, device_id, amount, status, created_at, updated_at
  ) VALUES (
    p_restaurant_id, p_order_id, p_mp_order_id, p_terminal_id, p_amount, p_status, now(), now()
  );
END;
$$;

-- Recreate update RPC
CREATE OR REPLACE FUNCTION public.update_point_order_payment(
  p_mp_order_id text,
  p_status text,
  p_mp_status_payload jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE point_order_payments
  SET status = p_status, updated_at = now()
  WHERE mp_order_id = p_mp_order_id;
END;
$$;
