
# Fix: Mesa não fica ocupada ao aceitar pedido do totem no PDV

## Diagnóstico real

O problema não está mais no `TableDetailView.tsx`.

Hoje existem dois caminhos diferentes no PDV para aceitar pedido de mesa:

1. `src/components/admin/TableDetailView.tsx`
   - Já tem a lógica de marcar `tables.is_occupied = true` quando `newStatus === "accepted"`.

2. `src/components/admin/TableDetailDialog.tsx`
   - É o caminho principal usado no PDV ao abrir a mesa pelo drawer/modal.
   - O botão **Aceitar** chama `handleAcceptOrder(order.id)`.
   - Essa função hoje faz apenas:
     - `orders.status = "accepted"`
     - `toast.success`
     - `refetchOrders()`

Ou seja: o pedido muda para aceito, mas a mesa nunca é atualizada para ocupada nesse fluxo. Por isso ela continua cinza/livre.

## Correção mínima e segura

### Arquivo a alterar
- `src/components/admin/TableDetailDialog.tsx`

### Ponto exato
- Função `handleAcceptOrder`

### Mudança
Depois de aceitar o pedido, adicionar o update da mesa para:
- `is_occupied: true`
- `occupied_at: new Date().toISOString()`
- `occupied_by`: nome do cliente do pedido aceito, com fallback `"Cliente"`

## Implementação proposta

Trocar a lógica atual de:

```ts
const handleAcceptOrder = async (orderId: string) => {
  await supabase.from("orders").update({ status: "accepted" }).eq("id", orderId);
  toast.success("Pedido aceito!");
  refetchOrders();
};
```

por uma versão que:
1. encontra o pedido em `orders`
2. atualiza o status para `accepted`
3. marca a mesa como ocupada
4. faz os refetches

Exemplo de comportamento:

```ts
const acceptedOrder = orders?.find(o => o.id === orderId);

await supabase.from("orders").update({ status: "accepted" }).eq("id", orderId);

if (table?.id) {
  await supabase.from("tables").update({
    is_occupied: true,
    occupied_at: new Date().toISOString(),
    occupied_by: acceptedOrder?.customer_name || "Cliente",
  }).eq("id", table.id);
}
```

## Análise de risco

### Risco de quebra
Baixo.

### Por que é seguro
- altera só o fluxo de aceite dentro do drawer de mesa do PDV
- não mexe em delivery, iFood, Delivery Direto, fiscal ou pagamento
- não muda schema
- repete exatamente o mesmo padrão já usado em:
  - `OrderDetailModal.tsx`
  - `TableDetailView.tsx`
  - criação manual de mesa no `PDVTab.tsx`

### Cuidados para estabilidade
- manter a lógica restrita ao `handleAcceptOrder`
- não mover lógica para o totem
- não mudar fluxo de pagamento/liberação de mesa
- idealmente fazer `refetchOrders()` e `onTableCleared()`/refresh visual depois do update da mesa para evitar UI desatualizada

## O que não deve ser alterado
- `KioskPayment.tsx`
- `TableDetailView.tsx`
- fluxo de pagamento da comanda
- relatórios
- qualquer integração externa

## Resultado esperado
Quando o pedido do totem for de mesa e o operador clicar em **Aceitar** no PDV drawer/modal da mesa:
- o pedido vira `accepted`
- a mesa passa para ocupada
- a UI deve ficar verde como antes

## Arquivo impactado
- `src/components/admin/TableDetailDialog.tsx`

## Estimativa
Baixa — ajuste pontual em uma única função.
