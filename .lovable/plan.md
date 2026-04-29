## Diagnóstico

Verifiquei o estado real:

- A assinatura do `testemuitotop` está `active` mas com **`mp_preapproval_id = NULL`** — confirma que ela foi criada manualmente no SQL Editor, **não pelo webhook**.
- Em `function_edge_logs` **não existe nenhuma chamada** para `mercadopago-subscription-webhook` em todo o histórico recente. Ou seja, o Mercado Pago nunca conseguiu (ou nunca tentou) entregar a notificação.

## Causas raiz (duas)

### 1. Edge function exigindo JWT (problema de código — corrijo agora)

Em `supabase/config.toml` todas as funções públicas chamadas por terceiros (iFood, Delivery Direto, MP charge, MP webhook clássico, WhatsApp etc.) têm `verify_jwt = false`. **Mas `mercadopago-subscription-webhook` está faltando nessa lista.** Isso faz o MP receber `401 Unauthorized` ao tentar entregar a notificação e o webhook **nunca executa** — exatamente o que vimos nos logs (vazio).

Por isso, mesmo o pagamento sendo aprovado e a tela `pagamento-confirmado` aparecer, o painel CEO continuou mostrando `pending_payment` — o webhook nunca rodou para virar `active`.

### 2. URL do webhook não configurada no painel do MP (problema de configuração — você precisa fazer)

Mesmo destravando o JWT, o MP só dispara `subscription_preapproval.updated` / `subscription_authorized_payment.created` para a URL configurada no painel. Como os planos foram criados manualmente, a URL provavelmente está vazia ou apontando para outro lugar.

## Correção 1 — Código (eu faço ao aprovar)

Adicionar em `supabase/config.toml`, junto com os outros webhooks públicos:

```toml
[functions.mercadopago-subscription-webhook]
verify_jwt = false

[functions.mercadopago-oauth]
verify_jwt = false
```

(Aproveitando para expor `mercadopago-oauth` também, que é callback público do MP e pelo mesmo motivo precisa aceitar requests sem JWT.)

Nenhuma alteração na lógica do webhook é necessária — ele já está correto:

- Identifica o restaurante via `external_reference` (que o `register-restaurant` já injeta na URL do MP, linha 211 do `register-restaurant/index.ts`) com fallback para `mp_payer_email`.
- Atualiza a sub `pending_payment` existente para `active` (preservando o índice único `idx_restaurant_subscriptions_one_active` e qualquer upgrade/downgrade pendente) em vez de cancelar+inserir.
- Limpa `pending_plan_slug` e flags de trial.
- Trata renovação mensal via `subscription_authorized_payment.created`.
- Trata `paused`/`cancelled` com período de graça de 5 dias e suspensão automática após 2 falhas.

A coluna `mp_payer_email` já existe em `restaurants` e o `register-restaurant` já grava (vimos `legitgutin@gmail.com` salvo para o `testemuitotop`).

## Correção 2 — Configuração no painel do MP (você precisa fazer)

Esta parte **não é código**, é configuração nos planos do MP. Para cada um dos 3 planos de assinatura (Básico, Intermediário, Avançado):

1. Acesse https://www.mercadopago.com.br/subscriptions → "Seu negócio" → "Assinaturas" → editar plano
2. Em "URL de notificação" (Webhooks/IPN), colar:

   ```
   https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/mercadopago-subscription-webhook
   ```

3. Em "URL de retorno após pagamento" (já feito anteriormente, confirmar):

   ```
   https://menusapp.com.br/pagamento-confirmado?plan=basico
   https://menusapp.com.br/pagamento-confirmado?plan=intermediario
   https://menusapp.com.br/pagamento-confirmado?plan=avancado
   ```

4. Salvar e usar o botão **"Simular notificação" → "Planos e assinaturas" → `subscription_preapproval`** para testar.

## Validação após aprovar e configurar

1. Após o deploy, o Lovable Cloud reaplica `verify_jwt=false`.
2. No painel do MP, simular notificação `subscription_preapproval.updated` para um restaurante de teste.
3. Verificar nos logs do edge function que aparece:
   - `[MP Sub Webhook] Received: ...`
   - `[MP Sub Webhook] Preapproval status: authorized payer: ...`
   - `[MP Sub Webhook] Subscription activated for restaurant: <uuid>`
4. Conferir no banco:

   ```sql
   SELECT status, mp_preapproval_id, last_payment_at
   FROM restaurant_subscriptions
   WHERE restaurant_id = '<uuid>'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Esperado: `status='active'`, `mp_preapproval_id` preenchido, `last_payment_at` recente.

## Fora de escopo (não tocar)

Pedidos, cardápio, iFood, Delivery Direto, fiscal, QZ Tray, lógica de cobrança, RLS de outras tabelas. A única alteração de código é o `supabase/config.toml`.
