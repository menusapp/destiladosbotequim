

# Central de Notificações WhatsApp + Resumos do Caixa para o Dono

## Resumo
Reestruturar a aba "Automação WhatsApp" com duas sub-abas: "Para o Cliente" (notificações de status de pedido, avaliação, recuperação de carrinho) e "Para o Dono" (resumos de caixa e resumo diário). Criar tabelas, edge function centralizadora e integrar nos fluxos existentes.

## Detalhes Técnicos

### 1. Migration SQL

Criar duas tabelas novas:

**`whatsapp_notification_configs`** — configuração por tipo de notificação (order_accepted, order_delivered, order_cancelled, cart_recovery, daily_summary, cashier_open, cashier_close). Campos: restaurant_id, notification_type, is_active, template_message, send_delay_minutes. UNIQUE(restaurant_id, notification_type). RLS com USING(true) (arquitetura anon).

**`owner_notification_config`** — dados do dono: owner_name, owner_phone, toggles receive_cashier_open/close/daily_summary, daily_summary_time. UNIQUE em restaurant_id.

Inserir templates padrão via trigger ou inserção manual ao criar config do restaurante (não necessário — o frontend fará upsert com defaults na primeira carga).

### 2. Edge Function `whatsapp-notifications`

Nova edge function que recebe `{ restaurant_id, notification_type, context }`:

- Busca config da notificação em `whatsapp_notification_configs` — se `is_active = false`, retorna sem enviar
- Busca template_message e substitui variáveis (`{{nome}}`, `{{numero_pedido}}`, `{{total}}`, etc.) com dados do `context`
- Para tipos de cliente: envia para o telefone do cliente via `whatsapp-send` existente
- Para tipos de dono (cashier_open, cashier_close, daily_summary): busca `owner_notification_config` e envia para `owner_phone`
- Verifica se WhatsApp está conectado (`whatsapp_config.instance_status = 'connected'`) antes de enviar

### 3. Integrar nos Fluxos Existentes

**`useOrderStatusAdvance.ts`** — Após `sendWhatsAppNotification` existente (que já funciona para pedidos), adicionar chamada fire-and-forget para `whatsapp-notifications` com os tipos correspondentes. A lógica existente de WhatsApp para pedidos já funciona via `whatsapp_config` — a nova edge function será usada **apenas** para os novos tipos (avaliação pós-entrega, recuperação de carrinho, notificações do dono).

**`FluxoCaixaTab.tsx`** — Após `handleOpenCashRegister` e `handleCloseCashRegister` com sucesso, invocar `whatsapp-notifications` com tipo `cashier_open` / `cashier_close` e context com dados do caixa (operador, valores, número de pedidos, ticket médio).

### 4. Frontend — Reestruturar `WhatsAppSettings.tsx`

Manter o bloco de Status da Conexão e Enable Automation no topo. Abaixo, adicionar `Tabs` com duas sub-abas:

**Sub-aba "Para o Cliente"**:
- Cards para cada tipo: Confirmação (order_accepted), Saída/Pronto (order_out_for_delivery), Cancelamento (order_cancelled), Pedir Avaliação (order_delivered), Recuperação de Carrinho (cart_recovery)
- Cada card tem: toggle ativar/desativar, botão "Editar Template" que expande/abre inline textarea, variáveis disponíveis listadas
- Recuperação de Carrinho: campo numérico para delay em minutos
- Dados carregados/salvos em `whatsapp_notification_configs`

**Sub-aba "Para o Dono"**:
- Campos nome e telefone do dono (máscara)
- Cards: Resumo Abertura Caixa, Resumo Fechamento Caixa, Resumo Diário
- Cada card: toggle + template editável com variáveis
- Resumo Diário: time picker para horário de envio
- Salvar em `owner_notification_config`

### 5. Página de Avaliação (já existe)

A página de avaliação já existe em `OrderConfirmation.tsx` com `ReviewModal`. O link `{{link_avaliacao}}` apontará para `/{slug}/pedido-confirmado/{orderId}` que já tem o fluxo de review. Não precisa criar página nova.

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar `whatsapp_notification_configs` e `owner_notification_config` |
| `supabase/functions/whatsapp-notifications/index.ts` | **Novo** — edge function centralizadora |
| `src/components/admin/settings/WhatsAppSettings.tsx` | Reestruturar com sub-abas Cliente/Dono |
| `src/components/admin/FluxoCaixaTab.tsx` | Chamar whatsapp-notifications ao abrir/fechar caixa |
| `src/hooks/useOrderStatusAdvance.ts` | Adicionar chamada para avaliação pós-entrega |

## O que NÃO muda
- Fluxo de pedidos, fiscal, iFood, Delivery Direto
- WhatsApp de reservas (continua na seção atual)
- Edge functions existentes (whatsapp-send, whatsapp-instance)
- Estrutura de tabelas existentes

