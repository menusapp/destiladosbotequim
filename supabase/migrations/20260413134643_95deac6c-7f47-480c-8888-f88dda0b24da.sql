ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS bot_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS paused_reason text;