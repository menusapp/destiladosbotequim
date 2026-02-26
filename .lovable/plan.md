

## Investigação e Plano de Correção

### ERRO 1: Pedido não é criado no banco — Causa Raiz Encontrada

**Evidência direta nos logs do Postgres:**
```
ERROR: new row for relation "orders" violates check constraint "orders_status_check"
```

**Causa:** Na linha 188 de `CheckoutDrawer.tsx`, quando há `onlinePaymentId`, o código define `status: "confirmed"`. Porém, a tabela `orders` possui um CHECK constraint que só aceita estes valores:

```
pending, accepted, preparing, ready, out_for_delivery, delivered, picked_up, cancelled
```

`"confirmed"` **não existe** na lista. O INSERT falha, o catch reseta para `setStep("payment")`, e nenhum pedido é criado.

**Correção (1 arquivo):**

- **`src/components/menu/CheckoutDrawer.tsx` — linha 188**: Trocar `status: "confirmed"` por `status: "pending"` (ou `"accepted"` se preferir auto-aceitar pedidos pagos online). O campo `payment_status: "paid"` na linha 189 já indica que o pagamento foi feito.

---

### ERRO 2: "Card Token not found" ao reutilizar cartão salvo — Causa Raiz Encontrada

**Evidência nos logs da Edge Function:**
```
Card Token not found (code 2006)
```

**Causa:** Em `mercadopago-charge/index.ts` (linhas ~145-170), o fluxo de cartão salvo faz:

1. `GET /v1/customers/{mp_customer_id}/cards/{card_id}` — retorna os **dados do cartão** (últimos 4 dígitos, bandeira, etc.)
2. Usa `cardData.id` como `token` no payload do pagamento — mas `cardData.id` é o **ID do cartão**, não um token de pagamento válido

A API do Mercado Pago **não permite** criar pagamentos usando apenas o ID do cartão como token. Para cartões salvos, o correto é NÃO enviar `token` e sim montar o payload usando `payer.id` (customer_id) com o `card` referenciado diretamente. Alternativamente, é necessário gerar um novo `card_token` via frontend (exigindo CVV novamente).

**Correção (1 arquivo):**

- **`supabase/functions/mercadopago-charge/index.ts`**: Refatorar o bloco `pay_with_saved_card` para NÃO usar token. Em vez disso, enviar o pagamento com:
  - `payer.id` = `mp_customer_id` do cartão salvo  
  - Remover o campo `token` do body
  - Usar `payment_method_id` do cartão salvo diretamente

---

### Resumo das Alterações

| Arquivo | Mudança |
|---|---|
| `src/components/menu/CheckoutDrawer.tsx` | Linha 188: `"confirmed"` → `"pending"` |
| `supabase/functions/mercadopago-charge/index.ts` | Bloco saved card: remover `token`, usar `payer.id` = customer_id |

