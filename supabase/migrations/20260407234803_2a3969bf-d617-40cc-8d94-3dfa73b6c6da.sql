CREATE OR REPLACE FUNCTION public.admin_delete_staff(p_staff_id uuid, p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM restaurant_staff
  WHERE id = p_staff_id AND restaurant_id = p_restaurant_id AND role != 'admin';
  RETURN FOUND;
END;
$$;