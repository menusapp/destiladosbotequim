-- Alterar foreign keys para permitir produtos excluídos nos pedidos históricos
-- Isso preserva os dados de faturamento mesmo após exclusão de produtos

-- Remover constraint antiga e adicionar nova com ON DELETE SET NULL para products
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

ALTER TABLE public.order_items 
ADD CONSTRAINT order_items_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES public.products(id) 
ON DELETE SET NULL;

-- Remover constraint antiga e adicionar nova com ON DELETE SET NULL para product_extras
ALTER TABLE public.order_item_extras 
DROP CONSTRAINT IF EXISTS order_item_extras_product_extra_id_fkey;

ALTER TABLE public.order_item_extras 
ADD CONSTRAINT order_item_extras_product_extra_id_fkey 
FOREIGN KEY (product_extra_id) 
REFERENCES public.product_extras(id) 
ON DELETE SET NULL;