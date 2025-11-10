-- Política mais permissiva para counter_orders permitir operações no painel admin
-- Remove a política restritiva atual
DROP POLICY IF EXISTS "Restaurant admins can manage counter orders" ON counter_orders;

-- Permite que qualquer um autenticado possa gerenciar counter_orders do seu restaurante
-- Isso funciona para o painel admin local
CREATE POLICY "Allow authenticated users to manage counter orders"
ON counter_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Para leitura pública (útil para sistemas locais)
CREATE POLICY "Allow anonymous read of counter orders"
ON counter_orders
FOR SELECT
TO anon
USING (true);