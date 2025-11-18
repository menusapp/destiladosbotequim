-- Criar tabela de avaliações reais dos clientes
CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  counter_order_id UUID NULL REFERENCES public.counter_orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_restaurant_reviews_restaurant_id ON public.restaurant_reviews(restaurant_id);
CREATE INDEX idx_restaurant_reviews_created_at ON public.restaurant_reviews(created_at DESC);

-- RLS policies
ALTER TABLE public.restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública das avaliações
CREATE POLICY "Anyone can view reviews"
  ON public.restaurant_reviews
  FOR SELECT
  USING (true);

-- Permitir que clientes criem avaliações
CREATE POLICY "Clients can create reviews"
  ON public.restaurant_reviews
  FOR INSERT
  WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_restaurant_reviews_updated_at
  BEFORE UPDATE ON public.restaurant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular média e total de avaliações
CREATE OR REPLACE FUNCTION public.get_restaurant_rating_stats(p_restaurant_id UUID)
RETURNS TABLE(average_rating NUMERIC, total_reviews BIGINT) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0) as average_rating,
    COUNT(*) as total_reviews
  FROM public.restaurant_reviews
  WHERE restaurant_id = p_restaurant_id;
$$;