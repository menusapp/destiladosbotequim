-- Redefine credenciais de acesso conhecidas
UPDATE public.restaurant_credentials
SET password_hash = extensions.crypt('Destilado@2026', extensions.gen_salt('bf'))
WHERE lower(trim(username)) = 'destilados';

UPDATE public.restaurant_staff
SET password_hash = extensions.crypt('Admin@2026', extensions.gen_salt('bf')),
    is_active = true
WHERE lower(trim(username)) = 'admin';

INSERT INTO public.ceo_users (username, password_hash, display_name, is_active)
VALUES ('ceo', extensions.crypt('Ceo@2026', extensions.gen_salt('bf')), 'CEO', true)
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    is_active = true;