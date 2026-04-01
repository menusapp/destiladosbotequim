

# Corrigir Itens Vazios e Status -- Endpoints Errados no Admin-API

## Diagnostico Definitivo (da OpenAPI oficial)

### Problema 1: Itens vazios -- URL do KDS detail ERRADA

O codigo atual busca detalhes do pedido com:
```text
GET /admin-api/v1/kds/orders/{id}    <-- ERRADO (este e o endpoint de PUT)
```

A OpenAPI oficial do admin-api mostra que o endpoint correto e:
```text
GET /admin-api/v1/kds/order?orderId={id}    <-- CORRETO (singular "order", query param)
```

O endpoint de lista KDS retorna os itens do pedido (schema `KdsorderDTO`). O endpoint `/kds/orders/{id}` so aceita PUT (para atualizar status). O GET com path param simplesmente nao existe, retorna 404 silenciosamente, e o codigo cai no fallback que tambem falha.

### Problema 2: Status 404 -- PUT no endpoint errado

O codigo usa:
```text
PUT /admin-api/v1/orders/{id}    <-- retorna 404 (HTML generico)
```

A OpenAPI mostra que o endpoint correto para atualizar status e:
```text
PUT /admin-api/v1/kds/orders/{id}    <-- CORRETO (KDS status update)
```

O `PUT /admin-api/v1/orders/{id}` pode existir mas retorna 404 porque a rota espera um formato diferente ou nao e funcional. O KDS PUT esta documentado e aceita `UpdateKdsorderStatusDTO`.

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts`

**Corrigir URL do detalhe KDS** (linha 263):
- DE: `GET ${DD_ADMIN_API}/kds/orders/${orderId}`
- PARA: `GET ${DD_ADMIN_API}/kds/order?orderId=${orderId}`
- Resposta sera `{ status: "success", data: { ...KdsorderDTO } }` com itens inclusos

**Corrigir fallback** (linha 274):
- Remover fallback para `GET /orders/${orderId}` (nao existe no admin-api como GET individual)
- Manter apenas o endpoint KDS correto

**Manter todo o resto identico**: parsing de items, payment mapping, valores em centavos, customer info, tudo permanece igual.

### 2. `supabase/functions/dd-order-action/index.ts`

**Corrigir endpoint de status** (linha 92):
- DE: `PUT ${DD_ADMIN_API}/orders/${dd_order_id}`
- PARA: `PUT ${DD_ADMIN_API}/kds/orders/${dd_order_id}`
- Mesmo body: `{ status: "APPROVED" }` etc.
- Manter mapeamento: accept->APPROVED, ready->READY, dispatch->DISPATCHED, deliver->DONE, reject->CANCELLED

### 3. Nenhuma outra alteracao

- `dd-auth/index.ts` -- sem alteracao (auth funciona)
- UI -- sem alteracao
- Pagamento -- sem alteracao (ja funciona correto)
- Valores -- sem alteracao (ja funciona correto)

## Resumo Tecnico

| Arquivo | Linha | De | Para |
|---------|-------|----|----|
| dd-polling | ~263 | `GET /kds/orders/${id}` | `GET /kds/order?orderId=${id}` |
| dd-polling | ~274 | fallback `GET /orders/${id}` | remover fallback |
| dd-order-action | ~92 | `PUT /orders/${id}` | `PUT /kds/orders/${id}` |

Duas correcoes de URL. Nenhuma funcionalidade existente alterada.

