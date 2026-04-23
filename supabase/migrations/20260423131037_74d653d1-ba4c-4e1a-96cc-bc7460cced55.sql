UPDATE public.whatsapp_notification_configs
SET template_message = '✅ Olá {{nome}}! Seu pedido foi aceito e está sendo preparado.

{{resumo_pedido}}

⏱️ Tempo estimado: {{tempo_estimado}} minutos.'
WHERE notification_type = 'order_accepted'
  AND (
    template_message = '✅ Olá {{nome}}! Seu pedido #{{numero_pedido}} foi aceito e está sendo preparado. Tempo estimado: {{tempo_estimado}} minutos.'
    OR template_message = 'Seu pedido foi aceito e está em preparo!! 🍔'
  );