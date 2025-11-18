-- Adicionar coluna bill_id na tabela de avaliações
-- para permitir avaliações de contas sem pedidos específicos
ALTER TABLE public.restaurant_reviews
ADD COLUMN bill_id UUID NULL REFERENCES public.bills(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX idx_restaurant_reviews_bill_id ON public.restaurant_reviews(bill_id);

-- Atualizar constraint para permitir que pelo menos um dos IDs esteja presente
-- (ordem, pedido balcão ou conta)
ALTER TABLE public.restaurant_reviews
DROP CONSTRAINT IF EXISTS restaurant_reviews_check;

ALTER TABLE public.restaurant_reviews
ADD CONSTRAINT restaurant_reviews_has_reference
CHECK (
  order_id IS NOT NULL OR 
  counter_order_id IS NOT NULL OR 
  bill_id IS NOT NULL
);