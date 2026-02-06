

# Fase 2 e 3: Cobranças Pix/Cartão + Checkout Completo

## Problemas encontrados na reanálise

Antes de avançar, identifiquei 3 correções necessárias no que já foi construído:

### Correção 1: Campo `companyType` obrigatório para CNPJ
Os logs mostram que o Asaas retorna erro `"O campo companyType deve ser informado"` quando o cadastro é feito com CNPJ. O formulário atual não tem esse campo. Preciso:
- Adicionar um campo de seleção "Tipo de Empresa" (MEI, ME, EPP, etc.) no formulário de `OnlinePaymentsSettings.tsx`
- Detectar automaticamente se é CPF ou CNPJ (pelo tamanho) e exibir o campo apenas quando for CNPJ
- Enviar o `companyType` na edge function `asaas-provision`

### Correção 2: Default do provider na tabela `online_payments`
A tabela `online_payments` ainda tem `provider` com default `'mercadopago'`. Precisa de uma migration rápida para mudar para `'asaas'`.

### Correção 3: Validações no formulário
- Data de nascimento é obrigatória para CPF (a API retorna erro sem ela)
- Telefone celular é obrigatório

---

## Sobre o Wallet ID

**Não preciso do seu Wallet ID da conta master.** O wallet ID é usado para **split de pagamentos** (cobrar comissão automática sobre cada pagamento). Como você disse que não quer cobrar comissão por enquanto, não é necessário.

O que acontece é:
- Quando a edge function `asaas-provision` cria uma subconta, o Asaas retorna automaticamente o `walletId` e o `apiKey` dessa subconta
- Esses valores já estão sendo salvos no banco de dados
- As cobranças são feitas usando a API Key da subconta do restaurante (não a sua master)
- O dinheiro cai direto na conta do restaurante

Se no futuro você quiser cobrar comissão, aí sim precisaríamos do seu wallet ID para configurar o split.

---

## Implementação completa

### Passo 1: Migration para corrigir default do provider

Alterar o default da coluna `provider` na tabela `online_payments` de `'mercadopago'` para `'asaas'`.

### Passo 2: Corrigir `asaas-provision` e formulário

- Adicionar campo `companyType` (Select com opções: MEI, LIMITED, INDIVIDUAL, ASSOCIATION)
- Mostrar campo apenas quando o documento informado for CNPJ (14+ dígitos)
- Enviar `companyType` no payload da edge function

### Passo 3: Edge Function `asaas-charge`

Cria cobranças Pix e Cartão usando a API Key da subconta.

**Fluxo Pix:**
1. Recebe `restaurant_id`, `order_id`, `amount`, dados do cliente
2. Busca `asaas_api_key` do restaurante na tabela `online_payment_config`
3. Verifica se o cliente já existe no Asaas (tabela `asaas_customers` por CPF)
4. Se não existe, cria via `POST /v3/customers`
5. Cria cobrança via `POST /v3/payments` com `billingType: "PIX"`
6. Busca QR Code via `GET /v3/payments/{id}/pixQrCode`
7. Salva tudo na tabela `online_payments`
8. Retorna QR Code (imagem base64 + código copia-e-cola)

**Fluxo Cartão:**
1. Mesmos passos 1-4
2. Cria cobrança via `POST /v3/payments` com `billingType: "CREDIT_CARD"` + dados do cartão (número, nome, validade, CVV) + dados do titular (CPF, nome, email, CEP, número do endereço, telefone)
3. Resposta já vem com status confirmado/recusado
4. Salva na tabela `online_payments`

### Passo 4: Edge Function `asaas-webhook`

Recebe notificações automáticas do Asaas quando status de pagamento muda.

- Valida o evento recebido
- Busca o pagamento na tabela `online_payments` pelo `provider_payment_id`
- Atualiza `online_payments.status` conforme o evento:
  - `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` -> status = `confirmed`, atualiza `paid_at`
  - `PAYMENT_OVERDUE` -> status = `overdue`
  - `PAYMENT_REFUNDED` -> status = `refunded`
- Atualiza `orders.payment_status` para `confirmed` quando pagamento aprovado
- Dispara notificação WhatsApp se configurado

### Passo 5: Edge Function `asaas-status`

Consulta o status atual da subconta do restaurante no Asaas.

- Busca `asaas_account_id` no banco
- Chama `GET /v3/myAccount/status` usando a API Key da subconta
- Atualiza `online_payment_config.asaas_account_status` e `connection_status`

### Passo 6: Componente `OnlinePaymentStep.tsx`

Novo componente de checkout que aparece entre "pagamento" e "resumo":

**Modo Pix:**
- Chama `asaas-charge` com billingType PIX
- Exibe QR Code (imagem) + código copia-e-cola com botão "Copiar"
- Timer de expiração (30 minutos)
- Polling a cada 5 segundos na tabela `online_payments` verificando se status mudou para `confirmed`
- Quando confirmado: avança automaticamente

