# Fix: Agrupar complementos por categoria no Totem (Kiosk)

## Causa raiz

Em `src/pages/Kiosk.tsx` linha 192-194, a query de `product_extras` usa `select("*")` — que **não** faz join com `extra_categories`. Logo, os extras diretos chegam ao componente sem `extra_category_name`, e o agrupamento no `KioskProductDetail` os joga todos em "Adicionais".

O `Menu.tsx` já resolve isso corretamente com:

```
select("id, name, description, price, is_required, min_selection, max_selection, extra_category_id, extra_categories(name)")
```

## Correção

**Arquivo**: `src/pages/Kiosk.tsx` (apenas a função `openProduct`, ~linhas 189-224)

1. Alterar a query de `product_extras` para incluir o join com `extra_categories(name)` — igual ao Menu.
2. Mapear `extra_category_name` a partir do join, igual ao Menu faz.

Nenhuma outra alteração necessária — o `KioskProductDetail.tsx` já tem toda a lógica de agrupamento por categoria implementada (linhas 24-46), só precisa receber o `extra_category_name` populado.

## Impacto

- Zero risco — apenas muda a query de busca para incluir um join que já existe no Menu
- `KioskProductDetail` não precisa de alteração  
  
  
Fix: Mesa não fica ocupada ao aceitar pedido do totem

## Causa raiz

Quando um pedido de mesa é feito pelo totem, o `KioskPayment.tsx` cria a comanda mas **não** marca a mesa como ocupada (correto — isso deve acontecer só na aceitação pelo admin).

O problema: existem **dois caminhos** para aceitar pedidos:

1. `**OrderDetailModal.tsx**` (aba Pedidos → clica no pedido → aceita) — **funciona**: linha 244-248 já faz `is_occupied: true` quando `order_type === 'local'` e `table_id` existe.
2. `**TableDetailView.tsx**` (PDV → clica na mesa → aceita pedido direto) — **não funciona**: a função `updateOrderStatus` (linhas 211-239) apenas chama o RPC e faz `fetchTableData()`, mas **nunca marca a mesa como ocupada**.

O cenário do totem usa o caminho 2: o admin vê o pedido na mesa pelo PDV e aceita direto ali.

## Correção

**Arquivo**: `src/components/admin/TableDetailView.tsx`, função `updateOrderStatus` (~linha 223)

Após aceitar o pedido (`newStatus === "accepted"`), adicionar lógica para marcar a mesa como ocupada — igual ao que `OrderDetailModal.tsx` já faz:

```typescript
if (newStatus === "accepted") {
  // Mark table as occupied when accepting a table order
  await supabase.from("tables").update({
    is_occupied: true,
    occupied_at: new Date().toISOString(),
    occupied_by: allOrders.find(o => o.id === orderId)?.customer_name || "Cliente",
  }).eq("id", tableId);

  // existing auto-print logic...
}
```

O `tableId` já está disponível no componente (é prop). O `allOrders` já está no estado.

## Impacto

- Zero risco — adiciona lógica que faltava sem alterar nada existente
- Apenas 5 linhas adicionadas dentro do bloco `if (newStatus === "accepted")`
- Não afeta delivery, iFood, DD, fiscal — apenas pedidos de mesa  
  
