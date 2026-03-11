ALTER TABLE order_fiscal_notes 
ADD COLUMN IF NOT EXISTS nuvem_fiscal_ref text,
ADD COLUMN IF NOT EXISTS nfe_key text;