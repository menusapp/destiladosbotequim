-- Remover a constraint antiga e adicionar uma nova com ON DELETE CASCADE
-- Isso permitirá que quando uma mesa seja deletada, as bills associadas também sejam deletadas

ALTER TABLE public.bills 
DROP CONSTRAINT IF EXISTS bills_table_id_fkey;

ALTER TABLE public.bills
ADD CONSTRAINT bills_table_id_fkey 
FOREIGN KEY (table_id) 
REFERENCES public.tables(id) 
ON DELETE CASCADE;