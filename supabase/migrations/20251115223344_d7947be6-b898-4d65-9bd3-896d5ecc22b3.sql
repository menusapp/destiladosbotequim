-- Permite operações anônimas completas em cash_register_sessions e cash_movements
-- Para funcionamento local sem autenticação

-- Remove políticas anteriores de cash_register_sessions
DROP POLICY IF EXISTS "Allow authenticated users to manage cash sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "Allow anonymous read of cash sessions" ON cash_register_sessions;

-- Permite tudo para anon em cash_register_sessions
CREATE POLICY "Allow all operations on cash sessions"
ON cash_register_sessions
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Remove políticas anteriores de cash_movements
DROP POLICY IF EXISTS "Allow authenticated users to manage cash movements" ON cash_movements;
DROP POLICY IF EXISTS "Allow anonymous read of cash movements" ON cash_movements;

-- Permite tudo para anon em cash_movements
CREATE POLICY "Allow all operations on cash movements"
ON cash_movements
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);