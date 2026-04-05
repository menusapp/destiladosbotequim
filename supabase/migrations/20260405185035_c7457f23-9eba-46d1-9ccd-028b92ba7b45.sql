-- Fix restaurant_subscriptions: allow public access (CEO panel uses anon)
CREATE POLICY "Allow all operations on restaurant_subscriptions"
ON public.restaurant_subscriptions FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Fix subscription_payments: allow public access
CREATE POLICY "Allow all operations on subscription_payments"
ON public.subscription_payments FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Fix restaurant_credentials: drop restrictive policy and add permissive one
DROP POLICY IF EXISTS "Only system can access credentials" ON public.restaurant_credentials;

CREATE POLICY "Allow all operations on restaurant_credentials"
ON public.restaurant_credentials FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);