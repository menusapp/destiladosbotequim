

# Plano Completo -- Corrigir Integração Delivery Direto

## Problemas Identificados (da API docs oficial)

1. **Valores em centavos**: A API retorna precos em centavos (`value: 1000` = R$10,00). O codigo usa diretamente sem dividir por 100. Por isso R$3,00 de taxa de entrega aparece como R$300,00.

2. **Forma de pagamento generica**: O codigo salva "Delivery Direto" fixo em vez de mapear `payment.type` (ONLINE/OFFLINE) e `payment.paymentDetails.type` (CREDITCARD/PIX/CASH etc).

3. **Tipo de pedido errado**: `TAKEOUT` vira `"retirada"` que viola a constraint do banco (`order_type` so aceita `local` ou `delivery`). Ja identificado antes mas o `delivery_type` tambem precisa ser `"pickup"` e nao `"retirada"`.

4. **Itens nao linkados**: Os itens vem com `item.name`, `item.customCode` e `item.id` do DD, mas o codigo salva `product_id: null`. Precisa tentar casar via `customCode` -> campo da tabela `products`.

5. **Status nao sincroniza do sistema para o DD**: O `dd-order-action` usa endpoints `/orders/{id}/confirm`, `/orders/{id}/cancel` etc, mas a API oficial usa `PUT /admin-api/v1/orders/{id}` com body `{ "status": "APPROVED" }`. Os endpoints atuais provavelmente nao existem.

6. **Pedidos agendados**: A API retorna campo `scheduling` com ISO datetime. O sistema ignora completamente.

7. **Motivo de cancelamento**: A API aceita `statusReason` ao recusar. O sistema nao pede motivo.

---

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts` -- Correcoes criticas

**Valores em centavos** (dividir por 100):
```text
deliveryFee = (values.deliveryFee?.value || 0) / 100
price_at_order = (item.totalPrice?.value || 0) / 100 / item.amount
```

**Forma de pagamento correta**:
```text
payment.type === "ONLINE" -> "Pago Delivery Direto"
payment.type === "OFFLINE" + paymentDetails.type:
  "CASH" -> "Dinheiro"
  "CREDITCARD" -> "Cartão" (+ buscar bandeira se disponivel)
  "DEBITCARD" -> "Cartão de Débito"
  "PIX" -> "PIX"
  "MEAL_VOUCHER" -> "Vale Refeição"
  fallback -> paymentDetails.type ou "Delivery Direto"
```

**Tipo de pedido correto**:
```text
order_type: "delivery" (sempre, para pedidos DD)
delivery_type: type === "TAKEOUT" ? "pickup" : "delivery"
```

**Matching de itens por customCode**:
- Para cada item DD, buscar `products` onde `pdv_code = item.item.customCode` ou `name ILIKE item.item.name`
- Se encontrar, salvar `product_id` no `order_items`
- Se nao encontrar, salvar `product_id: null` com nome no campo `notes`

**Pedidos agendados**:
- Salvar campo `scheduling` do DD na coluna `dd_scheduled_for` (nova) da tabela `orders`
- O polling importa normalmente, apenas adicionando a data de agendamento

**Item name no notes**:
- Sempre salvar `item.item.name` no campo `notes` do `order_items` para referencia

### 2. Migration SQL -- Novas colunas

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dd_scheduled_for timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
```

### 3. `supabase/functions/dd-order-action/index.ts` -- Corrigir endpoint

Mudar de endpoints inexistentes (`/orders/{id}/confirm`) para o endpoint oficial:
```text
PUT /admin-api/v1/orders/{dd_order_id}
Body: { "status": "APPROVED" }  // ou CANCELLED, etc.
```

Mapeamento de acoes:
```text
accept   -> { status: "APPROVED" }
reject   -> { status: "CANCELLED", statusReason: motivo }
ready    -> { status: "READY" }
dispatch -> { status: "DISPATCHED" }
deliver  -> { status: "DONE" }
```

Incluir `statusReason` no body quando a acao for `reject`.

### 4. `src/components/admin/OrderDetailModal.tsx` -- Sincronizacao bidirecional + motivo cancelamento

**Sincronizar com DD ao mudar status**:
- No `updateStatus`, se `order.dd_source && order.dd_order_id`, chamar `dd-order-action` com a acao correspondente (identico ao fluxo iFood ja existente)
- Mapeamento: `accepted` -> `accept`, `preparing` -> `accept`, `out_for_delivery` -> `dispatch`, `delivered` -> `deliver`, `cancelled` -> `reject`

**Campo motivo de cancelamento**:
- Ao clicar em "Cancelar", abrir um Dialog/modal perguntando o motivo (campo texto obrigatorio)
- Enviar motivo para `dd-order-action` como `reason`
- Salvar motivo na coluna `cancellation_reason` da tabela `orders`
- Funciona para TODOS os pedidos, nao apenas DD

**Adicionar `dd_source` e `dd_order_id` na interface Order** do OrderDetailModal (ja existe no UnifiedOrdersTab mas falta aqui).

### 5. `src/components/admin/UnifiedOrdersTab.tsx` -- Badge agendado + pickup

**Badge de agendado**:
- Se `order.dd_scheduled_for` nao for null, exibir tag amarela/laranja com icone de relogio: "Agendado HH:mm" 
- Tag bem visivel no card do Kanban, ao lado do badge "Delivery Direto"

**Retirada no filtro**:
- Garantir que `delivery_type: "pickup"` aparece na aba "Retirada" (ja esta, verificar)

**Buscar dd_scheduled_for no fetchOrders**:
- Adicionar `dd_scheduled_for` na query select

### 6. `src/lib/printOrder.ts` -- Agendado na impressao

- Se `dd_scheduled_for` existir, imprimir linha em destaque: "PEDIDO AGENDADO PARA: dd/MM HH:mm"
- Se tiver motivo de cancelamento, imprimir tambem

### 7. Adicionar coluna `pdv_code` na tabela `products` (se nao existir)

- Verificar se ja existe algum campo tipo `pdv_code` ou `custom_code` na tabela products
- Se nao existir, criar migration para adicionar `pdv_code TEXT` para permitir matching com o `customCode` do DD

---

## Arquivos Alterados

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/functions/dd-polling/index.ts` | Editar | Dividir centavos, mapear pagamento, matching itens, agendamento |
| `supabase/functions/dd-order-action/index.ts` | Editar | Usar PUT com status body, aceitar reason |
| `src/components/admin/OrderDetailModal.tsx` | Editar | Chamar dd-order-action, modal cancelamento, campos dd_source |
| `src/components/admin/UnifiedOrdersTab.tsx` | Editar | Badge agendado, buscar dd_scheduled_for |
| `src/lib/printOrder.ts` | Editar | Imprimir agendamento |
| Migration SQL | Novo | Colunas dd_scheduled_for, cancellation_reason |

Nenhuma funcionalidade existente sera alterada ou removida. Fluxo iFood, pedidos locais, PDV, mesas -- tudo permanece identico.

