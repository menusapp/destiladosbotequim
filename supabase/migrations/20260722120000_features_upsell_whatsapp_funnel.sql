-- =====================================================================
-- NOVAS FUNCIONALIDADES — Destilado Botequim
-- 1) Upsell por produto na sacola (product_upsells)
-- 2) WhatsApp: link de avaliação configurável + novos tipos de status
-- 3) Funil: etapa do checkout na sessão do cliente
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) UPSELL POR PRODUTO
--    "Quem adiciona o produto X na sacola vê o produto Y com desconto."
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_upsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  trigger_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  upsell_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_product_id, upsell_product_id),
  CHECK (trigger_product_id <> upsell_product_id)
);

ALTER TABLE public.product_upsells ENABLE ROW LEVEL SECURITY;

-- Catálogo público (a sacola do cliente anônimo precisa ler as ofertas);
-- escrita apenas do staff autenticado do restaurante.
CREATE POLICY "public_read" ON public.product_upsells
  FOR SELECT USING (is_active = true);
CREATE POLICY "staff_all" ON public.product_upsells
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE INDEX IF NOT EXISTS idx_product_upsells_trigger
  ON public.product_upsells (trigger_product_id) WHERE is_active;

-- ---------------------------------------------------------------------
-- 2) WHATSAPP
-- ---------------------------------------------------------------------
-- Link de avaliação (Google ou personalizado) usado em {{link_avaliacao}}.
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS review_link_url text;

-- Semeia os novos tipos de notificação para restaurantes existentes,
-- para que "Em preparo" e "Pronto para retirada" enviem mensagem sem
-- depender de o dono abrir e salvar as configurações primeiro.
INSERT INTO public.whatsapp_notification_configs
  (restaurant_id, notification_type, is_active, template_message, send_delay_minutes)
SELECT r.id, t.type, true, t.template, 0
FROM public.restaurants r
CROSS JOIN (VALUES
  ('order_preparing',
   '👨‍🍳 Olá {{nome}}! Seu pedido #{{numero_pedido}} está em preparo!' || E'\n\n' || '⏱️ Tempo estimado: {{tempo_estimado}} minutos.'),
  ('order_ready_pickup',
   '📦 Olá {{nome}}! Seu pedido #{{numero_pedido}} está pronto para retirada! Aguardamos você! 😊')
) AS t(type, template)
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_notification_configs w
  WHERE w.restaurant_id = r.id AND w.notification_type = t.type
);

-- ---------------------------------------------------------------------
-- 3) FUNIL — em que etapa do checkout o cliente parou
--    (sacola → tipo de entrega → endereço → pagamento → concluído)
-- ---------------------------------------------------------------------
ALTER TABLE public.customer_sessions
  ADD COLUMN IF NOT EXISTS checkout_step text;
