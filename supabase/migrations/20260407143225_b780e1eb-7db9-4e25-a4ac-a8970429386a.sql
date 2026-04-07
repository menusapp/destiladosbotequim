
-- Drop the block-all policy and replace with more granular ones
DROP POLICY IF EXISTS "block_direct_access" ON public.online_payment_config;

-- Allow SELECT (needed for the view to work for anon users reading public payment info)
CREATE POLICY "allow_select" ON public.online_payment_config FOR SELECT USING (true);

-- Block INSERT, UPDATE, DELETE (only RPCs with SECURITY DEFINER can modify)
CREATE POLICY "block_insert" ON public.online_payment_config FOR INSERT WITH CHECK (false);
CREATE POLICY "block_update" ON public.online_payment_config FOR UPDATE USING (false);
CREATE POLICY "block_delete" ON public.online_payment_config FOR DELETE USING (false);
