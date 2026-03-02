

## Plano: Email obrigatorio para pagamento online + salvar no CRM

### Situacao Atual

- A tabela `customers` ja tem coluna `email` (nullable).
- O `customerEmail` no checkout vem de `sessionStorage.getItem("customer_email")` — que quase nunca esta preenchido.
- A Edge Function `mercadopago-charge` recebe `customer_email` e usa fallback `cliente-{timestamp}@pedido.com` quando vazio — que causa erro 500 no sandbox.

### O Que Sera Feito

**1. Adicionar campo de email obrigatorio no `PaymentStep` quando o usuario selecionar pagamento online**

Quando o cliente selecionar PIX Online ou Cartao Online, antes de prosseguir, exibir um campo de email obrigatorio. O campo sera pre-preenchido se o cliente ja tiver email salvo no CRM (buscado via CPF). Validacao: formato de email valido + nao vazio.

**2. Buscar email salvo do CRM automaticamente**

No `PaymentStep`, ao detectar que o metodo selecionado e online, fazer query na tabela `customers` pelo CPF + restaurant_id para puxar o email salvo. Se existir, preencher automaticamente.

**3. Salvar email no CRM ao prosseguir**

Quando o usuario preencher o email e clicar em continuar, atualizar a tabela `customers` com o email informado (upsert por CPF + restaurant_id). Proxima vez que o mesmo CPF logar, o email ja estara la.

**4. Propagar o email para o `OnlinePaymentStep`**

O `PaymentStep` ja passa dados via `onContinue(data)`. Adicionar `customerEmail` ao objeto `data`. O `CheckoutDrawer` repassa esse email para o `OnlinePaymentStep`.

**5. Corrigir email para sandbox na Edge Function**

Adicionar deteccao de sandbox (`TEST-` prefix) no `mercadopago-charge` para substituir o email por `test_user_{timestamp}@testuser.com` automaticamente, resolvendo o erro 500.

### Arquivos a Editar

1. **`src/components/menu/checkout/PaymentStep.tsx`** — Adicionar state `customerEmail`, buscar do CRM por CPF, exibir campo quando metodo online selecionado, salvar no CRM ao continuar, incluir no `onContinue(data)`
2. **`src/components/menu/CheckoutDrawer.tsx`** — Ler `customerEmail` do `paymentData` e passar para `OnlinePaymentStep`
3. **`supabase/functions/mercadopago-charge/index.ts`** — Adicionar `safePayer` helper com deteccao de sandbox em todos os fluxos (PIX, cartao novo, cartao salvo)

### Nao Sera Alterado

- Tabela `customers` (ja tem coluna `email`)
- `OnlinePaymentStep` (ja recebe `customerEmail` como prop)
- Fluxo de login/identificacao do cliente (CPF + nome continuam iguais)

