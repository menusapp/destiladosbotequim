

## Plano: Corrigir PIX na Maquininha (Properties not supported)

### Diagnóstico

Os logs mostram exatamente o problema em 3 tentativas sequenciais:

1. **Tentativa 1**: `config.point.payment_type: "bank_transfer"` → erro `"additionalProperties 'payment_type' not allowed"` no `$.config.point`
2. **Tentativa 2**: `allowed_payment_methods: ["bank_transfer"]` no payment → erro `"additionalProperties 'allowed_payment_methods' not allowed"` no `$.transactions.payments[0]`
3. **Resultado**: todas as tentativas falham com 400, PIX nunca chega na maquininha

### Causa raiz

A documentação oficial da API `/v1/orders` do Mercado Pago Point mostra que o campo correto para pré-selecionar o tipo de pagamento é:

```json
"config": {
  "point": { "terminal_id": "...", "print_on_terminal": "no_ticket" },
  "payment_method": {
    "default_type": "credit_card"
  }
}
```

O campo fica em **`config.payment_method.default_type`**, e NÃO em `config.point.payment_type` nem em `transactions.payments[0].allowed_payment_methods`. O código atual usa ambos os caminhos errados.

### Solução

Arquivo: **`supabase/functions/mercadopago-point/index.ts`**

Para PIX (`bank_transfer`), usar o mesmo endpoint `/v1/orders` com o campo correto `config.payment_method.default_type`:

```json
{
  "type": "point",
  "external_reference": "...",
  "transactions": { "payments": [{ "amount": "9.90" }] },
  "config": {
    "point": { "terminal_id": "...", "print_on_terminal": "no_ticket" },
    "payment_method": { "default_type": "bank_transfer" }
  }
}
```

Isso unifica o fluxo de PIX e cartões — todos usam `/v1/orders` com `config.payment_method.default_type`. A ramificação separada para PIX pode ser eliminada, simplificando o código.

Se `bank_transfer` não for aceito como `default_type` (improvável mas possível), o fallback será enviar sem `payment_method` (maquininha mostra menu de seleção manual).

### Mudanças

- Remover toda a lógica especial de PIX (blocos `pix_direct_v1_orders` e `pix_v1_retry_allowed_methods`)
- Usar `/v1/orders` com `config.payment_method.default_type` para TODOS os tipos (credit_card, debit_card, voucher_card, bank_transfer)
- Manter payment-intents como fallback apenas para cartões se /v1/orders falhar

### Arquivo
- `supabase/functions/mercadopago-point/index.ts` — corrigir campo de pré-seleção de pagamento

