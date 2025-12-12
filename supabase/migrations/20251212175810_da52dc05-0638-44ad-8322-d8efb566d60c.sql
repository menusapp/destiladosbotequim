-- Adicionar índice único para telefone por restaurante (permitindo NULL)
CREATE UNIQUE INDEX IF NOT EXISTS customers_restaurant_phone_unique 
ON public.customers (restaurant_id, phone) 
WHERE phone IS NOT NULL;