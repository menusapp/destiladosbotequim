
Objetivo: explicar por que “antes funcionava” e definir a correção estável para continuar em modo teste sem erro `Payer email forbidden`.

Diagnóstico confirmado (com evidência):
- O backend está em modo teste hoje (`mp_access_token` com prefixo `TEST-` em `online_payment_config`).
- O erro atual não é mais genérico: é `403 / 4390 Payer email forbidden`.
- O fluxo atual tenta criar test user automaticamente (`POST /users/test_user`), mas essa chamada está sendo bloqueada (`PA_UNAUTHORIZED_RESULT_FROM_POLICIES`), então cai no fallback `test_user_{timestamp}@testuser.com`.
- Esse fallback é rejeitado, porque não corresponde a um test user válido.
- Por isso “agora dá erro”: o projeto está operando em contexto de validação sandbox mais rígida (e a criação automática de test user não está autorizada com as credenciais atuais). Antes provavelmente estava em outro contexto de credencial/comportamento e não batia nessa regra.

Plano de correção (implementação):
1) Remover a dependência de criação automática de test user no runtime
- Em `supabase/functions/mercadopago-charge/index.ts`, retirar o fallback que inventa `@testuser.com` e parar de depender de `POST /users/test_user` para cada cobrança.

2) Adicionar email de teste fixo e válido por restaurante
- Criar coluna nova em `online_payment_config` (ex.: `mp_sandbox_payer_email`).
- Esse campo guardará um email de test user real (válido no ambiente de teste).

3) Expor esse campo nas configurações de pagamento
- Em `src/components/admin/settings/OnlinePaymentsSettings.tsx`, mostrar input “Email de teste (sandbox)” quando token for `TEST-`.
- Salvar esse email na configuração.

4) Regras finais de email no `mercadopago-charge`
- Se token `TEST-`: usar `mp_sandbox_payer_email` (obrigatório); se ausente, retornar erro claro para o admin configurar.
- Se produção: usar email do cliente normalmente (com fallback atual).

5) Ajuste de bug secundário no mesmo arquivo
- Corrigir referência residual `safePayer(...)` no bloco de “salvar cartão” (hoje ficou inconsistente após refactor), para evitar erro futuro nesse caminho.

Resultado esperado:
- Em teste: pagamentos deixam de falhar por `Payer email forbidden`.
- Em produção: segue fluxo normal com email real do cliente.
- Mensagem de erro passa a ser acionável quando faltar configuração de sandbox.

Detalhes técnicos:
```text
Checkout (cliente)
   -> mercadopago-charge
      -> lê online_payment_config
         -> token TEST- ?
            -> usa mp_sandbox_payer_email (válido)
            -> cria pagamento
         -> token produção ?
            -> usa customer_email
            -> cria pagamento
```

Observações de segurança e dados:
- Sem mudança de permissões/RLS para este ajuste específico.
- Mudança de banco restrita a tabela pública existente (`online_payment_config`), sem tocar schemas reservados.
- Mantém rastreabilidade por restaurante e evita lógica frágil de criação dinâmica de test user em cada transação.
