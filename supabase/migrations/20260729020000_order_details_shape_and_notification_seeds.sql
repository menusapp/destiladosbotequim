-- =====================================================================
-- 1) get_order_details: devolve os itens no FORMATO que as telas esperam
-- ---------------------------------------------------------------------
-- A página de acompanhamento do pedido (e a tela de fidelidade) leem
-- `order_items[].products.name` e `order_items[].order_item_extras`, mas a
-- RPC devolvia a chave `items` com linhas cruas (sem nome do produto).
-- Resultado: "Detalhes do Pedido" zerado (subtotal/total R$ 0,00).
-- Agora devolve `order_items` enriquecido (nome/imagem do produto + extras
-- com nome) e mantém `items`/`extras` como aliases de compatibilidade.
-- =====================================================================
SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_order_details(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH enriched AS (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(oi)
      || jsonb_build_object(
        'products', (
          SELECT jsonb_build_object('name', p.name, 'image_url', p.image_url)
          FROM public.products p WHERE p.id = oi.product_id
        ),
        'order_item_extras', COALESCE((
          SELECT jsonb_agg(
            to_jsonb(oie)
            || jsonb_build_object(
              'product_extras', (
                SELECT jsonb_build_object('name', pe.name)
                FROM public.product_extras pe WHERE pe.id = oie.product_extra_id
              )
            )
          )
          FROM public.order_item_extras oie WHERE oie.order_item_id = oi.id
        ), '[]'::jsonb),
        'extras', COALESCE((
          SELECT jsonb_agg(to_jsonb(oie2))
          FROM public.order_item_extras oie2 WHERE oie2.order_item_id = oi.id
        ), '[]'::jsonb)
      )
    ), '[]'::jsonb) AS arr
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  )
  SELECT to_jsonb(o) || jsonb_build_object(
    'order_items', (SELECT arr FROM enriched),
    'items',       (SELECT arr FROM enriched)
  )
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.restaurant_id = public.default_restaurant_id()
$$;

GRANT EXECUTE ON FUNCTION public.get_order_details(uuid) TO anon, authenticated;

-- =====================================================================
-- 2) Templates de notificação WhatsApp: semeia os que faltam
-- ---------------------------------------------------------------------
-- O restaurante foi criado DEPOIS das migrations que semearam os templates
-- por status — sem linha em whatsapp_notification_configs, a edge function
-- retorna 'notification_disabled' e NENHUMA mensagem de status sai (embora
-- campanhas funcionem, pois não passam por esses templates).
-- Semeia os 6 tipos para qualquer restaurante que não os tenha.
-- =====================================================================
INSERT INTO public.whatsapp_notification_configs
  (restaurant_id, notification_type, is_active, template_message, send_delay_minutes)
SELECT r.id, t.type, true, t.template, 0
FROM public.restaurants r
CROSS JOIN (VALUES
  ('order_accepted',         E'✅ Olá {{nome}}! Seu pedido foi aceito e está sendo preparado.\n\n{{resumo_pedido}}\n\n⏱️ Tempo estimado: {{tempo_estimado}} minutos.'),
  ('order_preparing',        E'👨‍🍳 Olá {{nome}}! Seu pedido #{{numero_pedido}} está em preparo!\n\n⏱️ Tempo estimado: {{tempo_estimado}} minutos.'),
  ('order_out_for_delivery', E'🚗 Olá {{nome}}! Seu pedido #{{numero_pedido}} saiu para entrega / está pronto para retirada!'),
  ('order_ready_pickup',     E'📦 Olá {{nome}}! Seu pedido #{{numero_pedido}} está pronto para retirada! Aguardamos você! 😊'),
  ('order_cancelled',        E'❌ Olá {{nome}}, infelizmente seu pedido #{{numero_pedido}} foi cancelado. Motivo: {{motivo}}'),
  ('order_delivered',        E'🎉 Pedido #{{numero_pedido}} finalizado! Obrigado, {{nome}}! Avalie sua experiência: {{link_avaliacao}}')
) AS t(type, template)
ON CONFLICT (restaurant_id, notification_type) DO NOTHING;
