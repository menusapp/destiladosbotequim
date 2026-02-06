
# Integra Asaas -- Pagamentos Online (Subcontas)

## Resumo

Implementar a integracao completa com o Asaas para que cada restaurante possa criar uma subconta, receber pagamentos online via Pix e Cartao de Credito, e (futuramente) emitir notas fiscais. A marca Asaas pode aparecer normalmente para o cliente final.

---

## Fase 1: Infraestrutura (Banco de Dados + Secrets)

### 1.1 Configurar Secret da API Key Master
- Adicionar o secret `ASAAS_API_KEY` com a chave de Sandbox que voce ja tem
- Adicionar o secret `ASAAS_ENVIRONMENT` com valor `sandbox` (depois muda pra `production`)

### 1.2 Migrar tabela `online_payment_config`
Reaproveitar a tabela existente, adicionando colunas para o Asaas e removendo as do Mercado Pago:

| Acao | Campo |
|---|---|
| Adicionar | `asaas_api_key` (text) - API Key da subconta |
| Adicionar | `asaas_wallet_id` (text) - Wallet ID da subconta |
| Adicionar | `asaas_account_id` (text) - ID da conta no Asaas |
| Adicionar | `asaas_onboarding_url` (text) - Link para envio de documentos |
| Adicionar | `asaas_account_status` (text, default 'pending') - Status da conta |
| Remover | `mp_access_token`, `mp_refresh_token`, `mp_token_expires_at`, `mp_user_id`, `mp_public_key` |
| Alterar | `provider` default de 'mercadopago' para 'asaas' |

### 1.3 Criar tabela `asaas_customers`
Mapeia clientes (CPF) para IDs do Asaas por restaurante:

| Campo | Tipo |
|---|---|
| `id` | uuid (PK) |
| `restaurant_id` | uuid (FK) |
| `customer_cpf` | text |
| `asaas_customer_id` | text |
| `created_at` | timestamptz |

Constraint unique em `(restaurant_id, customer_cpf)`.

---

## Fase 2: Edge Functions (Backend)

### 2.1 `asaas-provision` - Criar subconta do restaurante
- Recebe dados da empresa (nome, CPF/CNPJ, email, telefone, endereco, faturamento)
- Chama `POST /v3/accounts` na API do Asaas usando a API Key master
- Salva `asaas_api_key`, `asaas_wallet_id`, `asaas_account_id` e `asaas_onboarding_url` na tabela `online_payment_config`
- Retorna o link de onboarding para envio de documentos

### 2.2 `asaas-charge` - Criar cobranca
- Recebe: `restaurant_id`, `order_id`, `amount`, `billing_type` (PIX ou CREDIT_CARD), dados do cliente
- Busca a `asaas_api_key` do restaurante no banco
- Primeiro verifica/cria o cliente no Asaas (tabela `asaas_customers`)
- Chama `POST /v3/payments` usando a API Key do restaurante
- Para PIX: retorna QR Code e copia-e-cola
- Para Cartao: processa o pagamento com tokenizacao
- Salva registro na tabela `online_payments`

### 2.3 `asaas-webhook` - Receber confirmacoes de pagamento
- Recebe notificacoes do Asaas quando pagamento e confirmado/cancelado
- Atualiza `online_payments.status` e `orders.payment_status`
- Se confirmado, pode disparar notificacao WhatsApp (se configurado)

### 2.4 `asaas-status` - Consultar status da subconta
- Verifica se a conta do restaurante esta ativa/pendente/aprovada
- Usado pela tela de configuracoes para mostrar o status atual

---

## Fase 3: Interface Admin (Configuracoes > Pagamentos Online)

### 3.1 Substituir o placeholder "Em Desenvolvimento"
O componente `OnlinePaymentsSettings.tsx` sera completamente reescrito com 3 estados:

**Estado 1 - Nao conectado:** Formulario de cadastro da subconta com campos:
- Nome / Razao Social
- CPF ou CNPJ
- E-mail
- Telefone
- CEP + Endereco completo
- Faturamento mensal (campo estimado)
- Botao "Criar Conta de Pagamentos"

