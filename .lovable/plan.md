

## Plano: Corrigir pagamento com cartão salvo

### Causa Raiz
A API do Mercado Pago **exige um `token`** em todo pagamento de cartão de crédito — inclusive para cartões salvos. O código atual omite o `token` para cartões salvos, causando o erro "Cannot infer Payment Method" (code 2131).

### Solução
Gerar um `card_token` no backend a partir do `card_id` salvo antes de criar o pagamento.

**Arquivo: `supabase/functions/mercadopago-charge/index.ts`**

No bloco `pay_with_saved_card` (após buscar os detalhes do cartão na API do MP), adicionar uma chamada para gerar o token:

```text
POST https://api.mercadopago.com/v1/card_tokens
Authorization: Bearer {access_token}
Body: { "card_id": savedCard.card_id }
```

Isso retorna um `token.id` que será incluído no payload do pagamento (`savedCardPayload.token = generatedToken`).

### Mudanças específicas

1. **Após o bloco de fetch dos detalhes do cartão (~linha 216)**: Inserir `POST /v1/card_tokens` com `{ card_id: savedCard.card_id }` usando o `mpAccessToken`
2. **No `savedCardPayload` (~linha 232)**: Adicionar `token: generatedTokenId`
3. **Nenhuma mudança no frontend** — o fluxo de novos cartões e PIX permanece intacto

### Escopo
- `supabase/functions/mercadopago-charge/index.ts` — única alteração

