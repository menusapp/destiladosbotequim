

## Plano: Pedido só entra no sistema após pagamento confirmado + Origem "Totem"

### Problema 1: Pedido aparece antes de pagar
O fluxo atual em `KioskPayment.tsx` chama `createOrderInDB()` **antes** de enviar a cobrança para a maquininha. Mesmo com `payment_status: "awaiting_payment"`, o pedido já aparece no painel admin e dispara notificações.

### Solução 1: Inverter a ordem — cobrar primeiro, criar pedido depois
Em `handlePointPayment`:
1. **Primeiro**: enviar a cobrança para a maquininha (sem criar pedido no DB)
2. **Polling**: aguardar confirmação de pagamento
3. **Só após pagamento confirmado**: chamar `createOrderInDB()` com `payment_status: "paid"`, `payment_type` e `payment_brand` já preenchidos
4. Se o pagamento for cancelado/recusado/timeout: **nenhum pedido é criado** — descartado silenciosamente

Mudanças em `src/components/kiosk/KioskPayment.tsx`:
- `handlePointPayment`: não chama mais `createOrderInDB()` primeiro. Gera um UUID temporário para idempotency_key, envia para maquininha, e no polling de sucesso cria o pedido
- `startPointPolling`: no callback de sucesso (`accredited`/`approved`), chama `createOrderInDB()` com pagamento já confirmado e depois `onOrderCreated(orderId)`
- Se cancelado/falhou: não cria nada no DB

### Problema 2: Origem mostra "Balcão" em vez de "Totem"
O `OrderDetailModal.tsx` tem sua própria função `getOrderOrigin()` que verifica `order.order_type === "balcao"` e retorna "Balcão" **antes** de verificar `order_channel`. Totem com modo "counter" envia `order_type: "balcao"`, então cai nessa condição.

### Solução 2: Usar o helper compartilhado
Em `src/components/admin/OrderDetailModal.tsx`:
- Substituir a função local `getOrderOrigin()` pelo import de `getOrderOriginLabel` de `@/lib/orderOrigin.ts`
- Também atualizar `orderOrigin.ts` para verificar `order_channel === "totem"` **antes** de qualquer check de `order_type`, garantindo que totem sempre aparece como "Totem"

### Arquivos
- **`src/components/kiosk/KioskPayment.tsx`** — inverter fluxo: cobrar primeiro, criar pedido só após confirmação
- **`src/components/admin/OrderDetailModal.tsx`** — usar `getOrderOriginLabel` do helper compartilhado
- **`src/lib/orderOrigin.ts`** — já trata `order_channel === "totem"` corretamente (sem mudança necessária)

