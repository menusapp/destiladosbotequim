-- Atualizar foreign keys para permitir deleção em cascata

-- Remover e recriar foreign key de order_items para orders com CASCADE
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey 
FOREIGN KEY (order_id) 
REFERENCES public.orders(id) 
ON DELETE CASCADE;

-- Remover e recriar foreign key de order_item_extras para order_items com CASCADE
ALTER TABLE public.order_item_extras 
DROP CONSTRAINT IF EXISTS order_item_extras_order_item_id_fkey;

ALTER TABLE public.order_item_extras
ADD CONSTRAINT order_item_extras_order_item_id_fkey 
FOREIGN KEY (order_item_id) 
REFERENCES public.order_items(id) 
ON DELETE CASCADE;

-- Remover e recriar foreign key de orders para tables com CASCADE
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_table_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_table_id_fkey 
FOREIGN KEY (table_id) 
REFERENCES public.tables(id) 
ON DELETE CASCADE;