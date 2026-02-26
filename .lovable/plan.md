

## Diagnóstico: Credenciais NÃO estão em modo teste

As credenciais na tabela `online_payment_config` (que são as efetivamente usadas tanto no frontend quanto na Edge Function) ainda são de **produção**:

- `mp_public_key`: `APP_USR-4393506a...` (produção — teste começa com `TEST-`)
- `mp_access_token`: `APP_USR-1390445...` (produção — teste começa com `TEST-`)

O erro `bin_not_found` nos logs confirma: você está tentando usar cartões de teste com credenciais de produção. O Mercado Pago rejeita porque os BINs dos cartões de teste só funcionam com credenciais de teste.

**Os secrets do projeto não são usados pelo sistema de pagamento.** O código busca as credenciais diretamente da tabela `online_payment_config` no banco de dados. Atualizar os secrets não muda nada.

## Plano

### Passo 1 — Atualizar credenciais na tabela do banco de dados

Executar um SQL migration para atualizar os campos `mp_access_token` e `mp_public_key` na tabela `online_payment_config` com os valores de teste. Como não posso ver os valores dos secrets, vou criar uma abordagem onde o usuário insere as credenciais via painel de settings (que já existe).

**Alternativa rápida**: Se o usuário fornecer as credenciais TEST, posso rodar um UPDATE direto na tabela.

### Passo 2 — Verificar se o painel de Settings já salva na tabela correta

Verificar `OnlinePaymentsSettings.tsx` para confirmar que o fluxo de configuração do MP salva na tabela `online_payment_config`. Se sim, basta o usuário ir em Settings e colar as novas credenciais de teste lá.

O usuário precisa ir nas **Configurações > Pagamentos Online** do painel admin e atualizar o Access Token e Public Key para os valores de teste (que começam com `TEST-`). Essa é a única forma de realmente trocar as credenciais usadas pelo sistema.

