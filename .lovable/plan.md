

# Corrigir Itens Vazios: Usar GET /orders/{id} para Detalhe do Pedido

## Diagnostico Definitivo (dos Logs Reais)

Os logs confirmam TUDO:

```text
GET /admin-api/v1/orders  ->  retorna pedidos COM "items":[] (VAZIO)
GET /admin-api/v1/kds/orders  ->  retorna 0 pedidos (KDS so mostra pedidos aprovados/preparando)
GET /admin-api/v1/kds/order?orderId=69572069  ->  falha silenciosa (sem log de resultado)
GET /admin-api/v1/orders/69572069/items  ->  404 "Nao encontrado"
```

O que NUNCA foi tentado: **`GET /admin-api/v1/orders/{id}`** (detalhe individual do pedido). A documentacao admin-api tem `PUT /admin-api/v1/orders/{id}` documentado -- se PUT existe nesse path, GET tambem deve existir. O Gemini confirmou: "usar o endpoint de buscar detalhes do pedido (GET /orders/{orderId})".

Pagamento ja funciona: `paymentMethod.name` = "Visa (credito)" mapeia corretamente para "Cartao de Credito Visa".

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts`

**Substituir busca de detalhe KDS por GET /orders/{id}**:

Ao encontrar pedido novo, em vez de tentar `/kds/order?orderId=X` e depois `/orders/X/items`:
- Tentar: `GET /admin-api/v1/orders/{id}` (detalhe individual do pedido via Orders API)
- Logar resposta completa para descobrir estrutura exata dos items
- Se items vierem como array, usar campo `customCode` ou `pdvCode` para matching
- KDS endpoint removido completamente do fluxo de polling
- Remover tambem fallback `/orders/{id}/items` (retorna 404 confirmado)

**Manter tudo que ja funciona**: listing via `/admin-api/v1/orders`, parsing de `paymentMethod.name`, valores em centavos, customer info, delivery_fee.

### 2. `supabase/functions/dd-order-action/index.ts`

**Usar PUT /orders/{id} (Orders API, NAO KDS)**:

A documentacao admin-api confirma: `PUT /admin-api/v1/orders/{id}` - "Atualiza o status de um pedido".

Mudar de `PUT /kds/orders/{id}` para `PUT /orders/{id}`. Os status do pedido (nao KDS) sao:
- accept -> `APPROVED`
- dispatch -> `DISPATCHED` (ou `IN_TRANSIT` baseado em `operationTime.inTransitTime`)
- deliver -> `DONE`
- reject -> `CANCELLED` (com `statusReason`)

Se `PUT /orders/{id}` retornar 400 ou 404, tentar como fallback o body com campo `status` como string simples.

### 3. Nenhuma outra alteracao

- `dd-auth` -- sem alteracao (funciona)
- UI -- sem alteracao
- Pagamento -- sem alteracao (funciona)

## Resumo Tecnico

| Arquivo | De | Para |
|---------|-----|------|
| dd-polling | `GET /kds/order?orderId=X` + `GET /orders/X/items` | `GET /orders/{id}` |
| dd-order-action | `PUT /kds/orders/{id}` | `PUT /orders/{id}` |

Duas mudancas de URL. Nenhuma funcionalidade existente alterada.

