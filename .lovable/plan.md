

## Diagnostico

O pagamento Pix foi criado com sucesso no Mercado Pago, o dinheiro caiu na conta, mas o sistema ficou em "Aguardando pagamento..." infinitamente. Isso acontece porque:

1. **A `notification_url` nao esta sendo enviada na criacao do pagamento** -- A edge function `mercadopago-charge` cria o pagamento no Mercado Pago mas nao informa para onde enviar a notificacao (IPN). Sem isso, o Mercado Pago nunca chama o `mercadopago-webhook`, e o status na tabela `online_payments` nunca muda de `pending` para `confirmed`.

2. **O frontend faz polling na tabela `online_payments`** buscando `status === "confirmed"`, mas como o webhook nunca e acionado, o status nunca muda.

Os logs do webhook confirmam: **zero chamadas recebidas**.

## Plano de Correcao

### 1. Adicionar `notification_url` na criacao do pagamento (mercadopago-charge)

Na edge function `mercadopago-charge`, ao criar o pagamento PIX (e tambem cartao), incluir o campo `notification_url` no body enviado ao Mercado Pago:

```
notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`
```

Isso faz o Mercado Pago enviar automaticamente as notificacoes IPN para o webhook quando o status do pagamento mudar (ex: `approved`).

### 2. Corrigir o provider default na tabela online_payments

A migration anterior deixou o default como `'asaas'`. Precisamos garantir que seja `'mercadopago'`. Verificar se a migration de remocao do Asaas ja corrigiu isso; caso contrario, adicionar uma nova migration.

### 3. Nenhuma mudanca no frontend

O polling no `OnlinePaymentStep.tsx` ja esta correto -- ele consulta `online_payments.status` a cada 5 segundos. Assim que o webhook atualizar para `confirmed`, o frontend vai detectar e mostrar "Pagamento Confirmado".

## Detalhes Tecnicos

### Edge function `mercadopago-charge/index.ts`

Adicionar `notification_url` no payload do `fetch` para a API do Mercado Pago, tanto no bloco PIX quanto no bloco CREDIT_CARD:

```typescript
const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

// No body do fetch para /v1/payments:
notification_url: webhookUrl,
```

Isso e a unica mudanca necessaria. Uma linha em cada bloco de pagamento.

