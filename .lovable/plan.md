

## Plano: Corrigir Integração MP Point — RPC + Edge Function + Polling

### Diagnóstico Confirmado

1. **A RPC `insert_point_order_payment` existe, MAS o `order_id` é `NOT NULL` com FK para `orders(id)`**. Quando o teste envia um UUID aleatório como `order_id`, o insert falha silenciosamente (FK violation). Por isso a tabela está vazia.

2. **O `list_pending_orders` usa endpoint errado**: `/point/integration-api/payment-intents/{deviceId}/events` — trata o `deviceId` como um `payment_intent_id`, retornando 404 "The intent NEWLAND... doesn't exist!".

3. **O payload do `create_order`** usa `/v1/orders` com `amount` como string — precisa verificar se o MP aceita ou se precisa do endpoint alternativo `/point/integration-api/payment-intents/{deviceId}`.

### Correções

**1. Migration — Tornar `order_id` nullable + adicionar `device_id` ao index**

```sql
ALTER TABLE point_order_payments ALTER COLUMN order_id DROP NOT NULL;
```

A RPC `insert_point_order_payment` já aceita `p_order_id uuid` — com a coluna nullable, o insert vai funcionar quando passamos um UUID fake (teste) ou NULL.

**2. Edge Function `mercadopago-point/index.ts`**

- **`createOrder`**: Tentar primeiro `/v1/orders` (atual). Se retornar erro, fazer fallback para `/point/integration-api/payment-intents/{deviceId}` com payload `{ amount: centavos, description, payment: { installments: 1, type: "credit_card" } }`. Logar qual endpoint funcionou.
- **`createOrder` RPC call**: Passar `null` como `p_order_id` para testes, e capturar/logar erro do RPC se falhar.
- **`listPendingOrders`**: Corrigir para usar `GET /point/integration-api/payment-intents?device_id={deviceId}` (query param, não path param). Buscar primeiro no banco local.
- **Logs melhorados**: Adicionar `[MP Point]` prefixo + log da resposta do RPC insert.

**3. KioskSettings — Polling de status após teste**

Após `test_order` retornar sucesso com `mp_order_id`:
- Iniciar polling a cada 3s chamando `get_order`
- Mostrar status: "Aguardando pagamento...", "Aprovado!", "Recusado", "Cancelado"
- Parar após status final ou timeout de 2 min

### Arquivos
- **Migration**: `ALTER TABLE point_order_payments ALTER COLUMN order_id DROP NOT NULL`
- **Editar**: `supabase/functions/mercadopago-point/index.ts` — fallback endpoint + fix listPending + logs
- **Editar**: `src/components/admin/settings/KioskSettings.tsx` — polling de status

