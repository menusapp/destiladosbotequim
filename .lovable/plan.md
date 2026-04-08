

# Atendente Virtual IA — Nova aba "Robô Menu's" + Renomear aba WhatsApp

## Resumo
Criar nova aba independente "Robô Menu's" no menu lateral com toda a funcionalidade do Atendente Virtual IA. Renomear a aba existente "Automação WhatsApp" para "Notificações WhatsApp". Remover a sub-aba "Atendente Virtual" do WhatsAppSettings (se existir).

## Detalhes Técnicos

### 1. Migration SQL
Criar 3 tabelas (mesmo plano anterior):
- **`whatsapp_ai_config`** — is_active, accept_orders_via_whatsapp, personality, welcome_message_type, custom_welcome_message, instructions. UNIQUE(restaurant_id). RLS USING(true).
- **`whatsapp_menu_options`** — position, label, action_type, custom_message, is_active. UNIQUE(restaurant_id, position). RLS USING(true).
- **`whatsapp_conversations`** — customer_phone, current_step, order_draft jsonb, last_message_at. UNIQUE(restaurant_id, customer_phone). RLS USING(true).

### 2. Edge Function `whatsapp-ai-bot`
Mesmo plano: processa mensagens recebidas, mantém estado de conversa, usa Lovable AI para respostas naturais, envia via `whatsapp-send`.

### 3. Webhook `whatsapp-webhook`
Adicionar chamada ao bot no case `messages.upsert` (ignorar fromMe).

### 4. Nova aba no sidebar — `AppSidebar.tsx`
Adicionar item no menu principal (não em configSubItems):
```
{ id: "robo-menus", label: "Robô Menu's", icon: Bot }
```
Posicionar após Marketing ou Fidelidade.

### 5. Renomear aba — `AppSidebar.tsx`
Mudar `config-whatsapp` label de `"Automação WhatsApp"` para `"Notificações WhatsApp"`.

### 6. Novo componente `RoboMenusTab.tsx`
Componente dedicado com toda a UI do Atendente Virtual:
- Banners de aviso (WhatsApp desconectado / IA desativada)
- Toggle "IA Ativa" + "Aceitar Pedidos via WhatsApp"
- Grid 2x2 de personalidades
- Radio group tipo de boas-vindas (4 opções)
- Editor de menu numérico (lista editável com add/remove)
- Textarea de instruções
- Simulador de conversa (mini chat)
- Botão "Salvar Alterações"

### 7. `RestaurantAdmin.tsx`
- Importar lazy `RoboMenusTab`
- Adicionar case `"robo-menus"` no switch de renderização
- Manter `config-whatsapp` apontando para `WhatsAppSettings` (agora "Notificações WhatsApp")

### 8. `supabase/config.toml`
Adicionar `[functions.whatsapp-ai-bot]` com `verify_jwt = false`.

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar 3 tabelas + RLS |
| `supabase/functions/whatsapp-ai-bot/index.ts` | **Novo** — cérebro do bot |
| `supabase/functions/whatsapp-webhook/index.ts` | Chamar bot em `messages.upsert` |
| `src/components/admin/RoboMenusTab.tsx` | **Novo** — UI completa do Atendente Virtual |
| `src/components/admin/AppSidebar.tsx` | Adicionar "Robô Menu's" + renomear "Notificações WhatsApp" |
| `src/pages/RestaurantAdmin.tsx` | Registrar nova aba |
| `supabase/config.toml` | Registrar nova function |

## O que NÃO muda
- `WhatsAppSettings.tsx` — permanece com sub-abas Cliente, Dono, Reservas
- Fluxo de pedidos, fiscal, iFood, Delivery Direto
- Edge functions existentes

