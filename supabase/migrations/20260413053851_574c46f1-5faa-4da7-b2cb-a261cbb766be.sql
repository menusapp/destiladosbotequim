-- Backfill: copy legacy whatsapp_config.message_* to whatsapp_notification_configs
-- Only inserts if a config for that restaurant+type doesn't already exist

INSERT INTO whatsapp_notification_configs (restaurant_id, notification_type, is_active, template_message, send_delay_minutes)
SELECT wc.restaurant_id, t.notification_type, true, t.template_message, 0
FROM whatsapp_config wc
CROSS JOIN LATERAL (
  VALUES
    ('order_accepted', COALESCE(
      wc.message_accepted,
      '✅ Olá {{nome}}! Seu pedido #{{numero_pedido}} foi aceito e está sendo preparado. Tempo estimado: {{tempo_estimado}} minutos.'
    )),
    ('order_out_for_delivery', COALESCE(
      wc.message_out_for_delivery,
      '🚗 Olá {{nome}}! Seu pedido #{{numero_pedido}} saiu para entrega / está pronto para retirada!'
    )),
    ('order_cancelled', COALESCE(
      wc.message_cancelled,
      '❌ Olá {{nome}}, infelizmente seu pedido #{{numero_pedido}} foi cancelado. Motivo: {{motivo}}'
    )),
    ('order_delivered', COALESCE(
      wc.message_delivered,
      '🎉 Pedido #{{numero_pedido}} finalizado! Obrigado, {{nome}}! Avalie sua experiência: {{link_avaliacao}}'
    ))
) AS t(notification_type, template_message)
ON CONFLICT (restaurant_id, notification_type) DO NOTHING;