**Estado 2 - Conta criada, pendente de documentos:**
- Status: "Aguardando documentos"
- Link/botao para abrir a pagina de onboarding do Asaas (envio de documentos)
- Toggle para aceitar Pix / Cartao
- Toggle para ativar no delivery

**Estado 3 - Conta ativa:**
- Status: "Conectado" com indicador verde
- Toggles: Aceitar Pix, Aceitar Cartao, Ativar para Delivery
- Botao para desconectar

---

## Fase 4: Checkout do Delivery (Cliente)

### 4.1 Adaptar `PaymentStep.tsx`
- Verificar se o restaurante tem pagamento online ativo
- Se sim, adicionar opcoes "Pagar com Pix Online" e "Pagar com Cartao Online" alem dos metodos locais
- Distinguir visualmente as opcoes online das locais

### 4.2 Criar novo step de pagamento online
Quando o cliente escolher pagar online:
- **Pix**: Chamar edge function `asaas-charge`, exibir QR Code e codigo copia-e-cola, tela de "Aguardando pagamento" com polling/realtime
- **Cartao**: Formulario de dados do cartao (usando tokenizacao do Asaas via JS), processar e confirmar

### 4.3 Adaptar `CheckoutDrawer.tsx`
- Adicionar logica para o novo step de pagamento online entre "payment" e "summary"
- Se pagamento online for confirmado, criar o pedido com `payment_status = 'confirmed'`
- Se pagamento local, manter fluxo atual com `payment_status = 'pending'`

### 4.4 Adaptar `SummaryStep.tsx`
- Mostrar "Pago online" quando o pagamento ja foi confirmado
- Mostrar metodo de pagamento online (Pix/Cartao) no resumo

---

## Fase 5: Indicadores no Painel Admin

### 5.1 Indicador visual nos pedidos
- Na lista de pedidos delivery, mostrar badge "Pago Online" quando `payment_status = 'confirmed'`
- Diferenciar de pedidos com pagamento na entrega

---

## Secao Tecnica

### Arquitetura do fluxo de pagamento

```text
CLIENTE ESCOLHE "PAGAR PIX ONLINE"
  |
  v
Frontend chama Edge Function "asaas-charge"
  |
  v
Edge Function:
  1. Busca asaas_api_key do restaurante
  2. Cria/busca cliente no Asaas
  3. POST /v3/payments (billingType: PIX)
  4. Salva em online_payments
  5. Retorna QR Code
  |
  v
Frontend exibe QR Code + polling status
  |
  v
Asaas confirma pagamento -> Webhook
  |
  v
Edge Function "asaas-webhook":
  1. Atualiza online_payments.status
  2. Atualiza orders.payment_status
  |
  v
Frontend detecta confirmacao -> Avanca para resumo
```

### Endpoints Asaas utilizados
- `POST /v3/accounts` - Criar subconta
- `GET /v3/accounts/{id}` - Verificar status da conta
- `POST /v3/customers` - Criar cliente
- `GET /v3/customers?cpfCnpj=` - Buscar cliente por CPF
- `POST /v3/payments` - Criar cobranca (Pix/Cartao)
- `GET /v3/payments/{id}/pixQrCode` - Obter QR Code Pix

### Ambiente
- Sandbox: `https://sandbox.asaas.com/api/v3/`
- Producao: `https://api.asaas.com/api/v3/`

### Campos ja existentes na tabela `orders`
- `payment_status` (text, default 'pending') - ja existe
- `online_payment_id` (uuid, FK) - ja existe

### Tabela `online_payments` - reaproveitada
- Campos existentes servem perfeitamente (amount, status, provider, pix_qr_code, etc.)
- Mudar `provider` para 'asaas'

### Ordem de implementacao sugerida
1. Secret + Migracao do banco
2. Edge function `asaas-provision` + UI de cadastro admin
3. Edge function `asaas-charge` (Pix primeiro)
4. Edge function `asaas-webhook`
5. UI de checkout (QR Code Pix)
6. Cartao de credito (fase posterior)
7. Notas fiscais (fase posterior)
