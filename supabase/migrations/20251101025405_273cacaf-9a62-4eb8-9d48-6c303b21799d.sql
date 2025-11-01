-- Fix trigger to only fire on UPDATE when status changes to 'accepted'
-- This ensures order_items are already inserted before calculating totals

DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON orders;

CREATE TRIGGER trigger_add_order_to_cash
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted'))
  EXECUTE FUNCTION add_order_to_cash_register();