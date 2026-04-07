
-- Force-hash all plaintext passwords in restaurant_staff
-- A plaintext password does NOT start with $2a$, $2b$, or $2y$
-- Using pgcrypto's crypt + gen_salt to produce bcrypt hashes
UPDATE public.restaurant_staff
SET password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
WHERE password_hash IS NOT NULL
  AND password_hash != ''
  AND password_hash NOT LIKE '$2a$%'
  AND password_hash NOT LIKE '$2b$%'
  AND password_hash NOT LIKE '$2y$%';
