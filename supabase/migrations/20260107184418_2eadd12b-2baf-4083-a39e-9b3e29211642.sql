-- Drop função existente para recriar com novos parâmetros
DROP FUNCTION IF EXISTS public.is_restaurant_admin(UUID, UUID);

-- Função helper para verificar admin do restaurante
CREATE OR REPLACE FUNCTION public.is_restaurant_admin(user_uuid UUID, rest_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM restaurant_credentials rc
    JOIN profiles p ON p.email = rc.username
    WHERE p.id = user_uuid AND rc.restaurant_id = rest_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;