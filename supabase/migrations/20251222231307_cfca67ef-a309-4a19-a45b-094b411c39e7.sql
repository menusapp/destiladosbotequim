-- Remover constraint antiga de payment_method
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_payment_method_check;

-- Adicionar nova constraint com todos os tipos de pagamento válidos
ALTER TABLE bills ADD CONSTRAINT bills_payment_method_check 
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY[
    'pix'::text, 
    'card'::text, 
    'credit'::text, 
    'debit'::text, 
    'cash'::text, 
    'meal_voucher'::text
  ]));