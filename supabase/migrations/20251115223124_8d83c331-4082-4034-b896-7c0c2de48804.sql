-- Relaxa políticas RLS para cash_register_sessions e cash_movements
-- Permite operações locais sem autenticação admin complexa

-- Remove políticas restritivas de cash_register_sessions
DROP POLICY IF EXISTS "Restaurant admins can manage cash sessions" ON cash_register_sessions;

-- Permite usuários autenticados gerenciarem sessões de caixa
CREATE POLICY "Allow authenticated users to manage cash sessions"
ON cash_register_sessions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Permite leitura anônima para sistemas locais
CREATE POLICY "Allow anonymous read of cash sessions"
ON cash_register_sessions
FOR SELECT
TO anon
USING (true);

-- Remove políticas restritivas de cash_movements
DROP POLICY IF EXISTS "Restaurant admins can manage cash movements" ON cash_movements;

-- Permite usuários autenticados gerenciarem movimentações
CREATE POLICY "Allow authenticated users to manage cash movements"
ON cash_movements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Permite leitura anônima para sistemas locais
CREATE POLICY "Allow anonymous read of cash movements"
ON cash_movements
FOR SELECT
TO anon
USING (true);