-- Drop existing restrictive policies for cash register
DROP POLICY IF EXISTS "Restaurant admins can create cash sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "Restaurant admins can update open cash sessions" ON cash_register_sessions;
DROP POLICY IF EXISTS "Restaurant admins can view cash sessions" ON cash_register_sessions;

DROP POLICY IF EXISTS "Restaurant admins can create cash movements" ON cash_movements;
DROP POLICY IF EXISTS "Restaurant admins can update cash movements" ON cash_movements;
DROP POLICY IF EXISTS "Restaurant admins can view cash movements" ON cash_movements;

-- Create permissive policies for cash register sessions (no auth required)
CREATE POLICY "Anyone can create cash sessions"
ON cash_register_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update cash sessions"
ON cash_register_sessions FOR UPDATE
USING (true);

CREATE POLICY "Anyone can view cash sessions"
ON cash_register_sessions FOR SELECT
USING (true);

-- Create permissive policies for cash movements (no auth required)
CREATE POLICY "Anyone can create cash movements"
ON cash_movements FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update cash movements"
ON cash_movements FOR UPDATE
USING (true);

CREATE POLICY "Anyone can view cash movements"
ON cash_movements FOR SELECT
USING (true);