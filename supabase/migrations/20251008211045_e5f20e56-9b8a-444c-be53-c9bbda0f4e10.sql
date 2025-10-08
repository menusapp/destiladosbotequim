-- Permitir que product_id e product_extra_id sejam NULL para preservar histórico
-- Isso permite que pedidos antigos sejam mantidos mesmo com produtos excluídos

ALTER TABLE public.order_items 
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_item_extras 
ALTER COLUMN product_extra_id DROP NOT NULL;