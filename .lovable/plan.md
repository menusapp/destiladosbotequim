

# Migrar Asaas de Sandbox para Producao

## O que esta acontecendo

O sistema esta configurado para o ambiente **sandbox** do Asaas. Os QR Codes Pix gerados nesse ambiente nao funcionam em bancos reais -- sao apenas para simulacao. O SMS com link "sandbox" confirma isso.

## O que precisa ser feito

### Passo 1: Voce precisa obter sua API Key de producao

1. Acesse o painel do Asaas em producao: **https://www.asaas.com** (nao o sandbox.asaas.com)
2. Faca login com sua conta principal
3. Va em **Configuracoes > Integracao > Chaves de API**
4. Copie sua **API Key de producao** (comeca com `$aact_...`)

**Importante:** a chave de sandbox e a de producao sao diferentes. A de sandbox so funciona no ambiente de testes.

### Passo 2: Atualizar os secrets do projeto

Vou atualizar 2 secrets:

| Secret | Valor atual | Novo valor |
|---|---|---|
| `ASAAS_API_KEY` | Chave de sandbox | Sua chave de producao |
| `ASAAS_ENVIRONMENT` | `sandbox` | `production` |

### Passo 3: Limpar dados do sandbox

A subconta do restaurante criada no sandbox **nao existe na producao**. Preciso limpar os dados antigos no banco de dados para que o formulario de cadastro apareca novamente:

- Limpar `asaas_account_id`, `asaas_api_key`, `asaas_wallet_id` da tabela `online_payment_config`
- Resetar `connection_status` para `disconnected`
- Limpar registros de teste na tabela `online_payments`
- Limpar registros de teste na tabela `asaas_customers`

### Passo 4: Recadastrar no painel

Depois de limpar, voce vai acessar **Configuracoes > Pagamentos Online** no painel admin e refazer o cadastro. Dessa vez, a subconta sera criada no ambiente de producao do Asaas, com QR Codes Pix que funcionam de verdade.

---

## Secao tecnica

### Arquivos que NAO precisam de mudanca

O codigo ja esta preparado para producao -- todas as edge functions (`asaas-charge`, `asaas-provision`, `asaas-webhook`, `asaas-status`) ja verificam o secret `ASAAS_ENVIRONMENT` e alternam entre:

- `https://sandbox.asaas.com/api/v3` (sandbox)
- `https://api.asaas.com/api/v3` (producao)

Nenhuma alteracao de codigo e necessaria.

### O que sera feito tecnicamente

1. Solicitar a nova API Key de producao via ferramenta de secrets
2. Atualizar o secret `ASAAS_ENVIRONMENT` para `production`
3. Executar uma migration SQL para limpar os dados de sandbox:

```sql
-- Limpar config do sandbox para permitir recadastro em producao
UPDATE online_payment_config
SET asaas_account_id = NULL,
    asaas_api_key = NULL,
    asaas_wallet_id = NULL,
    asaas_onboarding_url = NULL,
    asaas_account_status = NULL,
    connection_status = 'disconnected',
    connected_at = NULL,
    enabled = false
WHERE restaurant_id = '8947a1f1-eaee-4f15-90eb-dad7c2a0339a';

-- Limpar clientes de sandbox
DELETE FROM asaas_customers
WHERE restaurant_id = '8947a1f1-eaee-4f15-90eb-dad7c2a0339a';

-- Limpar pagamentos de teste
DELETE FROM online_payments
WHERE restaurant_id = '8947a1f1-eaee-4f15-90eb-dad7c2a0339a';
```

### Ordem de execucao

1. Solicitar API Key de producao ao usuario
2. Atualizar secrets (`ASAAS_API_KEY` e `ASAAS_ENVIRONMENT`)
3. Executar migration de limpeza dos dados de sandbox
4. Usuario refaz o cadastro no painel admin (Configuracoes > Pagamentos Online)
5. Testar pagamento Pix real com R$ 5,00+
