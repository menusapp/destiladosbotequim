

## Plano: Pedido Totem de mesa pago = mesa ocupada imediatamente

### Problema
Quando um pedido de mesa é feito e pago pelo Totem (cartão ou PIX na maquininha), o pedido chega com `payment_status: "paid"` mas a mesa **não fica ocupada** — porque a ocupação hoje só acontece quando o admin clica "Aceitar". O pedido já está pago, então a mesa deveria ficar ocupada automaticamente.

### Solução

**Arquivo: `src/components/kiosk/KioskPayment.tsx`**

Após o pagamento ser confirmado na maquininha (dentro do bloco de polling onde já faz `createOrderInDB()` + update `payment_status: "paid"`), adicionar lógica para:

1. Se `consumptionMode === "table"` e existe `tableId`, marcar a mesa como ocupada imediatamente:
   ```typescript
   await supabase.from("tables").update({
     is_occupied: true,
     occupied_at: new Date().toISOString(),
     occupied_by: customer.name,
   }).eq("id", tableId);
   ```

2. Como `createOrderInDB` já busca o `tableId` internamente mas não o retorna, preciso extrair o `tableId` após a criação. A abordagem mais limpa: após o `createOrderInDB()` retornar o `orderId`, buscar o `table_id` do pedido recém-criado e então ocupar a mesa.

   Alternativamente (mais eficiente): fazer `createOrderInDB` também retornar o `tableId` junto com o `orderId`, mudando o retorno para `{ orderId, tableId }`.

3. O pedido já chega com `payment_status: "paid"` — isso já está correto. Dentro da mesa no painel, ele vai aparecer como pago.

### Escopo mínimo
- **1 arquivo**: `src/components/kiosk/KioskPayment.tsx`
- Modificar `createOrderInDB` para retornar `{ orderId, tableId }`
- No callback de polling (pagamento confirmado), após criar o pedido e marcar como pago, ocupar a mesa se for pedido de mesa
- Mesma lógica para o fluxo de dinheiro (`handleCashPayment`) quando for mesa

