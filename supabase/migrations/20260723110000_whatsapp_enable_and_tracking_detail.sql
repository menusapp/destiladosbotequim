-- =====================================================================
-- 1) WHATSAPP: garante enabled=true onde a instância já está conectada.
--    (O connect atual já auto-liga, mas linhas antigas podem ter ficado
--    com enabled=false — o que bloqueava envio de teste, notificações por
--    status e mostrava o alerta vermelho no Marketing.)
-- =====================================================================
UPDATE public.whatsapp_config
   SET enabled = true, updated_at = now()
 WHERE instance_status IN ('connected', 'open')
   AND enabled IS DISTINCT FROM true;

-- =====================================================================
-- 2) FUNIL DETALHADO: a sessão do cliente passa a registrar também o
--    cupom aplicado, o endereço informado e o tipo de entrega — para o
--    painel de Rastreamento mostrar exatamente onde e com o quê o cliente
--    parou (itens, desconto, endereço).
-- =====================================================================
ALTER TABLE public.customer_sessions
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_type text;
