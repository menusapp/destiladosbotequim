UPDATE public.restaurant_staff
SET password_hash = extensions.crypt('destilados123', extensions.gen_salt('bf'))
WHERE id = '890940fb-56e3-4dc9-9751-b17b0a246eb7';