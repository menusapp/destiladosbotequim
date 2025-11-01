-- Criar trigger faltante para registrar pedidos no caixa automaticamente
-- Corrigido: remover WHEN do trigger pois não funciona com OLD em INSERT

DROP TRIGGER IF EXISTS trigger_add_order_to_cash ON orders;

CREATE TRIGGER trigger_add_order_to_cash
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION add_order_to_cash_register();

-- Comentário: Este trigger dispara após INSERT ou UPDATE de pedidos
-- A função add_order_to_cash_register() já tem a lógica interna
-- para verificar se status mudou para 'accepted' antes de registrar no caixa