

## Plano: Corrigir erro "ao salvar pedido" + ajustar status automático do Totem

### Bug encontrado

A coluna `total_amount` **não existe** na tabela `orders`. A linha 174 do `KioskPayment.tsx` tenta inserir `total_amount: finalTotal`, o que causa erro no Supabase e o pedido não é salvo — mesmo após o pagamento ser aprovado na maquininha.

### O que precisa mudar

**Arquivo: `src/components/kiosk/KioskPayment.tsx`**

1. **Remover `total_amount`** do objeto `orderData` (linha 174) — essa coluna não existe.

2. **Ajustar status automático para pedidos pagos pelo Totem:**
   - **Mesa** (consumptionMode = "table") + pago na maquininha → `status: "accepted"`, `payment_status: "paid"` — mesa ocupada (já implementado, vai funcionar ao corrigir o bug)
   - **Balcão/Viagem/Entrega** + pago na maquininha → `status: "preparing"`, `payment_status: "paid"` — entra direto pra produção, sem precisar aceitar manualmente
   - **Dinheiro** (qualquer modo) → continua `status: "pending"` como hoje

3. **Corrigir `handleRetryPointPayment`** (linhas 442-450) — está duplicando chamadas (`handlePointPayment()` é chamado 2 vezes e os resets no meio são inúteis).

### Lógica simplificada

```
if (alreadyPaid && consumptionMode === "table") → status: "accepted"
else if (alreadyPaid) → status: "preparing"  
else → status: "pending"
```

### Resultado esperado
- Pagamento aprovado na maquininha → pedido salva sem erro
- Tag `order_channel: "totem"` já está presente em todos os pedidos
- Mesa: entra aceito + pago + mesa ocupada
- Balcão/viagem: entra preparando + pago
- Métricas/caixa/DRE já capturam pedidos com `payment_status: "paid"` + `order_channel: "totem"` (implementado na iteração anterior)

