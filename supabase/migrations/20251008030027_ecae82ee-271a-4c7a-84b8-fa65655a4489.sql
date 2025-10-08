-- Permitir INSERT e UPDATE em restaurants (para CEO adicionar/editar)
DROP POLICY IF EXISTS "Restaurantes são públicos" ON public.restaurants;

CREATE POLICY "Qualquer um pode ver restaurantes"
ON public.restaurants
FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar restaurantes"
ON public.restaurants
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar restaurantes"
ON public.restaurants
FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode excluir restaurantes"
ON public.restaurants
FOR DELETE
USING (true);

-- Permitir INSERT e UPDATE em restaurant_credentials (para CEO gerenciar credenciais)
DROP POLICY IF EXISTS "Credenciais são visíveis publicamente para login" ON public.restaurant_credentials;

CREATE POLICY "Qualquer um pode ver credenciais"
ON public.restaurant_credentials
FOR SELECT
USING (true);

CREATE POLICY "Qualquer um pode criar credenciais"
ON public.restaurant_credentials
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar credenciais"
ON public.restaurant_credentials
FOR UPDATE
USING (true);

CREATE POLICY "Qualquer um pode excluir credenciais"
ON public.restaurant_credentials
FOR DELETE
USING (true);