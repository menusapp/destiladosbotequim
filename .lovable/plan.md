

## Plano: Pedido Totem de mesa chega aceito e pago automaticamente

### O que muda

Quando o pedido é criado pelo Totem para uma mesa e o pagamento já foi feito (maquininha ou dinheiro), o pedido deve entrar no sistema com:
- `status: "accepted"` (em vez de `"pending"`)
- `payment_status: "paid"` + `paid_at`
- Mesa marcada como `is_occupied: true`

Pedidos de outros canais (QR Code, PDV) continuam entrando como `pending` normalmente.

### Arquivo: `src/components/kiosk/KioskPayment.tsx`

**1. Na função `createOrderInDB`:**
- Para pedidos de mesa (`consumptionMode === "table"`), quando o pagamento já foi confirmado (maquininha), criar o pedido com `status: "accepted"` em vez de `"pending"`
- Adicionar um parâmetro `alreadyPaid: boolean` à função para distinguir os fluxos
- Quando `alreadyPaid` e `consumptionMode === "table"`: setar `status: "accepted"`, `payment_status: "paid"`, `paid_at: now()`
- Após criar o pedido de mesa, ocupar a mesa imediatamente:
  ```typescript
  await supabase.from("tables").update({
    is_occupied: true,
    occupied_at: new Date().toISOString(),
    occupied_by: customer.name,
  }).eq("id", tableId);
  ```

**2. No callback de polling (pagamento por maquininha confirmado, ~linha 328):**
- Chamar `createOrderInDB(true)` (alreadyPaid = true)
- Remover o update separado de `payment_status` / `paid_at` pois já estará no insert

**3. No fluxo de dinheiro (`handleFinalize`, ~linha 443):**
- Dinheiro não é pré-pago na maquininha, então continua `createOrderInDB(false)` — pedido entra como `pending`

**4. Para pedidos de balcão/viagem/entrega pagos na maquininha:**
- Também passam `alreadyPaid = true`, mas o `status` fica `"pending"` (só mesa vira `"accepted"` automaticamente, pois precisa da ocupação)
- Na verdade, pedidos de balcão pagos na maquininha já entram como `payment_status: "paid"` — o que muda é só mesa ganhar `status: "accepted"` + ocupação

### Resumo
- 1 arquivo modificado: `src/components/kiosk/KioskPayment.tsx`
- `createOrderInDB` ganha flag `alreadyPaid`
- Mesa + Totem + pago = `status: "accepted"` + mesa ocupada
- Outros modos continuam inalterados

