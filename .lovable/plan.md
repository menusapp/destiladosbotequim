

## Plano Corrigido v2: Integração Mercado Pago Point no Totem (Orders API)

Todas as correções solicitadas foram incorporadas.

---

### 1. Migration — Tabelas e RPCs

**Tabela `point_terminals`:**
```sql
CREATE TABLE point_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_name text,
  operating_mode text DEFAULT 'PDV',
  is_active boolean DEFAULT true,
  use_on_kiosk boolean DEFAULT false,
  is_default_terminal boolean DEFAULT false,
  totem_id text,
  mp_store_id text,
  mp_pos_id text,
  mp_external_store_id text,
  mp_external_pos_id text,
  terminal_metadata jsonb,
  last_seen_at timestamptz,
  configured_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, device_id)
);
ALTER TABLE point_terminals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block_direct_access" ON point_terminals
  FOR ALL TO public USING (false) WITH CHECK (false);
```

**Tabela `point_order_payments`:**
```sql
CREATE TABLE point_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  mp_order_id text NOT NULL,
  mp_user_id text,
  terminal_id text NOT NULL,
  external_reference text,
  idempotency_key text NOT NULL,
  amount numeric NOT NULL,
  status text DEFAULT 'creating_payment',
  mp_status_payload jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE point_order_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "block_direct_access" ON point_order_payments
  FOR ALL TO public USING (false) WITH CHECK (false);
```

**Adicionar `token_expires_at` em `online_payment_config`:**
```sql
ALTER TABLE online_payment_config
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
```

**RPCs SECURITY DEFINER** para: get/upsert/delete `point_terminals` por restaurant_id, get/upsert `point_order_payments`, e check token expiry.

---

### 2. Edge Function — `mercadopago-point`

Actions e endpoints corretos da API moderna:

| Action | Endpoint MP | Notas |
|--------|-------------|-------|
| `list_terminals` | `GET /terminals/v1/list` | API moderna, NÃO `/point/integration-api/devices` |
| `create_store` | `POST /users/{user_id}/stores` | Obrigatório antes de associar terminal |
| `create_pos` | `POST /pos` | Obrigatório antes de associar terminal |
| `create_order` | `POST /v1/orders` | Com `X-Idempotency-Key` (UUID do pedido interno) |
| `get_order` | `GET /v1/orders/{order_id}` | Verifica `status` + `transaction.status` |
| `cancel_order` | `DELETE /v1/orders/{order_id}` | Chamado no timeout |
| `test_order` | Cria order de R$ 1,00 | Teste de integração |

**Correções obrigatórias aplicadas:**

1. **`X-Idempotency-Key`**: Enviado em toda `create_order`, usando o UUID do pedido interno. Retry seguro (1 tentativa) com mesma key.

2. **Validação dupla de status**: Confirmar pagamento apenas quando `order.status === "processed"` E `transaction.status_detail === "accredited"` (conforme docs atuais — o status final é `processed` com `status_detail: accredited`, não `finished`).

3. **`mp_user_id`**: Salvo em `point_order_payments` para isolamento por conta. Carregado de `online_payment_config.mp_user_id`.

4. **Token expirado**: Antes de qualquer chamada, verificar `token_expires_at`. Se expirado, retornar erro claro e bloquear operação.

5. **Logging estruturado**: Toda interação logada com `{ restaurant_id, order_id, mp_order_id, terminal_id, action, status, request_summary, response_summary }`.

6. **Cancel no timeout**: Endpoint `cancel_order` chamado pelo frontend quando timeout de 120s, edge function faz DELETE + atualiza `point_order_payments.status = 'canceled'`.

---

### 3. OAuth — Salvar `token_expires_at`

Editar `mercadopago-oauth/index.ts`: calcular `token_expires_at` a partir do `expires_in` retornado pelo MP e salvar junto com os tokens.

---

### 4. Webhook — Estender `mercadopago-webhook`

Adicionar tratamento para eventos de order do Point:
- Webhook envia `action: "order.processed"` com `data.id` = order ID
- Verificar `external_reference` contra pedidos do sistema
- Validar `status === "processed"` E `transactions.payments[0].status_detail === "accredited"`
- Atualizar `point_order_payments` e marcar pedido como pago

---

### 5. UI Admin — Seção "Maquininha" em KioskSettings

Pré-requisito: conta MP conectada + token não expirado.

Fluxo sequencial:
1. Buscar Terminais → `list_terminals`
2. Selecionar Terminal → salva via RPC
3. Criar Store (se necessário) → `create_store`
4. Criar POS → `create_pos`
5. Testar Cobrança → `test_order` (R$ 1,00)
6. Marcar como ativo → `use_on_kiosk = true`

Exibir: status da conexão, nome do terminal, alerta se token expira em <30 dias, botão reconectar.

---

### 6. Fluxo no Totem — KioskPayment

Nova opção "Pagar na Maquininha" (quando terminal configurado):

**Estados internos do pagamento:**
- `creating_payment` → chamando edge function
- `waiting_terminal` → order criada, aguardando terminal carregar
- `processing` → terminal processando
- `paid` → confirmado
- `failed` → erro ou recusa
- `canceled` → timeout ou cancelamento manual

**Fluxo:**
1. Cria pedido no banco (status `pending`)
2. Chama `create_order` com `X-Idempotency-Key = order.id`
3. Salva em `point_order_payments` com `mp_user_id`
4. Tela "Aguardando pagamento..." com spinner + status visual
5. Polling a cada 3s via `get_order`
6. `processed` + `accredited` → confirma pedido
7. Erro/recusa → mostra erro, permite retry (mesma idempotency key)
8. Timeout 120s → chama `cancel_order` no backend + atualiza banco + libera UI
9. Token expirado → bloqueia opção de maquininha, mostra aviso

---

### Arquivos

- **Migration**: `point_terminals`, `point_order_payments`, `token_expires_at`, RPCs
- **Criar**: `supabase/functions/mercadopago-point/index.ts`
- **Editar**: `supabase/functions/mercadopago-oauth/index.ts` — `token_expires_at`
- **Editar**: `supabase/functions/mercadopago-webhook/index.ts` — events Point
- **Editar**: `src/components/admin/settings/KioskSettings.tsx` — seção terminal
- **Editar**: `src/components/kiosk/KioskPayment.tsx` — maquininha + polling + estados
- **Editar**: `src/hooks/useKioskConfig.ts` — expor terminal configurado
- **Editar**: `supabase/config.toml` — `[functions.mercadopago-point] verify_jwt = false`

