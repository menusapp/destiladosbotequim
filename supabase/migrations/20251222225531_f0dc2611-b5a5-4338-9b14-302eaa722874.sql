-- Add comanda_id column to bills table to separate bills by comanda
ALTER TABLE bills ADD COLUMN comanda_id uuid REFERENCES comandas(id);

-- Create index for faster lookups
CREATE INDEX idx_bills_comanda_id ON bills(comanda_id);