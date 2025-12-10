CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'ceo',
    'restaurant_admin',
    'user'
);


--
-- Name: add_delivery_order_to_cash_register(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_delivery_order_to_cash_register() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_order_subtotal numeric;
  v_service_fee numeric;
  v_delivery_fee numeric;
  v_order_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_existing_movement_id uuid;
BEGIN
  -- Só processar quando status mudar para 'delivered' ou 'picked_up' e for pedido DELIVERY
  IF (NEW.status = 'delivered' OR NEW.status = 'picked_up')
     AND (OLD.status != 'delivered' AND OLD.status != 'picked_up')
     AND NEW.order_type = 'delivery' THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    -- Buscar configurações do restaurante
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants
    WHERE id = v_restaurant_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se não houver caixa aberto, não registrar
    IF v_cash_session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe movimento para este pedido
    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE cash_session_id = v_cash_session_id
      AND description LIKE 'Pedido Delivery #' || NEW.id::text || '%'
    LIMIT 1;
    
    -- Se já existe, não criar duplicado
    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calcular subtotal do pedido
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) 
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id), 0)), 0)
    INTO v_order_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Aplicar taxa de serviço se habilitada
    IF v_service_fee_enabled THEN
      v_service_fee := v_order_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    -- Taxa de entrega (apenas para delivery, não para pickup)
    IF NEW.delivery_type = 'delivery' THEN
      v_delivery_fee := COALESCE(NEW.delivery_fee, 0);
    ELSE
      v_delivery_fee := 0;
    END IF;
    
    -- Desconto de cupom e pontos de fidelidade
    v_order_total := v_order_subtotal + v_service_fee + v_delivery_fee 
                     - COALESCE(NEW.coupon_discount, 0) 
                     - COALESCE((NEW.loyalty_points_used * 0.01), 0);
    
    -- Registrar movimento no caixa com payment_method do pedido
    INSERT INTO cash_movements (
      cash_session_id,
      restaurant_id,
      movement_type,
      amount,
      payment_method,
      category,
      description,
      created_by
    ) VALUES (
      v_cash_session_id,
      v_restaurant_id,
      'entrada',
      v_order_total,
      COALESCE(NEW.payment_type, 'pending'),
      'Delivery',
      'Pedido Delivery #' || NEW.id || ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
      ' (' || CASE WHEN NEW.delivery_type = 'pickup' THEN 'Retirada' ELSE 'Entrega' END || ')' ||
      ' - Subtotal: R$ ' || ROUND(v_order_subtotal, 2) || 
      CASE WHEN v_service_fee > 0 THEN ' + Taxa Serviço: R$ ' || ROUND(v_service_fee, 2) ELSE '' END ||
      CASE WHEN v_delivery_fee > 0 THEN ' + Taxa Entrega: R$ ' || ROUND(v_delivery_fee, 2) ELSE '' END ||
      CASE WHEN NEW.coupon_discount > 0 THEN ' - Cupom: R$ ' || ROUND(NEW.coupon_discount, 2) ELSE '' END,
      'Sistema'
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: add_local_order_to_cash_register(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_local_order_to_cash_register() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_restaurant_id uuid;
  v_cash_session_id uuid;
  v_bill_subtotal numeric;
  v_service_fee numeric;
  v_bill_total numeric;
  v_service_fee_enabled boolean;
  v_service_fee_percentage numeric;
  v_existing_movement_id uuid;
  v_table_number integer;
BEGIN
  -- Só processar quando status mudar para 'accepted' e for pedido LOCAL
  IF NEW.status = 'accepted' 
     AND (OLD.status IS NULL OR OLD.status != 'accepted')
     AND (NEW.order_type IS NULL OR NEW.order_type = 'local')
     AND NEW.table_id IS NOT NULL THEN
    
    v_restaurant_id := NEW.restaurant_id;
    
    -- Buscar configurações do restaurante
    SELECT service_fee_enabled, service_fee_percentage
    INTO v_service_fee_enabled, v_service_fee_percentage
    FROM restaurants
    WHERE id = v_restaurant_id;
    
    -- Buscar sessão de caixa aberta
    SELECT id INTO v_cash_session_id
    FROM cash_register_sessions
    WHERE restaurant_id = v_restaurant_id
      AND status = 'open'
    ORDER BY opened_at DESC
    LIMIT 1;
    
    -- Se não houver caixa aberto, não registrar
    IF v_cash_session_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Verificar se já existe movimento para este pedido
    SELECT id INTO v_existing_movement_id
    FROM cash_movements
    WHERE cash_session_id = v_cash_session_id
      AND description LIKE 'Pedido Local #' || NEW.id::text || '%'
    LIMIT 1;
    
    -- Se já existe, não criar duplicado
    IF v_existing_movement_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calcular total do pedido
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity + 
      COALESCE((SELECT SUM(oie.price_at_order) 
                FROM order_item_extras oie 
                WHERE oie.order_item_id = oi.id), 0)), 0)
    INTO v_bill_subtotal
    FROM order_items oi
    WHERE oi.order_id = NEW.id;
    
    -- Aplicar taxa de serviço se habilitada
    IF v_service_fee_enabled THEN
      v_service_fee := v_bill_subtotal * (v_service_fee_percentage / 100);
    ELSE
      v_service_fee := 0;
    END IF;
    
    v_bill_total := v_bill_subtotal + v_service_fee;
    
    -- Buscar número da mesa
    SELECT table_number INTO v_table_number
    FROM tables
    WHERE id = NEW.table_id;
    
    -- Registrar movimento no caixa com payment_method = 'pending'
    INSERT INTO cash_movements (
      cash_session_id,
      restaurant_id,
      movement_type,
      amount,
      payment_method,
      category,
      description,
      created_by
    ) VALUES (
      v_cash_session_id,
      v_restaurant_id,
      'entrada',
      v_bill_total,
      'pending',
      'Pedido',
      'Pedido Local #' || NEW.id || ' - Mesa ' || COALESCE(v_table_number::text, '?') || 
      ' - ' || COALESCE(NEW.customer_name, 'Cliente') || 
      ' (Subtotal: R$ ' || ROUND(v_bill_subtotal, 2) || 
      CASE WHEN v_service_fee > 0 THEN ' + Taxa: R$ ' || ROUND(v_service_fee, 2) ELSE '' END || ')',
      'Sistema'
    );
  END IF;
  
  RETURN NEW;
END;
$_$;


