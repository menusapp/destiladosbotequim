-- Limpa dd_scheduled_for de pedidos iFood que não eram realmente agendados.
-- Heurística: se dd_scheduled_for ficou a menos de 2h do created_at,
-- era apenas o ETA (tempo estimado), não um agendamento real.
UPDATE public.orders
SET dd_scheduled_for = NULL
WHERE ifood_source = true
  AND dd_scheduled_for IS NOT NULL
  AND dd_scheduled_for - created_at < interval '2 hours';
