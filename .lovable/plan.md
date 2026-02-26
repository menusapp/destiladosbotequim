

## Diagnóstico

O erro `not found public_key: TEST-1390445596449726-...` confirma que o campo `mp_public_key` na tabela `online_payment_config` contém o **Access Token** em vez da **Public Key**. Os valores foram trocados ou duplicados durante a sincronização anterior.

- O valor `TEST-1390445596449726-012111-...` é formato de **Access Token** (numérico longo)
- Uma Public Key de teste tem formato diferente, tipicamente `TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (formato UUID)

## Plano

### Passo 1 — Corrigir mp_public_key no banco de dados

Criar e executar uma Edge Function temporária (`fix-mp-keys`) que:
1. Leia o secret `MERCADOPAGO_PUBLIC_KEY` (que deve conter a public key correta)
2. Leia o secret `MERCADOPAGO_ACCESS_TOKEN` (access token correto)
3. Atualize a tabela `online_payment_config` com os valores nos campos corretos:
   - `mp_public_key` ← `MERCADOPAGO_PUBLIC_KEY`
   - `mp_access_token` ← `MERCADOPAGO_ACCESS_TOKEN`

### Passo 2 — Verificar se os secrets estão corretos

Se ambos os secrets contêm o mesmo valor (access token), será necessário pedir ao usuário para atualizar o secret `MERCADOPAGO_PUBLIC_KEY` com o valor correto do portal do Mercado Pago.

### Passo 3 — Deletar a Edge Function temporária

