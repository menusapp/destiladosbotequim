

# Corrigir Integracao DD: Mudar de admin-api para store-api

## Problema Raiz

O codigo usa a `admin-api` do Delivery Direto que e uma API interna/KDS. A API correta documentada e a **store-api** (`/store-api/v1/`). Por isso:

1. **Itens vazios**: A admin-api lista pedidos sem itens. A store-api retorna pedidos COM itens completos (`items[].item.name`, `items[].item.customCode`, `items[].totalPrice`, etc.)
2. **Status nao sincroniza**: `PUT /admin-api/v1/orders/{id}` e `PUT /admin-api/v1/kds/orders/{id}` retornam 404. A store-api usa endpoints de acao: `POST /orders/{id}/approve`, `POST /orders/{id}/cancel`, etc.
3. **Pagamento generico**: A admin-api nao retorna `payment.type` e `payment.paymentDetails.type` corretamente. A store-api retorna o objeto `payment` completo.

## Evidencias da Documentacao Oficial

A store-api (https://developers.deliverydireto.com.br/store-api/docs/) documenta:

**Autenticacao**: `POST /store-api/token` com `client_credentials` ou `password` grant

**Pedido com itens**: Resposta do pedido inclui:
```text
{
  "items": [{
    "itemId": 123,
    "amount": 3,
    "totalPrice": { "value": 1000, "currency": "BRL" },
    "item": {
      "name": "Refrigerante Light",
      "customCode": "001",
      "price": { "value": 1000, "currency": "BRL" }
    }
  }],
  "payment": {
    "type": "ONLINE" | "OFFLINE",
    "paymentDetails": { "type": "CREDITCARD" | "PIX" | "CASH" | ... }
  }
}
```

**Cancelamento**: `DELETE /store-api/v1/customers/me/orders/{id}`

**Acoes de status** (padrao Open Delivery):
```text
POST /store-api/v1/orders/{id}/approve
POST /store-api/v1/orders/{id}/start-production
POST /store-api/v1/orders/{id}/ready-for-pickup
POST /store-api/v1/orders/{id}/dispatch
POST /store-api/v1/orders/{id}/deliver
POST /store-api/v1/orders/{id}/cancel   (body: { statusReason })
```

## Alteracoes

### 1. `supabase/functions/dd-auth/index.ts`

- Mudar token endpoint de `/admin-api/token` para `/store-api/token`
- Manter `client_credentials` grant (nao precisa username/password para token de loja)
- Manter headers `X-DeliveryDireto-Client-Id` e `X-DeliveryDireto-Id`
- Atualizar refresh_token para usar `/store-api/token` tambem
- Manter fluxo connect com `password` grant como fallback caso `client_credentials` nao funcione

### 2. `supabase/functions/dd-polling/index.ts` -- Rewrite completo da logica

**Base URL**: Mudar de `admin-api` para `store-api`

**Listagem de pedidos**: Usar `GET /store-api/v1/customers/me/orders?limit=30` (retorna pedidos com itens inclusos) OU tentar `GET /store-api/v1/orders?updatedAt[gte]=...` se disponivel para tokens de loja

**Para cada novo pedido, buscar detalhe**: `GET /store-api/v1/orders/{id}` que retorna items completos

**Buscar itens separadamente se necessario**: `GET /store-api/v1/orders/{id}/items`

**Pagamento correto** (baseado na documentacao):
```text
payment.type === "ONLINE" -> "Pago Delivery Direto"
payment.type === "OFFLINE":
  paymentDetails.type === "CASH" -> "Dinheiro"
  paymentDetails.type === "CREDITCARD" -> "Cartao de Credito" + brand
  paymentDetails.type === "DEBITCARD" -> "Cartao de Debito" + brand
  paymentDetails.type === "PIX" -> "PIX"
  paymentDetails.type === "MEAL_VOUCHER" -> "Vale Refeicao"
```

**Itens com matching por customCode**:
- `item.item.customCode` -> comparar com `products.pdv_code`
- `item.item.name` -> fallback por nome
- `item.totalPrice.value / 100` -> preco unitario

**Valores em centavos**: Todos os campos `Money` ({value, currency}) dividir value por 100

### 3. `supabase/functions/dd-order-action/index.ts` -- Endpoints corretos

Substituir `PUT /admin-api/v1/kds/orders/{id}` por endpoints de acao da store-api:

```text
accept     -> POST /store-api/v1/orders/{id}/approve
ready      -> POST /store-api/v1/orders/{id}/ready-for-pickup
dispatch   -> POST /store-api/v1/orders/{id}/dispatch
deliver    -> POST /store-api/v1/orders/{id}/deliver
reject     -> POST /store-api/v1/orders/{id}/cancel  (body: { statusReason: reason })
```

Mesmos headers de autenticacao. Nao precisa de body exceto para cancel.

### 4. Nenhuma alteracao em UI

Os componentes `OrderDetailModal.tsx`, `UnifiedOrdersTab.tsx`, e `printOrder.ts` ja foram corrigidos anteriormente e funcionam. Apenas as Edge Functions mudam.

## Arquivos Alterados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/dd-auth/index.ts` | Token endpoint: admin-api -> store-api |
| `supabase/functions/dd-polling/index.ts` | API surface: admin-api -> store-api, items inclusos, payment correto |
| `supabase/functions/dd-order-action/index.ts` | PUT generico -> POST /orders/{id}/approve etc |

Nenhuma funcionalidade existente alterada. iFood, pedidos locais, PDV, mesas -- tudo permanece identico.

