-- Atualizar funções existentes com search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_service_fee_timeout()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'requested' AND NEW.bill_requested_at IS NOT NULL THEN
    IF (EXTRACT(EPOCH FROM (now() - NEW.bill_requested_at)) / 60) >= 5 AND NEW.service_fee_removed = false THEN
      NEW.service_fee_removed = true;
      NEW.service_fee_removed_at = now();
      NEW.total_amount = NEW.subtotal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;