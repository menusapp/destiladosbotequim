
CREATE TABLE public.ceo_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ceo_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ceo_users for anon and authenticated"
ON public.ceo_users
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Create RPC to validate CEO credentials (similar to staff)
CREATE OR REPLACE FUNCTION public.validate_ceo_credentials(
  p_username text,
  p_password text
)
RETURNS TABLE(
  ceo_user_id uuid,
  display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT cu.id, cu.username, cu.password_hash, cu.display_name
  INTO v_user
  FROM public.ceo_users cu
  WHERE cu.username = p_username AND cu.is_active = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Try bcrypt
  IF v_user.password_hash LIKE '$2%' THEN
    IF extensions.crypt(p_password, v_user.password_hash) = v_user.password_hash THEN
      RETURN QUERY SELECT v_user.id, v_user.display_name;
    END IF;
  ELSE
    -- Legacy plain text
    IF v_user.password_hash = p_password THEN
      -- Upgrade to bcrypt
      UPDATE public.ceo_users SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) WHERE id = v_user.id;
      RETURN QUERY SELECT v_user.id, v_user.display_name;
    END IF;
  END IF;
END;
$$;

-- Also create RPC to validate CEO master access (username=CEO, password=CEO123)
-- We'll handle this via restaurant_credentials with a special entry, or in the app code.
