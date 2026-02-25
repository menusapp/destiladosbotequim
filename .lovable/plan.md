

## Diagnostico

O erro `"payment_method_id attribute can't be null"` nos logs do `mercadopago-charge` ocorre porque a API do Mercado Pago exige que os dados do cartao sejam **tokenizados no frontend** usando o SDK JavaScript do Mercado Pago (`MercadoPago.js`). O backend atual espera receber um `card_token`, mas o frontend envia os dados brutos do cartao (numero, validade, CVV), que nunca sao convertidos em token.

O Mercado Pago **proibe** que dados sensíveis do cartao trafeguem diretamente para o seu servidor. O fluxo correto e:

```text
Frontend (browser)                    Mercado Pago SDK             Seu Backend
     |                                      |                          |
     |-- dados do cartao ----------------->|                          |
     |                                      |-- tokeniza via API MP -->|
     |<-- card_token -----------------------|                          |
     |                                      |                          |
     |-- card_token + amount ------------------------------------->|
     |                                      |                          |-- POST /v1/payments
```

## Plano de Correcao

### 1. Carregar o SDK do Mercado Pago no frontend

Adicionar o script `https://sdk.mercadopago.com/js/v2` no `index.html` para disponibilizar o objeto global `MercadoPago`.

**Arquivo:** `index.html` -- adicionar `<script src="https://sdk.mercadopago.com/js/v2"></script>` no `<head>`.

### 2. Buscar a `mp_public_key` do restaurante

O frontend precisa da chave publica do Mercado Pago do restaurante para inicializar o SDK. Antes de tokenizar, fazer um fetch na tabela `online_payment_config` para obter `mp_public_key`.

### 3. Tokenizar o cartao no frontend antes de enviar

No `OnlinePaymentStep.tsx`, na funcao `handleCreditCardPayment`:

1. Inicializar `const mp = new MercadoPago(publicKey)`.
2. Chamar `mp.createCardToken({ cardNumber, cardholderName, cardExpirationMonth, cardExpirationYear, securityCode, identificationType: "CPF", identificationNumber: cpf })`.
3. Enviar o `token.id` resultante como `card_token` para o backend.

### 4. Ajustar o backend para usar o token corretamente

O backend (`mercadopago-charge`) ja espera `card_token` e o envia como `token` na API. Porem, ele tambem precisa do `payment_method_id` (ex: "visa", "master"). O SDK do Mercado Pago retorna isso junto com o token. Adicionar `payment_method_id` no payload enviado ao MP.

### Resumo dos arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `index.html` | Adicionar script do SDK MercadoPago.js |
| `src/components/menu/checkout/OnlinePaymentStep.tsx` | Buscar `mp_public_key`, tokenizar cartao com SDK, enviar `card_token` e `payment_method_id` |
| `supabase/functions/mercadopago-charge/index.ts` | Aceitar `payment_method_id` do frontend e incluir no payload da API |

### Detalhes tecnicos

**Tokenizacao no frontend:**
```typescript
const mp = new window.MercadoPago(publicKey);
const cardToken = await mp.createCardToken({
  cardNumber: cardNumber.replace(/\s/g, ""),
  cardholderName: cardHolderName,
  cardExpirationMonth: cardExpiryMonth,
  cardExpirationYear: cardExpiryYear,
  securityCode: cardCcv,
  identificationType: "CPF",
  identificationNumber: customerCPF.replace(/\D/g, ""),
});
// cardToken.id -> enviar como card_token
```

**Backend -- adicionar payment_method_id no body:**
```typescript
body: JSON.stringify({
  transaction_amount: amount,
  token: card_token,
  payment_method_id: payment_method_id, // "visa", "master", etc.
  installments: installments || 1,
  ...
})
```

O `payment_method_id` pode ser detectado automaticamente pelo primeiro digito do cartao (BIN) ou retornado pelo SDK. Implementaremos deteccao automatica baseada no BIN para simplicidade.