--
-- Name: admin_delete_bill(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_bill(p_bill_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Verifica se a conta pertence ao restaurante
  SELECT b.table_id INTO v_table_id
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to delete this bill';
  END IF;

  -- Remove referências em cash_movements
  UPDATE cash_movements
  SET bill_id = NULL
  WHERE bill_id = p_bill_id;

  -- Exclui a conta
  DELETE FROM bills WHERE id = p_bill_id;
END;
$$;


--
-- Name: admin_delete_bill_and_orders(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_bill_and_orders(p_bill_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id UUID;
BEGIN
  -- Buscar table_id da conta
  SELECT table_id INTO v_table_id
  FROM bills
  WHERE id = p_bill_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  -- Verificar se a mesa pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE id = v_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Deletar todos os extras dos itens dos pedidos da mesa
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT oi.id 
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.table_id = v_table_id
  );

  -- Deletar todos os itens dos pedidos da mesa
  DELETE FROM order_items
  WHERE order_id IN (
    SELECT id FROM orders WHERE table_id = v_table_id
  );

  -- Deletar todos os pedidos da mesa
  DELETE FROM orders WHERE table_id = v_table_id;

  -- Deletar a conta
  DELETE FROM bills WHERE id = p_bill_id;

  -- Liberar a mesa
  UPDATE tables
  SET is_occupied = false, occupied_by = NULL, occupied_at = NULL
  WHERE id = v_table_id;
END;
$$;


--
-- Name: admin_delete_category(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_category(p_category_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_exists boolean;
  v_product RECORD;
BEGIN
  -- Verify category belongs to restaurant
  SELECT true INTO v_exists
  FROM categories c
  WHERE c.id = p_category_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this category';
  END IF;

  -- Delete all products in this category using the product delete function
  FOR v_product IN
    SELECT id FROM products WHERE category_id = p_category_id
  LOOP
    PERFORM public.admin_delete_product(v_product.id, p_restaurant_id);
  END LOOP;

  -- Delete the category itself
  DELETE FROM categories WHERE id = p_category_id;
END;
$$;


--
-- Name: admin_delete_order(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_order(p_order_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id uuid;
  v_remaining_orders integer;
  v_unpaid_bills integer;
BEGIN
  -- Verificar se o pedido pertence ao restaurante e pegar table_id
  SELECT o.table_id INTO v_table_id
  FROM orders o
  WHERE o.id = p_order_id AND o.restaurant_id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this order';
  END IF;

  -- Excluir extras dos itens do pedido
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE order_id = p_order_id
  );

  -- Excluir itens do pedido
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Remover movimentações de caixa relacionadas ao pedido
  DELETE FROM cash_movements
  WHERE description LIKE 'Pedido #' || p_order_id::text || '%';

  -- Excluir o pedido
  DELETE FROM orders WHERE id = p_order_id;

  -- Só verificar e liberar mesa se houver table_id (pedidos locais)
  IF v_table_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_remaining_orders
    FROM orders
    WHERE table_id = v_table_id;

    SELECT COUNT(*) INTO v_unpaid_bills
    FROM bills
    WHERE table_id = v_table_id AND status != 'paid';

    IF v_remaining_orders = 0 AND v_unpaid_bills = 0 THEN
      UPDATE tables
      SET 
        is_occupied = false,
        occupied_at = NULL,
        occupied_by = NULL
      WHERE id = v_table_id;
    END IF;
  END IF;
END;
$$;


--
-- Name: admin_delete_order_and_bill(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_order_and_bill(p_order_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id UUID;
  v_bill_id UUID;
BEGIN
  -- Buscar table_id do pedido
  SELECT table_id INTO v_table_id
  FROM orders
  WHERE id = p_order_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  -- Verificar se a mesa pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM tables 
    WHERE id = v_table_id AND restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Buscar conta associada à mesa
  SELECT id INTO v_bill_id
  FROM bills
  WHERE table_id = v_table_id
  LIMIT 1;

  -- Deletar extras dos itens do pedido
  DELETE FROM order_item_extras
  WHERE order_item_id IN (
    SELECT id FROM order_items WHERE order_id = p_order_id
  );

  -- Deletar itens do pedido
  DELETE FROM order_items WHERE order_id = p_order_id;

  -- Deletar o pedido
  DELETE FROM orders WHERE id = p_order_id;

  -- Se existe conta, deletá-la também
  IF v_bill_id IS NOT NULL THEN
    DELETE FROM bills WHERE id = v_bill_id;
  END IF;

  -- Liberar a mesa
  UPDATE tables
  SET is_occupied = false, occupied_by = NULL, occupied_at = NULL
  WHERE id = v_table_id;
END;
$$;


--
-- Name: admin_delete_product(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_product(p_product_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify product belongs to restaurant
  SELECT true INTO v_exists
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.id = p_product_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this product';
  END IF;

  -- Delete extra ingredients linked to product extras
  DELETE FROM product_extra_ingredients pei
  USING product_extras pe
  WHERE pei.product_extra_id = pe.id
    AND pe.product_id = p_product_id;

  -- Delete product extras
  DELETE FROM product_extras
  WHERE product_id = p_product_id;

  -- Delete product ingredients
  DELETE FROM product_ingredients
  WHERE product_id = p_product_id;

  -- Finally delete product
  DELETE FROM products WHERE id = p_product_id;
END;
$$;


--
-- Name: admin_delete_product_extra(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_product_extra(p_product_extra_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify extra belongs to restaurant through product -> category -> restaurant
  SELECT true INTO v_exists
  FROM product_extras pe
  JOIN products p ON p.id = pe.product_id
  JOIN categories c ON c.id = p.category_id
  WHERE pe.id = p_product_extra_id AND c.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this extra';
  END IF;

  -- Delete ingredients of the extra
  DELETE FROM product_extra_ingredients WHERE product_extra_id = p_product_extra_id;

  -- Delete the extra
  DELETE FROM product_extras WHERE id = p_product_extra_id;
END;
$$;


--
-- Name: admin_delete_stock_item(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_delete_stock_item(p_stock_item_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify stock item belongs to restaurant
  SELECT true INTO v_exists
  FROM stock_items si
  WHERE si.id = p_stock_item_id AND si.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to delete this stock item';
  END IF;

  -- Remove links from products and extras that use this stock item
  DELETE FROM product_ingredients WHERE stock_item_id = p_stock_item_id;
  DELETE FROM product_extra_ingredients WHERE stock_item_id = p_stock_item_id;

  -- Finally delete stock item
  DELETE FROM stock_items WHERE id = p_stock_item_id;
END;
$$;


--
-- Name: admin_mark_bill_on_the_way(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_bill_on_the_way(p_bill_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Verifica se a conta pertence ao restaurante
  IF NOT EXISTS (
    SELECT 1 FROM bills b
    JOIN tables t ON t.id = b.table_id
    WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to update this bill';
  END IF;

  UPDATE bills SET status = 'on_the_way' WHERE id = p_bill_id;
END;
$$;


--
-- Name: admin_mark_bill_paid(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_mark_bill_paid(p_bill_id uuid, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id UUID;
  v_payment_method text;
  v_bill_total numeric;
BEGIN
  -- Buscar dados da conta
  SELECT b.table_id, b.payment_method, b.total_amount
  INTO v_table_id, v_payment_method, v_bill_total
  FROM bills b
  JOIN tables t ON t.id = b.table_id
  WHERE b.id = p_bill_id AND t.restaurant_id = p_restaurant_id;

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada ou sem permissão';
  END IF;

  -- 1. Marcar conta como paga
  UPDATE bills 
  SET status = 'paid', paid_at = NOW()
  WHERE id = p_bill_id;

  -- 2. Atualizar movimentos de caixa relacionados aos pedidos desta mesa
  UPDATE cash_movements m
  SET 
    payment_method = COALESCE(v_payment_method, 'cash'),
    bill_id = p_bill_id
  WHERE m.restaurant_id = p_restaurant_id
    AND m.category = 'Pedido'
    AND (m.payment_method IS NULL OR m.payment_method = 'pending')
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id::text = SUBSTRING(m.description FROM 'Pedido (?:Local )?#([0-9a-f-]{36})')
        AND o.table_id = v_table_id
    );

  -- 3. Verificar se ainda há contas não pagas nesta mesa
  IF NOT EXISTS (
    SELECT 1 FROM bills 
    WHERE table_id = v_table_id 
    AND status != 'paid'
  ) THEN
    -- 4. Liberar a mesa automaticamente
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;

END;
$$;


--
-- Name: admin_update_order_status(uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_order_status(p_order_id uuid, p_new_status text, p_restaurant_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verificar direto via restaurant_id
  SELECT TRUE INTO v_exists
  FROM orders o
  WHERE o.id = p_order_id AND o.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to update this order';
  END IF;

  UPDATE orders SET status = p_new_status WHERE id = p_order_id;
END;
$$;


--
-- Name: admin_update_restaurant_settings(uuid, text, boolean, numeric, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_update_restaurant_settings(p_restaurant_id uuid, p_primary_color text, p_service_fee_enabled boolean, p_service_fee_percentage numeric, p_prep_time_minutes integer, p_target_cmv_percentage numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.restaurants
  SET
    primary_color = COALESCE(p_primary_color, primary_color),
    service_fee_enabled = COALESCE(p_service_fee_enabled, service_fee_enabled),
    service_fee_percentage = COALESCE(p_service_fee_percentage, service_fee_percentage),
    prep_time_minutes = COALESCE(p_prep_time_minutes, prep_time_minutes),
    target_cmv_percentage = COALESCE(p_target_cmv_percentage, target_cmv_percentage),
    updated_at = now()
  WHERE id = p_restaurant_id;
END;
$$;


--
-- Name: auto_release_idle_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_release_idle_tables() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Liberar mesas que estão ocupadas há mais de 1 hora
  -- e que não têm pedidos confirmados nem contas pendentes/a caminho
  UPDATE tables
  SET 
    is_occupied = false,
    occupied_by = NULL,
    occupied_at = NULL
  WHERE 
    is_occupied = true
    AND occupied_at < NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.table_id = tables.id 
      AND orders.status IN ('pending', 'accepted', 'preparing', 'ready')
    )
    AND NOT EXISTS (
      SELECT 1 FROM bills 
      WHERE bills.table_id = tables.id 
      AND bills.status IN ('pending', 'on_the_way')
    );
END;
$$;


--
-- Name: auto_release_inactive_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_release_inactive_tables() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Liberar mesas que:
  -- 1. Estão ocupadas
  -- 2. Foram ocupadas há mais de 1 hora
  -- 3. NÃO têm NENHUM pedido associado
  UPDATE tables t
  SET 
    is_occupied = false,
    occupied_at = NULL,
    occupied_by = NULL
  WHERE 
    t.is_occupied = true
    AND t.occupied_at < NOW() - INTERVAL '1 hour'
    AND NOT EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.table_id = t.id
    );
END;
$$;


--
-- Name: check_product_availability(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_product_availability(p_product_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM product_ingredients pi
    JOIN stock_items si ON si.id = pi.stock_item_id
    WHERE pi.product_id = p_product_id
      AND si.current_quantity <= 0
  );
$$;


--
-- Name: check_table_release(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_table_release() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id uuid;
  v_unpaid_bills integer;
  v_active_orders integer;
BEGIN
  v_table_id := NEW.table_id;
  
  -- Só processar se houver table_id (pedidos locais)
  IF v_table_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_unpaid_bills
    FROM bills
    WHERE table_id = v_table_id
      AND status != 'paid';
    
    SELECT COUNT(*) INTO v_active_orders
    FROM orders
    WHERE table_id = v_table_id
      AND status IN ('pending', 'accepted', 'preparing', 'ready');
    
    IF v_unpaid_bills = 0 AND v_active_orders = 0 THEN
      UPDATE tables
      SET 
        is_occupied = false,
        occupied_at = NULL,
        occupied_by = NULL
      WHERE id = v_table_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: check_table_release_on_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_table_release_on_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_table_id uuid;
  v_unpaid_bills integer;
BEGIN
  v_table_id := OLD.table_id;
  
  -- Verifica se ainda há contas não pagas
  SELECT COUNT(*) INTO v_unpaid_bills
  FROM bills
  WHERE table_id = v_table_id
    AND status != 'paid';
  
  -- Se não há contas não pagas, libera a mesa
  IF v_unpaid_bills = 0 THEN
    UPDATE tables
    SET 
      is_occupied = false,
      occupied_at = NULL,
      occupied_by = NULL
    WHERE id = v_table_id;
  END IF;
  
  RETURN OLD;
END;
$$;


--
-- Name: cleanup_abandoned_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_abandoned_tables() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Liberar mesas que:
  -- 1. Estão ocupadas
  -- 2. Não têm contas não pagas
  -- 3. Não têm pedidos ativos (pending, accepted, preparing, ready)
  UPDATE tables t
  SET 
    is_occupied = false,
    occupied_at = NULL,
    occupied_by = NULL
  WHERE 
    t.is_occupied = true
    AND NOT EXISTS (
      SELECT 1 FROM bills b 
      WHERE b.table_id = t.id 
      AND b.status != 'paid'
    )
    AND NOT EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.table_id = t.id 
      AND o.status IN ('pending', 'accepted', 'preparing', 'ready')
    );
END;
$$;


--
-- Name: get_restaurant_rating_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_restaurant_rating_stats(p_restaurant_id uuid) RETURNS TABLE(average_rating numeric, total_reviews bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0) as average_rating,
    COUNT(*) as total_reviews
  FROM public.restaurant_reviews
  WHERE restaurant_id = p_restaurant_id;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Create default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: is_restaurant_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_restaurant_admin(_user_id uuid, _restaurant_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'restaurant_admin'
      AND restaurant_id = _restaurant_id
  )
$$;


--
-- Name: is_restaurant_closed_by_order_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_restaurant_closed_by_order_item(_order_item_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(not r.is_open, false)
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.tables t on t.id = o.table_id
  join public.restaurants r on r.id = t.restaurant_id
  where oi.id = _order_item_id
  limit 1;
$$;


--
-- Name: mark_table_occupied(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_table_occupied() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Não fazer nada se a mesa já estiver ocupada
  -- (pois ela foi marcada quando o cliente acessou o cardápio)
  RETURN NEW;
END;
$$;


--
-- Name: process_counter_order_finalization(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_counter_order_finalization() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_cost_total NUMERIC := 0;
BEGIN
  -- Se o pedido foi finalizado (status mudou para 'paid' e finalized_at foi setado)
  IF NEW.status = 'paid' AND NEW.finalized_at IS NOT NULL 
     AND (OLD.finalized_at IS NULL OR OLD.status != 'paid') THEN
    
    -- Processar cada item do pedido
    FOR v_order_item IN 
      SELECT coi.id, coi.quantity, coi.product_id
      FROM counter_order_items coi
      WHERE coi.counter_order_id = NEW.id
    LOOP
      -- Calcular e armazenar custo snapshot do item
      SELECT COALESCE(SUM(pi.quantity * si.price_per_unit), 0) INTO v_cost_total
      FROM product_ingredients pi
      JOIN stock_items si ON si.id = pi.stock_item_id
      WHERE pi.product_id = v_order_item.product_id;
      
      UPDATE counter_order_items
      SET cost_snapshot = v_cost_total * v_order_item.quantity
      WHERE id = v_order_item.id;
      
      -- Dar baixa nos ingredientes do produto
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity
        FROM product_ingredients pi
        WHERE pi.product_id = v_order_item.product_id
      LOOP
        -- Atualizar quantidade em estoque
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_ingredient.stock_item_id;
        
        -- Registrar movimentação
        INSERT INTO stock_movements (
          stock_item_id,
          quantity,
          movement_type,
          reason
        ) VALUES (
          v_ingredient.stock_item_id,
          v_ingredient.quantity * v_order_item.quantity,
          'saida',
          'Venda Balcão - Pedido #' || NEW.id
        );
      END LOOP;
      
      -- Dar baixa nos ingredientes dos adicionais
      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM counter_order_item_extras coie
        JOIN product_extras pe ON pe.id = coie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE coie.counter_order_item_id = v_order_item.id
      LOOP
        -- Atualizar quantidade em estoque
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_extra_ingredient.stock_item_id;
        
        -- Registrar movimentação
        INSERT INTO stock_movements (
          stock_item_id,
          quantity,
          movement_type,
          reason
        ) VALUES (
          v_extra_ingredient.stock_item_id,
          v_extra_ingredient.quantity * v_order_item.quantity,
          'saida',
          'Venda Balcão (adicional) - Pedido #' || NEW.id
        );
      END LOOP;
    END LOOP;
    
    -- Registrar no caixa se houver sessão aberta
    DECLARE
      v_cash_session_id UUID;
    BEGIN
      SELECT id INTO v_cash_session_id
      FROM cash_register_sessions
      WHERE restaurant_id = NEW.restaurant_id
        AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
      
      IF v_cash_session_id IS NOT NULL THEN
        INSERT INTO cash_movements (
          cash_session_id,
          restaurant_id,
          movement_type,
          amount,
          payment_method,
          category,
          description,
          created_by
        ) VALUES (
          v_cash_session_id,
          NEW.restaurant_id,
          'entrada',
          NEW.total_amount,
          COALESCE(NEW.payment_method, 'cash'),
          'Balcão',
          'Pedido Balcão #' || NEW.id || ' - ' || NEW.customer_name,
          NEW.created_by
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: process_order_stock_movement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_order_stock_movement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_order_item RECORD;
  v_ingredient RECORD;
  v_extra_ingredient RECORD;
  v_restaurant_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Usar restaurant_id direto da ordem
    v_restaurant_id := NEW.restaurant_id;
    
    FOR v_order_item IN 
      SELECT oi.id, oi.quantity, oi.product_id
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      FOR v_ingredient IN
        SELECT pi.stock_item_id, pi.quantity
        FROM product_ingredients pi
        WHERE pi.product_id = v_order_item.product_id
      LOOP
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_ingredient.stock_item_id;
        
        INSERT INTO stock_movements (
          stock_item_id,
          quantity,
          movement_type,
          order_id,
          reason
        ) VALUES (
          v_ingredient.stock_item_id,
          v_ingredient.quantity * v_order_item.quantity,
          'saida',
          NEW.id,
          'Venda - Pedido #' || NEW.id
        );
      END LOOP;
      
      FOR v_extra_ingredient IN
        SELECT pei.stock_item_id, pei.quantity
        FROM order_item_extras oie
        JOIN product_extras pe ON pe.id = oie.product_extra_id
        JOIN product_extra_ingredients pei ON pei.product_extra_id = pe.id
        WHERE oie.order_item_id = v_order_item.id
      LOOP
        UPDATE stock_items
        SET current_quantity = current_quantity - (v_extra_ingredient.quantity * v_order_item.quantity)
        WHERE id = v_extra_ingredient.stock_item_id;
        
        INSERT INTO stock_movements (
          stock_item_id,
          quantity,
          movement_type,
          order_id,
          reason
        ) VALUES (
          v_extra_ingredient.stock_item_id,
          v_extra_ingredient.quantity * v_order_item.quantity,
          'saida',
          NEW.id,
          'Venda (adicional) - Pedido #' || NEW.id
        );
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: revert_counter_order_deletion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_counter_order_deletion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se o pedido estava finalizado, reverter estoque
  IF OLD.status = 'paid' AND OLD.finalized_at IS NOT NULL THEN
    FOR v_movement IN
      SELECT stock_item_id, quantity
      FROM stock_movements
      WHERE reason LIKE 'Venda Balcão%Pedido #' || OLD.id || '%'
        AND movement_type = 'saida'
    LOOP
      -- Repor quantidade em estoque
      UPDATE stock_items
      SET current_quantity = current_quantity + v_movement.quantity
      WHERE id = v_movement.stock_item_id;
      
      -- Registrar movimentação de reposição
      INSERT INTO stock_movements (
        stock_item_id,
        quantity,
        movement_type,
        reason
      ) VALUES (
        v_movement.stock_item_id,
        v_movement.quantity,
        'entrada',
        'Estorno Balcão - Pedido #' || OLD.id
      );
    END LOOP;
    
    -- Remover movimento de caixa
    DELETE FROM cash_movements
    WHERE description LIKE 'Pedido Balcão #' || OLD.id || '%';
  END IF;
  
  RETURN OLD;
END;
$$;


--
-- Name: revert_order_stock_movement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_order_stock_movement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se um pedido for deletado, repor o estoque
  FOR v_movement IN
    SELECT stock_item_id, quantity
    FROM stock_movements
    WHERE order_id = OLD.id AND movement_type = 'saida'
  LOOP
    -- Repor quantidade em estoque
    UPDATE stock_items
    SET current_quantity = current_quantity + v_movement.quantity
    WHERE id = v_movement.stock_item_id;
    
    -- Registrar movimentação de reposição
    INSERT INTO stock_movements (
      stock_item_id,
      quantity,
      movement_type,
      order_id,
      reason
    ) VALUES (
      v_movement.stock_item_id,
      v_movement.quantity,
      'entrada',
      OLD.id,
      'Cancelamento - Pedido #' || OLD.id
    );
  END LOOP;
  
  RETURN OLD;
END;
$$;


--
-- Name: revert_stock_on_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_stock_on_cancel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_movement RECORD;
BEGIN
  -- Se o status mudou para cancelled e antes estava em um status que já deu baixa no estoque
  IF NEW.status = 'cancelled' 
     AND OLD.status IN ('accepted', 'preparing', 'ready', 'out_for_delivery') THEN
    
    -- Buscar todas as movimentações de saída deste pedido
    FOR v_movement IN
      SELECT stock_item_id, quantity
      FROM stock_movements
      WHERE order_id = OLD.id 
        AND movement_type = 'saida'
    LOOP
      -- Repor quantidade em estoque
      UPDATE stock_items
      SET current_quantity = current_quantity + v_movement.quantity
      WHERE id = v_movement.stock_item_id;
      
      -- Registrar movimentação de reposição
      INSERT INTO stock_movements (
        stock_item_id,
        quantity,
        movement_type,
        order_id,
        reason
      ) VALUES (
        v_movement.stock_item_id,
        v_movement.quantity,
        'entrada',
        OLD.id,
        'Cancelamento - Pedido #' || OLD.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_cash_movement_payment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cash_movement_payment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Quando uma conta for paga, atualizar a movimentação correspondente
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    UPDATE cash_movements
    SET payment_method = NEW.payment_method
    WHERE bill_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_coupons_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_coupons_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_restaurant_credentials(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_restaurant_credentials(p_username text, p_password text) RETURNS TABLE(restaurant_id uuid, restaurant_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT rc.restaurant_id, r.name
  FROM public.restaurant_credentials rc
  JOIN public.restaurants r ON r.id = rc.restaurant_id
  WHERE rc.username = p_username
    AND rc.password_hash = p_password
  LIMIT 1;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version text NOT NULL,
    release_notes text,
    download_url_windows text,
    download_url_mac text,
    download_url_linux text,
    is_current boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    service_fee numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    payment_method text,
    change_amount numeric(10,2),
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    CONSTRAINT bills_payment_method_check CHECK ((payment_method = ANY (ARRAY['pix'::text, 'card'::text, 'cash'::text]))),
    CONSTRAINT bills_status_check CHECK ((status = ANY (ARRAY['active'::text, 'requested'::text, 'on_the_way'::text, 'paid'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.bills REPLICA IDENTITY FULL;


--
-- Name: card_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    card_brand text NOT NULL,
    fee_percentage numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: card_fees_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.card_fees_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    debit_fee numeric DEFAULT 0 NOT NULL,
    credit_fee numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cash_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cash_session_id uuid NOT NULL,
    restaurant_id uuid NOT NULL,
    movement_type text NOT NULL,
    amount numeric NOT NULL,
    description text NOT NULL,
    category text,
    payment_method text,
    bill_id uuid,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cash_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['income'::text, 'expense'::text, 'entrada'::text, 'saida'::text, 'in'::text, 'out'::text])))
);


--
-- Name: cash_register_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_register_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    opened_by text NOT NULL,
    closed_by text,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    opening_balance numeric DEFAULT 0 NOT NULL,
    closing_balance numeric,
    expected_balance numeric,
    difference numeric,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cash_register_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.categories REPLICA IDENTITY FULL;


--
-- Name: comandas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comandas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_cpf text NOT NULL,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT comandas_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: counter_order_item_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counter_order_item_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    counter_order_item_id uuid NOT NULL,
    product_extra_id uuid,
    price_at_order numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: counter_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counter_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    counter_order_id uuid NOT NULL,
    product_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    price_at_order numeric NOT NULL,
    cost_snapshot numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: counter_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counter_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_cpf text,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    subtotal numeric DEFAULT 0 NOT NULL,
    fee_type text,
    fee_value numeric DEFAULT 0,
    fee_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    finalized_at timestamp with time zone,
    created_by text NOT NULL,
    notes text,
    CONSTRAINT counter_orders_fee_type_check CHECK ((fee_type = ANY (ARRAY['fixed'::text, 'percentage'::text]))),
    CONSTRAINT counter_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text])))
);

ALTER TABLE ONLY public.counter_orders REPLICA IDENTITY FULL;


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    code text NOT NULL,
    discount_type text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_value numeric DEFAULT 0,
    max_discount numeric,
    is_active boolean DEFAULT true,
    usage_limit integer,
    used_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric)),
    CONSTRAINT coupons_max_discount_check CHECK (((max_discount IS NULL) OR (max_discount > (0)::numeric))),
    CONSTRAINT coupons_min_order_value_check CHECK ((min_order_value >= (0)::numeric)),
    CONSTRAINT coupons_usage_limit_check CHECK (((usage_limit IS NULL) OR (usage_limit > 0))),
    CONSTRAINT coupons_used_count_check CHECK ((used_count >= 0))
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_cpf text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    street text NOT NULL,
    number text NOT NULL,
    complement text,
    neighborhood text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    zip_code text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: delivery_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    min_order_value numeric DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    estimated_time_minutes integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    store_address text
);


--
-- Name: extra_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extra_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    restaurant_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: extra_category_item_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extra_category_item_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_item_id uuid NOT NULL,
    stock_item_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: extra_category_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extra_category_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: fixed_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: labor_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labor_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    employee_name text NOT NULL,
    role text,
    salary numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_cpf text NOT NULL,
    restaurant_id uuid NOT NULL,
    points_balance integer DEFAULT 0,
    total_earned integer DEFAULT 0,
    total_redeemed integer DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT loyalty_points_points_balance_check CHECK ((points_balance >= 0)),
    CONSTRAINT loyalty_points_total_earned_check CHECK ((total_earned >= 0)),
    CONSTRAINT loyalty_points_total_redeemed_check CHECK ((total_redeemed >= 0))
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_cpf text NOT NULL,
    restaurant_id uuid NOT NULL,
    order_id uuid,
    points integer NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT loyalty_transactions_type_check CHECK ((type = ANY (ARRAY['earn'::text, 'redeem'::text])))
);


--
-- Name: operational_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    month_year text NOT NULL,
    fixed_cost numeric DEFAULT 0 NOT NULL,
    variable_cost numeric DEFAULT 0 NOT NULL,
    variable_cost_type text DEFAULT 'fixed'::text NOT NULL,
    labor_cost numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_item_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    product_extra_id uuid,
    price_at_order numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    price_at_order numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_id uuid,
    customer_name text NOT NULL,
    customer_cpf text NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    notes text,
    order_type text DEFAULT 'local'::text,
    delivery_address text,
    delivery_phone text,
    delivery_neighborhood text,
    delivery_city text,
    payment_type text,
    coupon_code text,
    coupon_discount numeric DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    loyalty_points_used integer DEFAULT 0,
    loyalty_points_earned integer DEFAULT 0,
    restaurant_id uuid NOT NULL,
    delivery_type text DEFAULT 'delivery'::text,
    comanda_id uuid,
    CONSTRAINT orders_order_type_check CHECK ((order_type = ANY (ARRAY['local'::text, 'delivery'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'preparing'::text, 'ready'::text, 'out_for_delivery'::text, 'delivered'::text, 'picked_up'::text, 'cancelled'::text])))
);


--
-- Name: product_extra_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_extra_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_extra_id uuid NOT NULL,
    stock_item_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    stock_item_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    prep_time_minutes integer DEFAULT 30,
    is_featured boolean DEFAULT false,
    featured_display_order integer DEFAULT 0
);

ALTER TABLE ONLY public.products REPLICA IDENTITY FULL;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cpf text
);


--
-- Name: restaurant_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: restaurant_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    order_id uuid,
    counter_order_id uuid,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bill_id uuid,
    CONSTRAINT restaurant_reviews_has_reference CHECK (((order_id IS NOT NULL) OR (counter_order_id IS NOT NULL) OR (bill_id IS NOT NULL))),
    CONSTRAINT restaurant_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    primary_color text DEFAULT '#FF6B35'::text,
    secondary_color text DEFAULT '#1A1A1A'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_open boolean DEFAULT true,
    service_fee_enabled boolean DEFAULT false,
    service_fee_percentage numeric DEFAULT 10,
    prep_time_minutes integer DEFAULT 30,
    target_cmv_percentage numeric DEFAULT 30,
    banner_url text,
    rating numeric DEFAULT 4.8,
    review_count integer DEFAULT 12,
    featured_section_enabled boolean DEFAULT true,
    featured_section_title text DEFAULT 'Destaques'::text,
    loyalty_enabled boolean DEFAULT false,
    loyalty_points_per_real numeric DEFAULT 1,
    loyalty_real_per_point numeric DEFAULT 0.01,
    pickup_time_minutes integer DEFAULT 15,
    CONSTRAINT restaurants_target_cmv_percentage_check CHECK (((target_cmv_percentage >= (0)::numeric) AND (target_cmv_percentage <= (100)::numeric)))
);

ALTER TABLE ONLY public.restaurants REPLICA IDENTITY FULL;


--
-- Name: stock_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: stock_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    unit text NOT NULL,
    price_per_unit numeric DEFAULT 0 NOT NULL,
    current_quantity numeric DEFAULT 0 NOT NULL,
    minimum_quantity numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.stock_items REPLICA IDENTITY FULL;


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stock_item_id uuid NOT NULL,
    order_id uuid,
    movement_type text NOT NULL,
    quantity numeric NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: tables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    table_number integer NOT NULL,
    qr_code text,
    created_at timestamp with time zone DEFAULT now(),
    is_occupied boolean DEFAULT false,
    occupied_at timestamp with time zone,
    occupied_by text
);

ALTER TABLE ONLY public.tables REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    restaurant_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: variable_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variable_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    amount numeric,
    percentage numeric,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT variable_costs_type_check CHECK ((type = ANY (ARRAY['fixed'::text, 'percentage'::text])))
);


--
-- Name: whatsapp_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    restaurant_id uuid NOT NULL,
    enabled boolean DEFAULT false,
    api_token text,
    phone_number text,
    message_accepted text DEFAULT 'Seu pedido foi aceito e está em preparo! 🍔'::text,
    message_out_for_delivery text DEFAULT 'Seu pedido saiu para entrega! 🚚'::text,
    message_delivered text DEFAULT 'Seu pedido foi entregue! Obrigado pela preferência! 🙏'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: app_versions app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_pkey PRIMARY KEY (id);


--
-- Name: app_versions app_versions_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_version_key UNIQUE (version);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: card_fees_config card_fees_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees_config
    ADD CONSTRAINT card_fees_config_pkey PRIMARY KEY (id);


--
-- Name: card_fees_config card_fees_config_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees_config
    ADD CONSTRAINT card_fees_config_restaurant_id_key UNIQUE (restaurant_id);


--
-- Name: card_fees card_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees
    ADD CONSTRAINT card_fees_pkey PRIMARY KEY (id);


--
-- Name: card_fees card_fees_restaurant_id_card_brand_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees
    ADD CONSTRAINT card_fees_restaurant_id_card_brand_key UNIQUE (restaurant_id, card_brand);


--
-- Name: cash_movements cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);


--
-- Name: cash_register_sessions cash_register_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: comandas comandas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_pkey PRIMARY KEY (id);


--
-- Name: counter_order_item_extras counter_order_item_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_item_extras
    ADD CONSTRAINT counter_order_item_extras_pkey PRIMARY KEY (id);


--
-- Name: counter_order_items counter_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_items
    ADD CONSTRAINT counter_order_items_pkey PRIMARY KEY (id);


--
-- Name: counter_orders counter_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_orders
    ADD CONSTRAINT counter_orders_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: delivery_config delivery_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_config
    ADD CONSTRAINT delivery_config_pkey PRIMARY KEY (id);


--
-- Name: delivery_config delivery_config_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_config
    ADD CONSTRAINT delivery_config_restaurant_id_key UNIQUE (restaurant_id);


--
-- Name: extra_categories extra_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_categories
    ADD CONSTRAINT extra_categories_pkey PRIMARY KEY (id);


--
-- Name: extra_category_item_ingredients extra_category_item_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_category_item_ingredients
    ADD CONSTRAINT extra_category_item_ingredients_pkey PRIMARY KEY (id);


--
-- Name: extra_category_items extra_category_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_category_items
    ADD CONSTRAINT extra_category_items_pkey PRIMARY KEY (id);


--
-- Name: fixed_costs fixed_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_costs
    ADD CONSTRAINT fixed_costs_pkey PRIMARY KEY (id);


--
-- Name: labor_costs labor_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_costs
    ADD CONSTRAINT labor_costs_pkey PRIMARY KEY (id);


--
-- Name: loyalty_points loyalty_points_customer_cpf_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_customer_cpf_restaurant_id_key UNIQUE (customer_cpf, restaurant_id);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: operational_costs operational_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_costs
    ADD CONSTRAINT operational_costs_pkey PRIMARY KEY (id);


--
-- Name: operational_costs operational_costs_restaurant_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_costs
    ADD CONSTRAINT operational_costs_restaurant_id_month_year_key UNIQUE (restaurant_id, month_year);


--
-- Name: order_item_extras order_item_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_extras
    ADD CONSTRAINT order_item_extras_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_extra_ingredients product_extra_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_extra_ingredients
    ADD CONSTRAINT product_extra_ingredients_pkey PRIMARY KEY (id);


--
-- Name: product_extras product_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_extras
    ADD CONSTRAINT product_extras_pkey PRIMARY KEY (id);


--
-- Name: product_ingredients product_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_pkey PRIMARY KEY (id);


--
-- Name: product_ingredients product_ingredients_product_id_stock_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_product_id_stock_item_id_key UNIQUE (product_id, stock_item_id);


--
-- Name: products products_name_category_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_name_category_unique UNIQUE (name, category_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: restaurant_credentials restaurant_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_credentials
    ADD CONSTRAINT restaurant_credentials_pkey PRIMARY KEY (id);


--
-- Name: restaurant_credentials restaurant_credentials_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_credentials
    ADD CONSTRAINT restaurant_credentials_username_key UNIQUE (username);


--
-- Name: restaurant_reviews restaurant_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reviews
    ADD CONSTRAINT restaurant_reviews_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_slug_key UNIQUE (slug);


--
-- Name: stock_categories stock_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_categories
    ADD CONSTRAINT stock_categories_pkey PRIMARY KEY (id);


--
-- Name: stock_items stock_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: tables tables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_pkey PRIMARY KEY (id);


--
-- Name: tables tables_restaurant_id_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_restaurant_id_table_number_key UNIQUE (restaurant_id, table_number);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_restaurant_id_key UNIQUE (user_id, role, restaurant_id);


--
-- Name: variable_costs variable_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variable_costs
    ADD CONSTRAINT variable_costs_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_config whatsapp_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_config
    ADD CONSTRAINT whatsapp_config_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_config whatsapp_config_restaurant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_config
    ADD CONSTRAINT whatsapp_config_restaurant_id_key UNIQUE (restaurant_id);


--
-- Name: idx_bills_table_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_table_status ON public.bills USING btree (table_id, status);


--
-- Name: idx_comandas_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_restaurant_id ON public.comandas USING btree (restaurant_id);


--
-- Name: idx_comandas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_status ON public.comandas USING btree (status);


--
-- Name: idx_comandas_table_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comandas_table_id ON public.comandas USING btree (table_id);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code) WHERE (is_active = true);


--
-- Name: idx_coupons_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_restaurant ON public.coupons USING btree (restaurant_id);


--
-- Name: idx_customer_addresses_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_addresses_cpf ON public.customer_addresses USING btree (customer_cpf);


--
-- Name: idx_extra_category_item_ingredients_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extra_category_item_ingredients_item_id ON public.extra_category_item_ingredients USING btree (category_item_id);


--
-- Name: idx_extra_category_item_ingredients_stock_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extra_category_item_ingredients_stock_item_id ON public.extra_category_item_ingredients USING btree (stock_item_id);


--
-- Name: idx_loyalty_points_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_cpf ON public.loyalty_points USING btree (customer_cpf);


--
-- Name: idx_loyalty_points_cpf_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_cpf_restaurant ON public.loyalty_points USING btree (customer_cpf, restaurant_id);


--
-- Name: idx_loyalty_points_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_points_restaurant ON public.loyalty_points USING btree (restaurant_id);


--
-- Name: idx_loyalty_transactions_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_transactions_cpf ON public.loyalty_transactions USING btree (customer_cpf);


--
-- Name: idx_loyalty_transactions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loyalty_transactions_order ON public.loyalty_transactions USING btree (order_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_order_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_product ON public.order_items USING btree (order_id, product_id);


--
-- Name: idx_orders_comanda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_comanda_id ON public.orders USING btree (comanda_id);


--
-- Name: idx_orders_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_order_type ON public.orders USING btree (order_type);


--
-- Name: idx_orders_restaurant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_restaurant_created ON public.orders USING btree (restaurant_id, created_at DESC) WHERE (status <> 'delivered'::text);


--
-- Name: idx_orders_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_restaurant_id ON public.orders USING btree (restaurant_id);


--
-- Name: idx_orders_status_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_type ON public.orders USING btree (status, order_type) WHERE (restaurant_id IS NOT NULL);


--
-- Name: idx_orders_table_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_table_created ON public.orders USING btree (table_id, created_at DESC);


--
-- Name: idx_product_extra_ingredients_extra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_extra_ingredients_extra_id ON public.product_extra_ingredients USING btree (product_extra_id);


--
-- Name: idx_product_extra_ingredients_stock_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_extra_ingredients_stock_item_id ON public.product_extra_ingredients USING btree (stock_item_id);


--
-- Name: idx_product_extras_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_extras_product ON public.product_extras USING btree (product_id);


--
-- Name: idx_product_ingredients_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_product ON public.product_ingredients USING btree (product_id);


--
-- Name: idx_product_ingredients_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_ingredients_stock ON public.product_ingredients USING btree (stock_item_id);


--
-- Name: idx_products_category_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_available ON public.products USING btree (category_id, available) WHERE (available = true);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_featured ON public.products USING btree (is_featured, featured_display_order) WHERE (is_featured = true);


--
-- Name: idx_profiles_cpf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_cpf ON public.profiles USING btree (cpf);


--
-- Name: idx_restaurant_reviews_bill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_reviews_bill_id ON public.restaurant_reviews USING btree (bill_id);


--
-- Name: idx_restaurant_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_reviews_created_at ON public.restaurant_reviews USING btree (created_at DESC);


--
-- Name: idx_restaurant_reviews_restaurant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_restaurant_reviews_restaurant_id ON public.restaurant_reviews USING btree (restaurant_id);


--
-- Name: idx_stock_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_items_category ON public.stock_items USING btree (category_id);


--
-- Name: idx_stock_items_restaurant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_items_restaurant ON public.stock_items USING btree (restaurant_id);


--
-- Name: idx_stock_movements_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_item ON public.stock_movements USING btree (stock_item_id);


--
-- Name: idx_stock_movements_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_order ON public.stock_movements USING btree (order_id);


--
-- Name: orders orders_add_delivery_to_cash_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_add_delivery_to_cash_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.add_delivery_order_to_cash_register();


--
-- Name: orders orders_add_local_to_cash_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_add_local_to_cash_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.add_local_order_to_cash_register();


--
-- Name: bills trigger_check_table_release; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_table_release AFTER UPDATE ON public.bills FOR EACH ROW WHEN (((new.status = 'paid'::text) AND (old.status <> 'paid'::text))) EXECUTE FUNCTION public.check_table_release();


--
-- Name: bills trigger_check_table_release_on_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_table_release_on_delete AFTER DELETE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.check_table_release_on_delete();


--
-- Name: orders trigger_mark_table_occupied; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_mark_table_occupied AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.mark_table_occupied();


--
-- Name: orders trigger_order_stock_movement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_order_stock_movement AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.process_order_stock_movement();


--
-- Name: counter_orders trigger_process_counter_order_finalization; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_process_counter_order_finalization AFTER UPDATE ON public.counter_orders FOR EACH ROW EXECUTE FUNCTION public.process_counter_order_finalization();


--
-- Name: counter_orders trigger_revert_counter_order_deletion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_revert_counter_order_deletion BEFORE DELETE ON public.counter_orders FOR EACH ROW EXECUTE FUNCTION public.revert_counter_order_deletion();


--
-- Name: orders trigger_revert_order_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_revert_order_stock BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.revert_order_stock_movement();


--
-- Name: orders trigger_revert_stock_on_cancel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_revert_stock_on_cancel BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.revert_stock_on_cancel();


--
-- Name: bills trigger_update_cash_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_cash_payment AFTER UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_cash_movement_payment();


--
-- Name: coupons trigger_update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_coupons_updated_at();


--
-- Name: customer_addresses trigger_update_customer_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_customer_addresses_updated_at BEFORE UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: card_fees_config update_card_fees_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_card_fees_config_updated_at BEFORE UPDATE ON public.card_fees_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: card_fees update_card_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_card_fees_updated_at BEFORE UPDATE ON public.card_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cash_register_sessions update_cash_register_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cash_register_sessions_updated_at BEFORE UPDATE ON public.cash_register_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comandas update_comandas_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comandas_updated_at BEFORE UPDATE ON public.comandas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: counter_orders update_counter_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_counter_orders_updated_at BEFORE UPDATE ON public.counter_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: delivery_config update_delivery_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_delivery_config_updated_at BEFORE UPDATE ON public.delivery_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: extra_categories update_extra_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_extra_categories_updated_at BEFORE UPDATE ON public.extra_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: extra_category_items update_extra_category_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_extra_category_items_updated_at BEFORE UPDATE ON public.extra_category_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fixed_costs update_fixed_costs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fixed_costs_updated_at BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: labor_costs update_labor_costs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_labor_costs_updated_at BEFORE UPDATE ON public.labor_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: operational_costs update_operational_costs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_operational_costs_updated_at BEFORE UPDATE ON public.operational_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_extras update_product_extras_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_extras_updated_at BEFORE UPDATE ON public.product_extras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: restaurant_reviews update_restaurant_reviews_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_restaurant_reviews_updated_at BEFORE UPDATE ON public.restaurant_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: restaurants update_restaurants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_categories update_stock_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_categories_updated_at BEFORE UPDATE ON public.stock_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stock_items update_stock_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: variable_costs update_variable_costs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_variable_costs_updated_at BEFORE UPDATE ON public.variable_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: whatsapp_config update_whatsapp_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_whatsapp_config_updated_at BEFORE UPDATE ON public.whatsapp_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bills bills_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: card_fees_config card_fees_config_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees_config
    ADD CONSTRAINT card_fees_config_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: card_fees card_fees_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.card_fees
    ADD CONSTRAINT card_fees_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: cash_movements cash_movements_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id);


--
-- Name: cash_movements cash_movements_cash_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_cash_session_id_fkey FOREIGN KEY (cash_session_id) REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE;


--
-- Name: cash_movements cash_movements_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: cash_register_sessions cash_register_sessions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_register_sessions
    ADD CONSTRAINT cash_register_sessions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: categories categories_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: comandas comandas_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: comandas comandas_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comandas
    ADD CONSTRAINT comandas_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: counter_order_item_extras counter_order_item_extras_counter_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_item_extras
    ADD CONSTRAINT counter_order_item_extras_counter_order_item_id_fkey FOREIGN KEY (counter_order_item_id) REFERENCES public.counter_order_items(id) ON DELETE CASCADE;


--
-- Name: counter_order_item_extras counter_order_item_extras_product_extra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_item_extras
    ADD CONSTRAINT counter_order_item_extras_product_extra_id_fkey FOREIGN KEY (product_extra_id) REFERENCES public.product_extras(id);


--
-- Name: counter_order_items counter_order_items_counter_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_items
    ADD CONSTRAINT counter_order_items_counter_order_id_fkey FOREIGN KEY (counter_order_id) REFERENCES public.counter_orders(id) ON DELETE CASCADE;


--
-- Name: counter_order_items counter_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_order_items
    ADD CONSTRAINT counter_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: counter_orders counter_orders_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_orders
    ADD CONSTRAINT counter_orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);


--
-- Name: counter_orders counter_orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counter_orders
    ADD CONSTRAINT counter_orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id);


--
-- Name: coupons coupons_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: delivery_config delivery_config_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_config
    ADD CONSTRAINT delivery_config_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: extra_category_item_ingredients extra_category_item_ingredients_category_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_category_item_ingredients
    ADD CONSTRAINT extra_category_item_ingredients_category_item_id_fkey FOREIGN KEY (category_item_id) REFERENCES public.extra_category_items(id) ON DELETE CASCADE;


--
-- Name: extra_category_item_ingredients extra_category_item_ingredients_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_category_item_ingredients
    ADD CONSTRAINT extra_category_item_ingredients_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: extra_category_items extra_category_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_category_items
    ADD CONSTRAINT extra_category_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.extra_categories(id) ON DELETE CASCADE;


--
-- Name: fixed_costs fixed_costs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_costs
    ADD CONSTRAINT fixed_costs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: labor_costs labor_costs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labor_costs
    ADD CONSTRAINT labor_costs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: loyalty_transactions loyalty_transactions_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: operational_costs operational_costs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_costs
    ADD CONSTRAINT operational_costs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: order_item_extras order_item_extras_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_extras
    ADD CONSTRAINT order_item_extras_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_item_extras order_item_extras_product_extra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_extras
    ADD CONSTRAINT order_item_extras_product_extra_id_fkey FOREIGN KEY (product_extra_id) REFERENCES public.product_extras(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: orders orders_comanda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_comanda_id_fkey FOREIGN KEY (comanda_id) REFERENCES public.comandas(id) ON DELETE SET NULL;


--
-- Name: orders orders_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);


--
-- Name: orders orders_table_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_table_id_fkey FOREIGN KEY (table_id) REFERENCES public.tables(id) ON DELETE CASCADE;


--
-- Name: product_extra_ingredients product_extra_ingredients_product_extra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_extra_ingredients
    ADD CONSTRAINT product_extra_ingredients_product_extra_id_fkey FOREIGN KEY (product_extra_id) REFERENCES public.product_extras(id) ON DELETE CASCADE;


--
-- Name: product_extra_ingredients product_extra_ingredients_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_extra_ingredients
    ADD CONSTRAINT product_extra_ingredients_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: product_extras product_extras_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_extras
    ADD CONSTRAINT product_extras_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_ingredients product_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_ingredients product_ingredients_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredients
    ADD CONSTRAINT product_ingredients_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_credentials restaurant_credentials_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_credentials
    ADD CONSTRAINT restaurant_credentials_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: restaurant_reviews restaurant_reviews_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reviews
    ADD CONSTRAINT restaurant_reviews_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE SET NULL;


--
-- Name: restaurant_reviews restaurant_reviews_counter_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reviews
    ADD CONSTRAINT restaurant_reviews_counter_order_id_fkey FOREIGN KEY (counter_order_id) REFERENCES public.counter_orders(id) ON DELETE SET NULL;


--
-- Name: restaurant_reviews restaurant_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reviews
    ADD CONSTRAINT restaurant_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: restaurant_reviews restaurant_reviews_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_reviews
    ADD CONSTRAINT restaurant_reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: stock_categories stock_categories_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_categories
    ADD CONSTRAINT stock_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: stock_items stock_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.stock_categories(id) ON DELETE SET NULL;


--
-- Name: stock_items stock_items_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_items
    ADD CONSTRAINT stock_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_stock_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_stock_item_id_fkey FOREIGN KEY (stock_item_id) REFERENCES public.stock_items(id) ON DELETE CASCADE;


--
-- Name: tables tables_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tables
    ADD CONSTRAINT tables_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: variable_costs variable_costs_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variable_costs
    ADD CONSTRAINT variable_costs_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: whatsapp_config whatsapp_config_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_config
    ADD CONSTRAINT whatsapp_config_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: bills Allow all operations on bills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on bills" ON public.bills TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: card_fees Allow all operations on card fees; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on card fees" ON public.card_fees TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: card_fees_config Allow all operations on card fees config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on card fees config" ON public.card_fees_config TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: cash_movements Allow all operations on cash movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on cash movements" ON public.cash_movements TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: cash_register_sessions Allow all operations on cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on cash sessions" ON public.cash_register_sessions TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: categories Allow all operations on categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on categories" ON public.categories TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: comandas Allow all operations on comandas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on comandas" ON public.comandas USING (true) WITH CHECK (true);


--
-- Name: counter_order_item_extras Allow all operations on counter order item extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on counter order item extras" ON public.counter_order_item_extras TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: counter_order_items Allow all operations on counter order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on counter order items" ON public.counter_order_items TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: counter_orders Allow all operations on counter orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on counter orders" ON public.counter_orders TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: coupons Allow all operations on coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on coupons" ON public.coupons USING (true) WITH CHECK (true);


--
-- Name: customer_addresses Allow all operations on customer addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on customer addresses" ON public.customer_addresses USING (true) WITH CHECK (true);


--
-- Name: delivery_config Allow all operations on delivery config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on delivery config" ON public.delivery_config TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: extra_categories Allow all operations on extra categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on extra categories" ON public.extra_categories TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: extra_category_item_ingredients Allow all operations on extra category item ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on extra category item ingredients" ON public.extra_category_item_ingredients TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: extra_category_items Allow all operations on extra category items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on extra category items" ON public.extra_category_items TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: fixed_costs Allow all operations on fixed costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on fixed costs" ON public.fixed_costs TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: labor_costs Allow all operations on labor costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on labor costs" ON public.labor_costs TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: loyalty_points Allow all operations on loyalty points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on loyalty points" ON public.loyalty_points USING (true) WITH CHECK (true);


--
-- Name: loyalty_transactions Allow all operations on loyalty transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on loyalty transactions" ON public.loyalty_transactions USING (true) WITH CHECK (true);


--
-- Name: operational_costs Allow all operations on operational costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on operational costs" ON public.operational_costs TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: order_item_extras Allow all operations on order item extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on order item extras" ON public.order_item_extras TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: order_items Allow all operations on order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on order items" ON public.order_items TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: orders Allow all operations on orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on orders" ON public.orders TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: product_extra_ingredients Allow all operations on product extra ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on product extra ingredients" ON public.product_extra_ingredients TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: product_extras Allow all operations on product extras; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on product extras" ON public.product_extras TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: product_ingredients Allow all operations on product ingredients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on product ingredients" ON public.product_ingredients TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: products Allow all operations on products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on products" ON public.products TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: restaurants Allow all operations on restaurants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on restaurants" ON public.restaurants TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: stock_categories Allow all operations on stock categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on stock categories" ON public.stock_categories TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: stock_items Allow all operations on stock items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on stock items" ON public.stock_items TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: stock_movements Allow all operations on stock movements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on stock movements" ON public.stock_movements TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: tables Allow all operations on tables; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on tables" ON public.tables TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: variable_costs Allow all operations on variable costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on variable costs" ON public.variable_costs TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: whatsapp_config Allow all operations on whatsapp config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all operations on whatsapp config" ON public.whatsapp_config TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: app_versions Anyone can read app versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read app versions" ON public.app_versions FOR SELECT USING (true);


--
-- Name: restaurant_reviews Anyone can view reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view reviews" ON public.restaurant_reviews FOR SELECT USING (true);


--
-- Name: user_roles CEOs can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "CEOs can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'ceo'::public.app_role));


--
-- Name: restaurant_reviews Clients can create reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Clients can create reviews" ON public.restaurant_reviews FOR INSERT WITH CHECK (true);


--
-- Name: app_versions Only admins can manage versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can manage versions" ON public.app_versions USING (public.has_role(auth.uid(), 'ceo'::public.app_role));


--
-- Name: restaurant_credentials Only system can access credentials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only system can access credentials" ON public.restaurant_credentials TO authenticated USING (false) WITH CHECK (false);


--
-- Name: user_roles Users can create own user role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own user role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (role = 'user'::public.app_role)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: app_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

--
-- Name: card_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.card_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: card_fees_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.card_fees_config ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_register_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: comandas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

--
-- Name: counter_order_item_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.counter_order_item_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: counter_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.counter_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: counter_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.counter_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_config ENABLE ROW LEVEL SECURITY;

--
-- Name: extra_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extra_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: extra_category_item_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extra_category_item_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: extra_category_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extra_category_items ENABLE ROW LEVEL SECURITY;

--
-- Name: fixed_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: labor_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.labor_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: operational_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_extra_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_extra_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: product_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: product_ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_credentials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurant_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: restaurants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: tables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: variable_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.variable_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


