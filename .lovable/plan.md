

## Diagnostico: `internal_error` 500 do Mercado Pago com credenciais TEST

### Causa Provavel

O erro `internal_error` com status 500 da API do Mercado Pago em modo teste acontece por uma razao principal:

**Mismatch de credenciais entre frontend e backend.** O `card_token` e gerado no frontend usando a `mp_public_key` da tabela `online_payment_config`. O pagamento e processado no backend usando o `mp_access_token` da mesma tabela. **Ambas precisam ser do mesmo ambiente (TEST ou PRODUCAO).**

Se voce atualizou apenas o `mp_access_token` para TEST mas a `mp_public_key` ainda esta como `APP_USR-...` (producao), ou vice-versa, o token do cartao gerado em um ambiente nao e valido no outro — e o Mercado Pago retorna `internal_error` 500.

Alem disso, em modo teste do Mercado Pago, voce deve usar **contas de teste** (test users) e os **cartoes de teste oficiais** com dados especificos (nome, CPF de teste, etc).

### Acoes Necessarias

**1. Adicionar logging detalhado na Edge Function** para capturar o payload exato enviado ao Mercado Pago e confirmar qual access token esta sendo usado (prefixo TEST ou APP_USR).

**2. Verificar no banco** se AMBAS as credenciais (`mp_access_token` E `mp_public_key`) na tabela `online_payment_config` comecam com `TEST-`. Se apenas uma foi trocada, esse e o problema.

### Plano de Implementacao

1. **Editar `supabase/functions/mercadopago-charge/index.ts`**: Adicionar um `console.log` antes da chamada de pagamento que registre:
   - O prefixo do access token sendo usado (primeiros 8 chars)
   - O payload completo enviado ao MP (sem dados sensiveis)
   - Isso permitira diagnosticar o erro exato nos logs

2. **Nenhuma mudanca de codigo no frontend** — o problema e de configuracao ou de dados de teste.

