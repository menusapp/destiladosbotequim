-- Adicionar campo de observação em order_items
ALTER TABLE public.order_items 
ADD COLUMN notes TEXT;

-- Adicionar campo de observação em orders
ALTER TABLE public.orders 
ADD COLUMN notes TEXT;