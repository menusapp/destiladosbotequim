
CREATE OR REPLACE FUNCTION public.create_kiosk_order(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_cpf text,
  p_order_type text,
  p_delivery_type text,
  p_notes text DEFAULT NULL,
  p_delivery_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_coupon_discount numeric DEFAULT 0,
  p_loyalty_points_used integer DEFAULT 0,
  p_reward_discount numeric DEFAULT 0,
  p_table_number integer DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_table_id uuid;
  v_item jsonb;
  v_extra jsonb;
  v_order_item_id uuid;
BEGIN
  -- Resolve table if needed
  IF p_table_number IS NOT NULL THEN
    SELECT id INTO v_table_id
    FROM tables
    WHERE restaurant_id = p_restaurant_id AND table_number = p_table_number
    LIMIT 1;
    IF v_table_id IS NULL THEN
      RAISE EXCEPTION 'Mesa % não encontrada', p_table_number;
    END IF;
  END IF;

  -- Create the order as pending
  INSERT INTO orders (
    restaurant_id, table_id, customer_name, customer_cpf,
    order_type, delivery_type, order_channel, status, payment_status,
    notes, delivery_phone, delivery_address,
    coupon_code, coupon_discount, loyalty_points_used, reward_discount
  ) VALUES (
    p_restaurant_id, v_table_id, p_customer_name, p_customer_cpf,
    p_order_type, p_delivery_type, 'totem', 'pending', 'pending',
    p_notes, p_delivery_phone, p_delivery_address,
    p_coupon_code, p_coupon_discount, p_loyalty_points_used, p_reward_discount
  )
  RETURNING id INTO v_order_id;

  -- Insert items and their extras
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, quantity, price_at_order, notes
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price_at_order')::numeric,
      v_item->>'notes'
    )
    RETURNING id INTO v_order_item_id;

    -- Insert extras for this item
    IF v_item ? 'extras' AND jsonb_array_length(v_item->'extras') > 0 THEN
      FOR v_extra IN SELECT * FROM jsonb_array_elements(v_item->'extras')
      LOOP
        INSERT INTO order_item_extras (
          order_item_id,
          product_extra_id,
          price_at_order,
          extra_name
        ) VALUES (
          v_order_item_id,
          CASE WHEN (v_extra->>'is_complement')::boolean = true THEN NULL
               ELSE (v_extra->>'product_extra_id')::uuid END,
          (v_extra->>'price_at_order')::numeric,
          v_extra->>'extra_name'
        );
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_order_id;
END;
$$;
