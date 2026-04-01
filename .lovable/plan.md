

# Corrigir dd-polling: Voltar para admin-api (API que FUNCIONAVA)

## Problema Raiz

Os logs mostram claramente:
```text
"Rede de lojas \"store-api\" não encontrada!"
URL: /store-api/v1/orders?updatedAt[gte]=...
```

A mudanca para `/store-api/token` quebrou tudo. A **store-api** e uma API de CLIENTE (para quem faz pedido), nao de LOJISTA. O endpoint `/store-api/v1/orders` NAO EXISTE na store-api - o unico endpoint de pedidos e `/store-api/v1/customers/me/orders` (pedidos do cliente logado).

A **admin-api** (`https://deliverydireto.com.br/admin-api/`) e a API correta para lojistas. Confirmado na documentacao oficial:
- `POST /admin-api/token` - Autenticacao OAuth do admin
- `GET /admin-api/v1/orders` - Lista de pedidos (com items, payment, tudo)
- `PUT /admin-api/v1/orders/{id}` - Atualiza status do pedido
- KDS: `GET /admin-api/v1/kds/orders` - Lista pedidos KDS
- KDS: `PUT /admin-api/v1/kds/orders/{id}` - Atualiza status KDS
- KDS: `GET /admin-api/v1/kds/orders/{id}` - Detalhe do pedido

O codigo ORIGINAL usava admin-api para auth e store-api/v1 para dados - e FUNCIONAVA. Nos quebramos ao mudar auth para store-api/token.

## Alteracoes

### 1. `supabase/functions/dd-auth/index.ts`
- Mudar `DD_STORE_API_BASE` de `https://deliverydireto.com.br/store-api` para `https://deliverydireto.com.br/admin-api`
- Token: `POST /admin-api/token` (password grant para connect, refresh_token grant para refresh)
- Webhooks: `POST /admin-api/v1/webhooks` (mesma logica, so muda base URL)

### 2. `supabase/functions/dd-polling/index.ts`
- Mudar `DD_STORE_API` de `https://deliverydireto.com.br/store-api/v1` para `https://deliverydireto.com.br/admin-api/v1`
- Listar pedidos: `GET /admin-api/v1/orders?updatedAt[gte]=...&limit=50`
- Detalhe do pedido (para items): `GET /admin-api/v1/kds/orders/{id}` (endpoint KDS retorna items completos)
- Manter toda a logica de parsing (money(), mapPaymentLabel(), matching por pdv_code, agendamento)
- Manter headers `X-DeliveryDireto-Id` e `X-DeliveryDireto-Client-Id`

### 3. `supabase/functions/dd-order-action/index.ts`
- Mudar base URL para `https://deliverydireto.com.br/admin-api/v1`
- Status update: `PUT /admin-api/v1/orders/{id}` com body `{ "status": "APPROVED" }` (documentado na admin-api)
- OU usar KDS: `PUT /admin-api/v1/kds/orders/{id}` como fallback
- Mapeamento: accept->APPROVED, ready->READY, dispatch->DISPATCHED, deliver->DONE, reject->CANCELLED (com statusReason)

## Arquivos Alterados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/dd-auth/index.ts` | Token URL: store-api -> admin-api |
| `supabase/functions/dd-polling/index.ts` | Orders URL: store-api -> admin-api, detail via KDS |
| `supabase/functions/dd-order-action/index.ts` | Status URL: store-api -> admin-api |

Nenhuma alteracao em UI. Nenhuma funcionalidade existente alterada.

