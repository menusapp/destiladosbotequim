-- Adicionar novos templates de mensagem WhatsApp
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS message_ready_for_pickup TEXT DEFAULT 'Seu pedido #{pedido} está pronto para retirada! 🎉 Aguardamos você!',
ADD COLUMN IF NOT EXISTS message_picked_up TEXT DEFAULT 'Pedido #{pedido} retirado com sucesso! Obrigado pela preferência, {nome}! 🙏',
ADD COLUMN IF NOT EXISTS message_cancelled TEXT DEFAULT 'Olá {nome}, infelizmente seu pedido #{pedido} foi cancelado. Entre em contato conosco para mais informações.';