

# Plano: Correcao Completa do Ciclo de Vida iFood

Apos analise do codigo, identifiquei 5 problemas concretos que impedem o funcionamento correto.

---

## Problema 1: Polling so trata evento PLACED — ignora todos os outros

**Arquivo:** `supabase/functions/ifood-polling/index.ts` linha 76

O polling atual so processa `event.code === "PLACED"`. Eventos `CONFIRMED`, `CANCELLED`, `CANCELLATION_REQUESTED` e `CONCLUSION` sao ignorados — apenas adicionados ao acknowledgment sem atualizar o banco.

**Correcao:** Adicionar tratamento para cada tipo de evento:
- `CONFIRMED` → atualizar status para `accepted` via `ifood_order_id`
- `CANCELLED` / `CANCELLATION_REQUESTED` → atualizar para `cancelled`
- `CONCLUSION` → atualizar para `delivered`

Impacto: ZERO em pedidos normais. Os updates filtram por `ifood_order_id` que so existe em pedidos iFood.

---

## Problema 2: Insert sem ON CONFLICT — duplicatas causam erro silencioso

**Arquivo:** `supabase/functions/ifood-polling/index.ts` linha 111

O `.insert()` nao usa `ON CONFLICT`. O unique index em `ifood_order_id` faz o insert falhar, mas o erro e engolido silenciosamente e o `newOrdersCount` nao incrementa.

**Correcao:** Antes do insert, verificar se ja existe: `SELECT id FROM orders WHERE ifood_order_id = orderId`. Se existir, pular. Se nao, inserir normalmente.

Impacto: ZERO.

---

## Problema 3: Endpoint de cancelamento errado na Edge Function

**Arquivo:** `supabase/functions/ifood-order-action/index.ts` linha 16

O `cancel` action usa path `cancelRequest`, mas conforme a documentacao do iFood o endpoint correto e `requestCancellation`.

**Correcao:** Alterar `cancel: { method: "POST", path: "cancelRequest" }` para `cancel: { method: "POST", path: "requestCancellation" }`.

Impacto: ZERO. So afeta acoes sobre pedidos iFood.

---

## Problema 4: OrderDetailModal NAO chama iFood ao mudar status de pedido iFood

**Arquivo:** `src/components/admin/OrderDetailModal.tsx` linha 119-143

Quando o operador clica "Aceitar", "Preparar", etc., a funcao `updateStatus()` so chama `admin_update_order_status` no banco local. Para pedidos iFood, precisa TAMBEM chamar `ifood-order-action` para sincronizar com o iFood.

**Correcao:** Na funcao `updateStatus`, verificar se `(order as any).ifood_source && (order as any).ifood_order_id`. Se sim, chamar a Edge Function `ifood-order-action` com a acao correspondente ANTES de atualizar localmente. Mapeamento:
- `accepted` → action `confirm`
- `preparing` → action `start_preparation`
- `ready` → action `ready_to_pickup`
- `out_for_delivery` → action `dispatch`
- `cancelled` → action `cancel`

A interface `Order` do modal precisa adicionar `ifood_source?: boolean` e `ifood_order_id?: string`.

Impacto: MUITO BAIXO. O if condicional so executa para pedidos com `ifood_source=true`. Pedidos normais seguem exatamente o fluxo atual.

---

## Problema 5: Dados do pedido iFood incompletos (payment_type nao mapeado)

**Arquivo:** `supabase/functions/ifood-polling/index.ts` linhas 110-128

O insert do pedido nao mapeia `payment_type` dos dados do iFood. Tambem nao popula os `order_items` — o pedido entra sem itens, entao o card mostra vazio.

**Correcao:**
- Mapear `orderData.payments[0].name` ou `orderData.payments[0].method` para `payment_type`
- Apos inserir o pedido, inserir os itens em `order_items` mapeando `orderData.items[]` com `quantity`, `price` (como `price_at_order`), e buscando o `product_id` por nome (ou null se nao encontrar correspondencia local)

Nota: Os itens do iFood podem nao ter correspondencia exata com produtos locais. A solucao segura e inserir com `product_id = null` e guardar o nome do produto nas `notes` do item, ou criar um produto generico "Item iFood".

Impacto: ZERO. Apenas afeta inserts de pedidos novos do iFood.

---

## Resumo de Arquivos

| Acao | Arquivo | Risco |
|---|---|---|
| Editar | `supabase/functions/ifood-polling/index.ts` | ZERO |
| Editar | `supabase/functions/ifood-order-action/index.ts` | ZERO |
| Editar | `src/components/admin/OrderDetailModal.tsx` | MUITO BAIXO |

Nenhuma funcionalidade existente sera alterada. Todas as mudancas sao condicionais a `ifood_source=true` ou restritas as Edge Functions do iFood.