**Modo Cartão:**
- Formulário com: número do cartão, nome no cartão, validade (MM/AA), CVV
- Campos do titular: CPF, nome, email, CEP, número do endereço, telefone
- Botão "Pagar R$ XX,XX"
- Loading enquanto processa
- Se aprovado: avança automaticamente
- Se recusado: mostra erro e permite tentar novamente

### Passo 7: Adaptar `PaymentStep.tsx`

Adicionar seção "Pagamento Online" com duas opções:
- "Pix Online" (ícone de QR Code + texto)
- "Cartão de Crédito Online" (ícone de cartão + texto)

Estas opções só aparecem se:
- O restaurante tem `online_payment_config` com `enable_for_delivery = true`
- `accept_pix = true` para mostrar Pix
- `accept_card = true` para mostrar Cartão

Separação visual entre "Pagamento na Entrega/Retirada" e "Pagamento Online" com um divisor.

Quando o cliente seleciona um método online, o `paymentData` inclui `isOnlinePayment: true` e `onlineMethod: 'pix' | 'credit_card'`.

### Passo 8: Adaptar `CheckoutDrawer.tsx`

- Adicionar step `"online-payment"` ao tipo `CheckoutStep`
- Quando `paymentData.isOnlinePayment === true`, ir para step `"online-payment"` em vez de `"summary"`
- No step `"online-payment"`, renderizar `OnlinePaymentStep`
- Quando pagamento online confirmado:
  - Criar pedido com `payment_status = 'confirmed'` e `online_payment_id` vinculado
  - `payment_type` = `'pix_online'` ou `'credit_card_online'`
- Atualizar barra de progresso para incluir o novo step
- Atualizar título do drawer para "Pagamento Online"

### Passo 9: Adaptar `SummaryStep.tsx`

- Quando `paymentData.isOnlinePayment`, mostrar "Pago via Pix Online" ou "Pago via Cartão Online" com ícone verde de confirmação
- Não mostrar "Troco para" quando for pagamento online

### Passo 10: Badge "Pago Online" no painel admin

No `DeliveryOrdersTab.tsx`:
- Incluir `payment_status` na query de pedidos
- No `OrderCard`, exibir badge verde "Pago Online" quando `payment_status === 'confirmed'`
- No `FinishedOrderCard`, mesma badge

---

## Seção Técnica

### Arquivos a criar
| Arquivo | Descrição |
|---|---|
| `supabase/functions/asaas-charge/index.ts` | Cobrança Pix e Cartão |
| `supabase/functions/asaas-webhook/index.ts` | Webhook de confirmação |
| `supabase/functions/asaas-status/index.ts` | Consulta status da subconta |
| `src/components/menu/checkout/OnlinePaymentStep.tsx` | Step de pagamento online no checkout |

### Arquivos a modificar
| Arquivo | Mudança |
|---|---|
| `supabase/functions/asaas-provision/index.ts` | Garantir envio de `companyType` |
| `src/components/admin/settings/OnlinePaymentsSettings.tsx` | Campo Tipo de Empresa (CNPJ) |
| `src/components/menu/checkout/PaymentStep.tsx` | Opções Pix/Cartão Online |
| `src/components/menu/CheckoutDrawer.tsx` | Novo step + lógica de pedido pago |
| `src/components/menu/checkout/SummaryStep.tsx` | Indicador "Pago Online" |
| `src/components/admin/DeliveryOrdersTab.tsx` | Badge "Pago Online" |

### Endpoints Asaas utilizados
- `POST /v3/customers` - Criar cliente
- `GET /v3/customers?cpfCnpj={cpf}` - Buscar cliente
- `POST /v3/payments` - Criar cobrança
- `GET /v3/payments/{id}/pixQrCode` - QR Code Pix
- `GET /v3/myAccount/status` - Status da conta

### Fluxo do checkout adaptado

```text
Sacola -> Tipo Entrega -> Endereço -> Pagamento
                                        |
                          +-------------+-------------+
                          |                           |
                    Método LOCAL                Método ONLINE
                    (dinheiro, pix              (Pix Online ou
                     local, cartão               Cartão Online)
                     maquininha)                      |
                          |                 Online Payment Step
                          |                 (QR Code ou Form Cartão)
                          |                      |
                          |                Pagamento Confirmado
                          |                      |
                          +----------+-----------+
                                     |
                                  Resumo
                                     |
                               Pedido Criado
```

### Ordem de execução
1. Migration (corrigir default provider)
2. Corrigir formulário + asaas-provision (companyType)
3. Edge function asaas-charge
4. Edge function asaas-webhook
5. Edge function asaas-status
6. Componente OnlinePaymentStep.tsx
7. Adaptar PaymentStep.tsx
8. Adaptar CheckoutDrawer.tsx
9. Adaptar SummaryStep.tsx
10. Badge no DeliveryOrdersTab.tsx

