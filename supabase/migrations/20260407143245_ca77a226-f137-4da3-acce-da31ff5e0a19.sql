
-- Remove the current permissive policies
DROP POLICY IF EXISTS "allow_select" ON public.online_payment_config;
DROP POLICY IF EXISTS "block_insert" ON public.online_payment_config;
DROP POLICY IF EXISTS "block_update" ON public.online_payment_config;
DROP POLICY IF EXISTS "block_delete" ON public.online_payment_config;

-- Block all direct access
CREATE POLICY "block_direct_access" ON public.online_payment_config FOR ALL USING (false) WITH CHECK (false);

-- Make the view SECURITY DEFINER so it bypasses RLS (owner is superuser)
ALTER VIEW public.online_payment_config_public SET (security_invoker = off);
