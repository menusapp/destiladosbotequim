CREATE OR REPLACE FUNCTION public.try_acquire_polling_lock(_key text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtextextended(_key, 42));
$$;

CREATE OR REPLACE FUNCTION public.release_polling_lock(_key text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtextextended(_key, 42));
$$;

GRANT EXECUTE ON FUNCTION public.try_acquire_polling_lock(text) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_polling_lock(text) TO service_role, authenticated, anon;