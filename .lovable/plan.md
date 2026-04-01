

# Corrigir Parsing e Status Mapping do dd-polling

## Problema Raiz

Os logs mostram que a API retorna:
```text
{"status":"success","data":{"orders":[{...}]}}
```

O codigo faz `ordersData.data` que retorna `{"orders":[...]}` (um objeto), e como nao e array, cai para `[]`. Precisa fazer `ordersData.data.orders`.

Alem disso, os status reais da API sao `WAITING`, `APPROVED`, `DONE` -- nao `PLACED`, `CONFIRMED`, `DELIVERED`.

## Alteracoes

### 1. `supabase/functions/dd-polling/index.ts`

**Parsing** (linhas 128-136): Adicionar extração do nested `data.orders`:
```typescript
if (ordersData?.data?.orders && Array.isArray(ordersData.data.orders)) {
  ordersList = ordersData.data.orders;
} else if (Array.isArray(ordersData)) {
  ordersList = ordersData;
} else if (ordersData?.data && Array.isArray(ordersData.data)) {
  ordersList = ordersData.data;
}
```

**Status mapping** (linhas 154-162 e 192-200): Atualizar para status reais:
```text
WAITING   -> pending
APPROVED  -> accepted
PREPARING -> preparing
READY     -> ready
DISPATCHED -> out_for_delivery
DONE      -> delivered
CANCELLED -> cancelled
```

**Campos de pedido**: Ajustar para o formato real da API (ex: `total.subTotal.value` para preco, `type` TAKEOUT/DELIVERY, `orderNumber` como ID).

### 2. Deploy

Fazer deploy da `dd-polling` corrigida.

Nenhuma outra funcao ou fluxo sera alterado.

