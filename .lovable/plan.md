## Problema

O restaurante `8713e59b...` tem assinatura `active` do plano **Básico** (features `["cardapio","delivery","whatsapp"]`) mas todas as abas aparecem liberadas.

Diagnóstico (DB confirma que os dados estão corretos):
- `subscription_plans` tem os 3 planos com `features` corretos.
- `restaurant_subscriptions` tem 1 linha `active` por restaurante (Básico para esse caso).
- RLS é aberta (`anon` lê normalmente).

A causa raiz está em `src/hooks/useRestaurantModules.ts`:

1. **Fail-open por padrão.** `allowedModules` é inicializado como `null`. A função `isSectionAllowed` faz `if (allowedModules === null) return true;` — então durante o loading, em qualquer erro de fetch, ou se o join `subscription_plans(features)` voltar vazio, **todas as seções liberam**. É isso que está acontecendo na prática.
2. **Query frágil.** Usa `.maybeSingle()` em cima de uma tabela com histórico (cancelled/suspended) e join aninhado. Se voltar mais de uma `active` por race condition do webhook (pode acontecer), retorna erro 406 → cai no `catch` → seta `null` → libera tudo.
3. **`SectionWrapper`** em `RestaurantAdmin.tsx` (linha 809) reforça o fail-open: `const checkAllowed = (id) => !isSectionAllowed || isSectionAllowed(id);` — a função sempre existe, mas como `isSectionAllowed(id)` devolve `true` quando `allowedModules` é `null`, nada é bloqueado.

## Correções

### 1. `src/hooks/useRestaurantModules.ts`

- Trocar `.maybeSingle()` por `.limit(1)` e pegar `data?.[0] ?? null` (segue a regra do projeto sobre `single-query-errors` e evita 406 com múltiplas linhas).
- Buscar explicitamente `plan_id, status, is_trial, trial_ends_at, next_payment_at, subscription_plans(name, features)` em vez de `*`.
- Adicionar estado `loaded: boolean` separado de `loading`. Enquanto `loaded === false`, **`isSectionAllowed` retorna `false`** para seções não-`ALWAYS_AVAILABLE` (fail-closed). Isso evita o flash de "liberado" enquanto a query roda.
- Após carregar:
  - Se houver assinatura ativa válida: `allowedModules = plan.features ?? []`.
  - Se NÃO houver assinatura ativa e o trial não estiver válido: `allowedModules = []` (tudo bloqueado, exceto `ALWAYS_AVAILABLE` e `modulos`).
  - Se trial ativo (não expirado, sem assinatura): `allowedModules = []` mas `isTrial=true` (mantém comportamento atual de trial).
- Manter `ALWAYS_AVAILABLE` (inclui `modulos`, `visao-geral`, configs básicas) sempre liberado para o usuário poder navegar até a aba de planos.
- Logar via `console.warn` quando o fetch falhar, para debug futuro — mas **não** liberar acesso.

### 2. `src/pages/RestaurantAdmin.tsx` — `SectionWrapper`

- Substituir `const checkAllowed = (id) => !isSectionAllowed || isSectionAllowed(id);` por chamada direta `isSectionAllowed(id)` (a função sempre existe vinda do hook).
- Ler também `loaded` do hook e, enquanto não carregou, renderizar um skeleton/placeholder simples ao invés do conteúdo da aba — evita o flash.

### 3. Sem alteração de mapa de planos

Os `features` já vêm do banco corretamente para os 3 planos (Básico/Intermediário/Avançado). **Não é necessário** criar um `PLAN_MODULES` hardcoded — a fonte da verdade já é `subscription_plans.features`. O mapa `SECTION_TO_MODULE` no hook já cobre as seções da sidebar.

### 4. `BlockedOverlay` — sem alteração

Já existe e é renderizado pelo `SectionWrapper` com `reason='plan'`. Após as correções acima, abas como PDV, Estoque, Financeiro, Fidelidade, Marketing, Fiscal, Reservas, Mesas etc. passarão a aparecer com o overlay de blur + botão "Ver planos e fazer upgrade" para o restaurante Básico.

### Fora de escopo (preservar)

Nenhuma alteração em fluxo de pedidos, pagamentos, iFood, Delivery Direto, fiscal ou checkout. Apenas o hook de módulos e o wrapper de seções no admin.

## Resultado esperado

Para o restaurante Básico (`8713e59b...`):
- Liberado: Visão Geral, Cardápio, Pedidos Online (delivery), WhatsApp, Módulos, Contas, configs básicas.
- Bloqueado com overlay: PDV, Mesas/Reservas, Caixa, Estoque, Custos, Margens, Relatórios, Clientes, Fidelidade, Marketing, Fiscal, Pagamentos Online, Totem.
