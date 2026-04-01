
-- Allow public access to manage subscription_plans (CEO panel uses custom auth, not Supabase Auth)
CREATE POLICY "Allow all operations on subscription_plans for public"
ON public.subscription_plans
FOR ALL
TO public
USING (true)
WITH CHECK (true);
