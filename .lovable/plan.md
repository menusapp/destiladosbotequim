

# Corrigir Itens Vazios + Status KDS: Diagnostico Definitivo dos Logs

## Problemas Encontrados nos Logs

### 1. Itens Vazios -- GET /admin-api/v1/orders RETORNA items: [] SEMPRE

Os logs confirmam:
```text
"items":[],"compositeItems":[]
```
O endpoint `GET /admin-api/v1/orders` retorna pedidos SEM itens. E a busca de detalhe KDS (`GET /admin-api/v1/kds/order?orderId=...`) nao esta sendo executada porque o pedido ja foi importado antes (aparece como `existing`) -- ou seja, so imprime os logs da listagem, nunca do detalhe.

**Solucao**: Usar `GET /admin-api/v1/kds/orders` (endpoint KDS de LISTA, confirmado no OpenAPI) como fonte PRIMARIA em vez de `GET /admin-api/v1/orders`. O KDS list retorna `KdsordersDTO` que inclui itens. Parametros: `dateStart` (yyyy-MM-dd HH:mm:ss em UTC), `offset`, `limit`.

### 2. Pagamento -- campo errado

Os logs mostram que o campo se chama `paymentMethod` (nao `payment`):
```text
"paymentMethod":{"name":"Visa (crédito)","paymentsId":1,"cardBrand":null,...}
```
O codigo busca `fullOrder.payment` que retorna `undefined`. Precisa ler `fullOrder.paymentMethod`.

### 3. Status KDS -- enum invalido

O `PUT /admin-api/v1/kds/orders/{id}` retorna erro 400:
```text
"Keyword validation failed: Value must be present in the enum", "field": "status"
```
Enviamos `{"status":"APPROVED"}` mas o KDS usa enum diferente dos status do pedido. Os valores provaveis do KDS sao: `PREPARING`, `READY`, `DONE` (baseado no fluxo KDS padrao). O status `APPROVED` nao e aceito pelo KDS -- ele e um status do pedido, nao do KDS.

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts`

**Trocar fonte primaria de pedidos**: Usar `GET /admin-api/v1/kds/orders?dateStart=...&limit=50` em vez de `GET /admin-api/v1/orders?updatedAt[gte]=...`. O parametro `dateStart` usa formato `yyyy-MM-dd HH:mm:ss` em UTC.

**Manter detalhe KDS como fallback**: Se a lista KDS tambem vier sem items, buscar `GET /admin-api/v1/kds/order?orderId={id}` para detalhe individual.

**Corrigir campo de pagamento**: Ler `fullOrder.paymentMethod` em vez de `fullOrder.payment`. O campo `paymentMethod.name` ja contem o label correto (ex: "Visa (crédito)"). Adaptar `mapPaymentLabel` para aceitar esse formato:
- `paymentMethod.name` contem "crédito" -> "Cartao de Credito Visa"
- `paymentMethod.name` contem "débito" -> "Cartao de Debito"
- `paymentMethod.name` = "PIX" -> "PIX"
- `paymentMethod.name` = "Dinheiro" -> "Dinheiro"
- `isOnlinePayment === true` -> "Pago Delivery Direto"

### 2. `supabase/functions/dd-order-action/index.ts`

**Corrigir enum do KDS**: Mudar o mapeamento de status para valores aceitos pelo KDS:
- `accept` -> `PREPARING` (nao APPROVED -- o KDS nao tem conceito de "aprovado", so "preparando")
- `ready` -> `READY`
- `dispatch` -> nao enviar ao KDS (KDS nao tem dispatch, manter so local)
- `deliver` -> `DONE`
- `reject` -> nao enviar ao KDS (cancelamento e via Orders API, nao KDS)

Se `dispatch` e `reject` falharem no KDS, manter apenas atualizacao local sem erro.

## Arquivos Alterados

| Arquivo | Descricao |
|---------|-----------|
| `supabase/functions/dd-polling/index.ts` | Usar KDS list como fonte primaria, corrigir campo paymentMethod |
| `supabase/functions/dd-order-action/index.ts` | Corrigir enum KDS: PREPARING/READY/DONE |

Nenhuma alteracao em UI. Pagamento e valores ja funcionam, so precisam do campo correto.

