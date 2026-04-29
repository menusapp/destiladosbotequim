## Sim, a ideia está 100% correta

Confirmei lendo `supabase/functions/mercadopago-subscription-webhook/index.ts`: a função usa `MERCADOPAGO_ACCESS_TOKEN` em **dois pontos** (linhas 47 e 225) — um para buscar `preapproval/{id}` e outro para buscar `payment/{id}`. Hoje esse token é o da app **MenusPagamento** (pagamentos dos restaurantes), então quando o MP manda webhook da app **Menus Desenvolvimento de Sistemas** (assinaturas), o `fetch` na API do MP retorna 404/401 porque o `dataId` da assinatura não pertence àquela aplicação. É exatamente por isso que o `external_reference` chegou vazio nos testes anteriores — a resposta do MP veio inválida.

### Por que separar é a decisão certa

- Cada aplicação MP tem seu próprio Access Token e só enxerga os recursos criados por ela.
- Misturar tokens entre apps causa falhas silenciosas (200 do webhook + payload de erro do MP).
- Manter o fallback para `MERCADOPAGO_ACCESS_TOKEN` evita quebrar o ambiente até o secret novo ser cadastrado.

### Mudanças propostas

**1. `supabase/functions/mercadopago-subscription-webhook/index.ts`**

Substituir as duas leituras de token (linhas ~47 e ~225) por:

```ts
const mpAccessToken =
  Deno.env.get("MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN") ||
  Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

if (!Deno.env.get("MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN")) {
  console.warn("[MP Sub Webhook] MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN não configurado, usando fallback MERCADOPAGO_ACCESS_TOKEN");
}

if (!mpAccessToken) {
  console.error("[MP Sub Webhook] Nenhum access token de MP disponível");
  // mantém o return 200 atual
}
```

Nada mais é alterado: lógica de ativação de plano, matching por `external_reference` / `mp_preapproval_id`, atualização de status e tratamento de pagamento permanecem idênticos.

**2. Cadastrar novo secret**

Após o deploy, vou pedir o secret `MERCADOPAGO_SUBSCRIPTIONS_ACCESS_TOKEN` (Access Token de produção da app "Menus Desenvolvimento de Sistemas") via tool `add_secret`.

**3. Validação**

Após cadastrar o secret: clicar "Simular notificação" no painel MP (Planos e assinaturas) e conferir nos logs:
- `[MP Sub Webhook] Preapproval status: authorized payer: ...` (com dados reais, não vazios)
- `[MP Sub Webhook] Plano ativado: ... restaurant_id: ...`

### Não será alterado

- Edge function `mercadopago-webhook` (pagamentos dos restaurantes) continua usando `MERCADOPAGO_ACCESS_TOKEN`.
- Nenhum fluxo de pedidos, cardápio, iFood, Delivery Direto, fiscal ou QZ Tray.
- Nenhuma lógica de matching, ativação ou cancelamento de plano.