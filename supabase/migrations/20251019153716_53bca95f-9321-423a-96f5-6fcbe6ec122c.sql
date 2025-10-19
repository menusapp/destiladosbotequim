-- Allow users to create their own default 'user' role (for legacy accounts)
DROP POLICY IF EXISTS "Users can create own user role" ON public.user_roles;
CREATE POLICY "Users can create own user role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'user');