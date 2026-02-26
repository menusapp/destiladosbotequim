

## Plano: Adicionar input de CVV para cartões salvos

### Causa Raiz
O erro `security_code_id can't be null` (code 3031) ocorre porque a API do Mercado Pago **exige o CVV** ao gerar um `card_token` a partir de um cartão salvo. O `POST /v1/card_tokens` atual envia apenas `card_id` e `customer_id`, mas falta o campo `security_code`.

### Solução
Adicionar um campo de CVV na UI quando o usuário seleciona um cartão salvo, enviar esse valor para a Edge Function, e incluí-lo no body do `POST /v1/card_tokens`.

### Mudanças

**1. Frontend — `src/components/menu/checkout/OnlinePaymentStep.tsx`**
- Adicionar estado `savedCardCvv` para armazenar o CVV digitado
- Renderizar um input de CVV (3-4 dígitos) abaixo do cartão salvo selecionado (quando `selectedCardId !== "new"`)
- Enviar `security_code: savedCardCvv` no payload da função `mercadopago-charge`

**2. Backend — `supabase/functions/mercadopago-charge/index.ts`**
- Receber `security_code` do body da request
- Incluir `security_code` no body do `POST /v1/card_tokens`:
  ```json
  { "card_id": "...", "customer_id": "...", "security_code": "123" }
  ```

### Escopo
- 2 arquivos modificados
- Nenhuma mudança no fluxo de novos cartões ou PIX

