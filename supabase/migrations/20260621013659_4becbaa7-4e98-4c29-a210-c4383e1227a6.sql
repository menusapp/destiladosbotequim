-- Drop advisory-lock based funcs (não funcionam confiavelmente atrás de pgbouncer)
DROP FUNCTION IF EXISTS public.try_acquire_polling_lock(text);
DROP FUNCTION IF EXISTS public.release_polling_lock(text);

CREATE TABLE IF NOT EXISTS public.polling_locks (
  lock_key text PRIMARY KEY,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  owner text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polling_locks TO service_role;
ALTER TABLE public.polling_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role manages polling_locks" ON public.polling_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Acquire lock with TTL (default 120s). Returns true if acquired.
CREATE OR REPLACE FUNCTION public.try_acquire_polling_lock(
  _key text,
  _ttl_seconds int DEFAULT 120,
  _owner text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted boolean;
BEGIN
  -- Atomic upsert: insere se não existir OU se o lock anterior expirou
  INSERT INTO public.polling_locks (lock_key, acquired_at, owner)
  VALUES (_key, now(), _owner)
  ON CONFLICT (lock_key) DO UPDATE
    SET acquired_at = EXCLUDED.acquired_at,
        owner = EXCLUDED.owner
    WHERE public.polling_locks.acquired_at < now() - make_interval(secs => _ttl_seconds)
  RETURNING true INTO inserted;

  RETURN COALESCE(inserted, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_polling_lock(_key text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.polling_locks WHERE lock_key = _key RETURNING true;
$$;

GRANT EXECUTE ON FUNCTION public.try_acquire_polling_lock(text, int, text) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.release_polling_lock(text) TO service_role, authenticated, anon;