

## Plano de Execucao: Integracao iFood

### Pre-requisito: Secrets

Antes de qualquer codigo, preciso solicitar dois secrets:
- `IFOOD_CLIENT_ID`
- `IFOOD_CLIENT_SECRET`

---

### 1. Banco de Dados (Migration)

**Nova tabela `ifood_config`:**
```sql
CREATE TABLE public.ifood_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  enabled boolean DEFAULT false,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  merchant_id text,
  authorization_code_verifier text,
  last_polling_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ifood_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on ifood_config" ON public.ifood_config FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
```

**Campos novos na tabela `orders`:**
```sql
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ifood_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ifood_source boolean DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS orders_ifood_order_id_unique ON public.orders (ifood_order_id) WHERE ifood_order_id IS NOT NULL;
```

**Risco de regressao:** ZERO. Nova tabela isolada + campos novos nullable com default. Nenhum campo existente alterado.

---

### 2. Edge Functions (4 novas)

Todas seguem o padrao exato do `whatsapp-send` (corsHeaders com ALLOWED_ORIGIN, createClient com service role, try/catch, JSON responses). Nenhuma funcao existente sera alterada.

**`ifood-auth`** — POST com `action`:
- `generate_code`: gera `authorizationCodeVerifier` (random string), salva na `ifood_config`, chama `POST /authentication/v1.0/oauth/userCode` com `clientId` do env, retorna `userCode` + `verificationUrl` + `verificationUrlComplete` para o frontend exibir
- `exchange_token`: recebe `authorizationCode` do usuario, busca `authorizationCodeVerifier` do banco, chama `POST /authentication/v1.0/oauth/token` com `grant_type=authorization_code`, salva `access_token`, `refresh_token`, `token_expires_at` na `ifood_config`

**`ifood-refresh-token`** — POST com `restaurant_id`:
- Busca `refresh_token` da `ifood_config`, chama `POST /authentication/v1.0/oauth/token` com `grant_type=refresh_token`, atualiza tokens no banco. Se falhar, retorna erro 401 indicando reconexao necessaria.

**`ifood-polling`** — POST com `restaurant_id`:
- Busca token da `ifood_config`, verifica validade (>30min). Chama `GET /events/v1.0/events:polling` com header `X-Polling-Merchants: {merchant_id}`. Para eventos tipo `PLACED`, busca detalhes do pedido em `GET /order/v1.0/orders/{orderId}` e insere na tabela `orders` com `ifood_source=true`, `ifood_order_id`, `order_type='delivery'`, `delivery_type='delivery'`. Usa `ON CONFLICT (ifood_order_id) DO NOTHING` para evitar duplicatas. Apos processar, chama `POST /events/v1.0/events/acknowledgment` com os IDs dos eventos.

**`ifood-order-action`** — POST com `restaurant_id`, `ifood_order_id`, `order_id`, `action`:
- Busca token, chama endpoint da API iFood correspondente a acao. Mapeamento: `confirm` → POST `/order/v1.0/orders/{id}/confirm`, `start_preparation` → POST `/order/v1.0/orders/{id}/startPreparation`, `ready_to_pickup` → POST `/order/v1.0/orders/{id}/readyToPickup`, `dispatch` → POST `/order/v1.0/orders/{id}/dispatch`, `cancel` → POST `/order/v1.0/orders/{id}/cancelRequest`, `get_cancellation_reasons` → GET `/order/v1.0/orders/{id}/cancellationReasons`. Apos sucesso, atualiza status na tabela `orders`.

**`supabase/config.toml`** — Adicionar blocos `verify_jwt = false` para as 4 funcoes.

**Risco de regressao:** ZERO. Funcoes novas independentes.

---

### 3. Tela de Integracoes

**Novo componente `src/components/admin/IntegrationsTab.tsx`:**
- Grid com 2 cards: iFood (funcional) e Delivery Direto (badge "Em breve", desabilitado)
- Card iFood ao clicar abre Sheet lateral (padrao do projeto)
- Estado nao conectado: 3 passos de instrucao, botao "Gerar Codigo", campo para colar `authorizationCode`, botao "Conectar"
- Estado conectado: badge verde, merchant ID mascarado, Switch habilitar/desabilitar, botao "Desconectar"
- Segue estrutura visual do `WhatsAppSettings.tsx`

**Risco de regressao:** ZERO. Componente novo isolado.

---

### 4. Alteracoes no UnifiedOrdersTab.tsx

Duas mudancas cirurgicas:

1. **Query** (linha 118): adicionar `ifood_source, ifood_order_id` ao select existente
2. **Interface Order** (linhas 36-55): adicionar `ifood_source?: boolean` e `ifood_order_id?: string`
3. **Badge iFood** no `renderOrderCard`: se `order.ifood_source`, exibir `<Badge className="bg-[#EA1D2C] text-white text-[10px]">iFood</Badge>`
4. **Polling useEffect**: intervalo de 30s chamando `ifood-polling`. Se 401, chama `ifood-refresh-token` e retenta. Cleanup no return.

**Risco de regressao:** MUITO BAIXO. Adicionar campos ao select nao afeta campos existentes. O badge e condicional. O polling e um useEffect independente. A interface aceita campos opcionais.

**Unica precaucao:** A tabela `orders` e tipada pelo Supabase types auto-gerado (`src/integrations/supabase/types.ts`). Apos a migration, os novos campos aparecerao no tipo. Ate la, usarei type assertion localizada para os 2 campos novos, sem alterar o types.ts.

---

### 5. Registro no Sistema

**`staffPermissions.ts`** (linha 24): adicionar `{ id: "integracoes", label: "Integracoes" }` ao final do array. Adicionar `"integracoes"` nos arrays de `admin` e `gerente` em `ROLE_DEFAULT_SECTIONS`.

**`useRestaurantModules.ts`** (linha 23): adicionar `"integracoes": "delivery"` ao mapeamento.

**`AppSidebar.tsx`** (linha 87-92): adicionar `{ id: "integracoes", label: "Integracoes", icon: Plug }` no grupo Administrativo.

**`RestaurantAdmin.tsx`**: importar `IntegrationsTab`, adicionar `case "integracoes": return <IntegrationsTab restaurantId={restaurant.id} />;` no switch (entre fiscal e modulos).

**Risco de regressao:** MUITO BAIXO. Apenas adicoes a arrays/switch existentes. Nenhum codigo existente modificado.

---

### Resumo de Arquivos

| Acao | Arquivo |
|---|---|
| Migration | Nova tabela `ifood_config` + 2 campos em `orders` |
| Criar | `supabase/functions/ifood-auth/index.ts` |
| Criar | `supabase/functions/ifood-refresh-token/index.ts` |
| Criar | `supabase/functions/ifood-polling/index.ts` |
| Criar | `supabase/functions/ifood-order-action/index.ts` |
| Criar | `src/components/admin/IntegrationsTab.tsx` |
| Editar | `supabase/config.toml` (4 blocos novos) |
| Editar | `src/components/admin/UnifiedOrdersTab.tsx` (query + badge + polling) |
| Editar | `src/components/admin/AppSidebar.tsx` (1 item novo) |
| Editar | `src/pages/RestaurantAdmin.tsx` (1 import + 1 case) |
| Editar | `src/lib/staffPermissions.ts` (1 item + 2 arrays) |
| Editar | `src/hooks/useRestaurantModules.ts` (1 mapeamento) |

### Funcionalidades existentes afetadas: NENHUMA

Todas as mudancas sao aditivas. Nenhum campo, query, componente ou logica existente sera modificado ou removido.

