

## Problema

A conta Asaas foi criada mas foi **reprovada** porque os documentos de identificacao (RG/CNH + selfie) nunca foram enviados. O fluxo correto do Asaas exige:

1. Criar subconta (ja feito)
2. Consultar documentos pendentes via `GET /v3/myAccount/documents` (usando a API key da subconta)
3. Obter os links de `onboardingUrl` retornados para cada documento
4. Redirecionar o usuario para esses links (dominio `cadastro.io`, sem branding Asaas)
5. Acompanhar status via `GET /v3/myAccount/status`

Atualmente, o sistema salva `asaas_onboarding_url` como `null` porque o campo vem de `accountNumber.onboardingUrl` na resposta de criacao, que nao e onde o Asaas retorna. Os links reais vem do endpoint `GET /v3/myAccount/documents`.

## Plano

### 1. Atualizar edge function `asaas-status` para buscar documentos pendentes

Alem de consultar o status da conta, chamar `GET /v3/myAccount/documents` usando a **API key da subconta** (nao a master key). Retornar:
- Status detalhado (`commercialInfo`, `documentation`, `general`)
- Lista de documentos pendentes com seus `onboardingUrl`
- Status geral da conta via `GET /v3/myAccount/status`

A chamada de documentos deve usar a API key da subconta (`config.asaas_api_key`) como `access_token`, pois e uma chamada `myAccount` (contexto da subconta).

Tambem adicionar um delay de seguranca: se a conta acabou de ser criada, aguardar antes de consultar documentos (conforme recomendacao da doc).

### 2. Atualizar a tela de "Pending" no `OnlinePaymentsSettings.tsx`

Quando a conta esta pendente/reprovada:
- Ao clicar "Verificar Status", chamar o `asaas-status` atualizado
- Exibir os links de onboarding (`onboardingUrl`) retornados para cada documento pendente
- Mostrar status detalhado: dados comerciais, documentacao, aprovacao geral
- Se a conta foi reprovada, exibir motivo e links para reenvio
- Cada link abre em nova aba (dominio `cadastro.io`, white-label)

### 3. Atualizar a logica de status na edge function `asaas-status`

Usar o endpoint correto `GET /v3/myAccount/status` com a API key da subconta para obter o status real:

```text
commercialInfo: APPROVED | PENDING | REJECTED | AWAITING_APPROVAL
documentation: APPROVED | PENDING | REJECTED | AWAITING_APPROVAL  
general: APPROVED | PENDING | REJECTED | AWAITING_APPROVAL
```

Salvar `asaas_account_status` com base no campo `general`:
- `APPROVED` -> "approved" (libera pagamentos)
- `REJECTED` -> "rejected"
- Outros -> "pending"

### 4. Salvar links de onboarding no banco

Adicionar coluna `asaas_documents_data` (jsonb) na tabela `online_payment_config` para armazenar o retorno de `/myAccount/documents`, incluindo os `onboardingUrl` de cada documento.

## Detalhes Tecnicos

### Edge function `asaas-status/index.ts`
- Usar `config.asaas_api_key` (subconta) para chamar `GET /v3/myAccount/documents` e `GET /v3/myAccount/status`
- Retornar `documents` (array com id, status, type, title, onboardingUrl) e `account_status` detalhado
- Atualizar `online_payment_config` com status real e dados dos documentos

### Migration
- `ALTER TABLE online_payment_config ADD COLUMN asaas_documents_data jsonb DEFAULT NULL`

### Frontend `OnlinePaymentsSettings.tsx`
- PendingView: ao carregar ou clicar "Verificar Status", chamar `asaas-status`
- Exibir cards para cada documento pendente com botao "Enviar Documento" apontando para o `onboardingUrl`
- Mostrar badges de status para cada area (dados comerciais, documentacao, geral)
- Se `general === APPROVED`, mudar viewState para "connected"
- Se `general === REJECTED`, mostrar alerta com motivos de rejeicao

