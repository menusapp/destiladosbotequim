-- Modificar o trigger de marcar mesa ocupada para não sobrescrever
-- se a mesa já estiver ocupada (pois agora ela é marcada ao acessar o cardápio)
CREATE OR REPLACE FUNCTION public.mark_table_occupied()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Não fazer nada se a mesa já estiver ocupada
  -- (pois ela foi marcada quando o cliente acessou o cardápio)
  RETURN NEW;
END;
$function$;