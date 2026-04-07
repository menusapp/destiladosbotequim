
-- =============================================
-- SECURE ifood_config
-- =============================================
DROP POLICY IF EXISTS "Allow all operations on ifood_config" ON public.ifood_config;

CREATE POLICY "block_direct_access" ON public.ifood_config
  FOR ALL USING (false) WITH CHECK (false);

-- RPC: get ifood config (masks access_token, hides refresh_token)
CREATE OR REPLACE FUNCTION public.admin_get_ifood_config(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', ic.id,
    'restaurant_id', ic.restaurant_id,
    'enabled', ic.enabled,
    'merchant_id', ic.merchant_id,
    'token_expires_at', ic.token_expires_at,
    'access_token', CASE WHEN ic.access_token IS NOT NULL THEN 'connected' ELSE NULL END
  ) INTO result
  FROM ifood_config ic
  WHERE ic.restaurant_id = p_restaurant_id;
  
  RETURN result;
END;
$$;

-- RPC: toggle ifood enabled
CREATE OR REPLACE FUNCTION public.admin_toggle_ifood(p_restaurant_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE ifood_config SET enabled = p_enabled, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;
END;
$$;

-- =============================================
-- SECURE deliverydireto_config
-- =============================================
DROP POLICY IF EXISTS "Allow all operations on deliverydireto_config" ON public.deliverydireto_config;

CREATE POLICY "block_direct_access" ON public.deliverydireto_config
  FOR ALL USING (false) WITH CHECK (false);

-- RPC: get dd config (masks tokens)
CREATE OR REPLACE FUNCTION public.admin_get_dd_config(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', dc.id,
    'restaurant_id', dc.restaurant_id,
    'enabled', dc.enabled,
    'store_id', dc.store_id,
    'username', dc.username,
    'token_expires_at', dc.token_expires_at,
    'access_token', CASE WHEN dc.access_token IS NOT NULL THEN 'connected' ELSE NULL END
  ) INTO result
  FROM deliverydireto_config dc
  WHERE dc.restaurant_id = p_restaurant_id;
  
  RETURN result;
END;
$$;

-- RPC: toggle dd enabled
CREATE OR REPLACE FUNCTION public.admin_toggle_dd(p_restaurant_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE deliverydireto_config SET enabled = p_enabled, updated_at = now()
  WHERE restaurant_id = p_restaurant_id;
END;
$$;

-- =============================================
-- SECURE whatsapp_config
-- =============================================
DROP POLICY IF EXISTS "Allow all operations on whatsapp config" ON public.whatsapp_config;

CREATE POLICY "block_direct_access" ON public.whatsapp_config
  FOR ALL USING (false) WITH CHECK (false);

-- RPC: get whatsapp status (only returns safe fields)
CREATE OR REPLACE FUNCTION public.admin_get_whatsapp_status(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'enabled', wc.enabled,
    'instance_status', wc.instance_status
  ) INTO result
  FROM whatsapp_config wc
  WHERE wc.restaurant_id = p_restaurant_id;
  
  RETURN result;
END;
$$;
