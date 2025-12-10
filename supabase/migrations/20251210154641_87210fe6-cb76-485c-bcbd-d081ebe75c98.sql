-- Habilitar Realtime para tabelas críticas do sistema
-- Isso permite que os listeners de realtime recebam eventos de INSERT, UPDATE e DELETE

ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;