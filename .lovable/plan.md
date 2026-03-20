

# Plano Completo — 7 Melhorias do Documento

Analisei cada prompt do documento contra o código atual. Abaixo está o plano detalhado com a avaliação de impacto real em funcionalidades existentes.

---

## Prompt 7 — package.json (Risco: ZERO)

**O que muda:** `name` de `vite_react_shadcn_ts` → `erp-bares-restaurantes`, `version` de `0.0.0` → `1.0.0`, adicionar `description`.

**Impacto em funcionalidades:** Nenhum. Apenas metadados cosméticos.

**Ação:** Editar 3 campos no `package.json`.

---

## Prompt 3 — Remover console.logs em prod (Risco: ZERO)

**O que muda:** Adicionar configuração `terser` no `vite.config.ts` para remover `console.log` e `console.debug` apenas no build de produção.

**Estado atual:** O `vite.config.ts` já tem bloco `build:` com rollupOptions. Basta adicionar `minify: 'terser'` e `terserOptions`. Também instalar `terser` como devDependency.

**Impacto em funcionalidades:** Nenhum. Em dev tudo continua igual. Em prod, apenas logs informativos somem (erros e warnings permanecem).

**Ação:** Editar `vite.config.ts`, adicionar `terser` ao `package.json`.

---

## Prompt 1 — Hash de senha com bcrypt (Risco: MÉDIO — ⚠️ REQUER ATENÇÃO)

**O que muda:** Criar edge function `hash-password` que faz bcrypt hash. No `CEODashboard.tsx`, antes do insert em `restaurant_credentials`, chamar essa função. Atualizar a função `validate_restaurant_credentials` no banco para usar `pgcrypto` ou criar uma edge function de verificação.

**Estado atual:**
- `CEODashboard.tsx` linha 147: insere `password_hash: formPassword` direto (texto puro).
- `RestaurantLogin.tsx` linha 22-26: chama `validate_restaurant_credentials` RPC que compara `password_hash = p_password` (comparação texto puro).
- `StaffLogin.tsx`: usa `validate_staff_credentials` RPC (mesma lógica de texto puro).

**⚠️ ALERTA DE FUNCIONALIDADE:** Esta mudança AFETA diretamente o login do restaurante e do staff. Se aplicarmos hash na criação mas não atualizarmos a verificação, **o login vai quebrar**. Além disso, **restaurantes já cadastrados** têm senhas em texto puro — eles perderiam acesso imediatamente.

**Plano seguro:**
1. Criar edge function `hash-password` (bcrypt hash)
2. Criar edge function `verify-password` (bcrypt compare)
3. Atualizar `CEODashboard.tsx` para usar hash na criação
4. Atualizar as funções SQL `validate_restaurant_credentials` e `validate_staff_credentials` para usar bcrypt via `pgcrypto`
5. Criar migração para converter senhas existentes (ou manter compatibilidade dual)

**Recomendação:** Implementar com **compatibilidade dual** — a verificação tenta bcrypt primeiro, se falhar tenta texto puro, e atualiza automaticamente para hash. Assim nenhum restaurante existente perde acesso.

---

## Prompt 2 — Reduzir `any` no TypeScript (Risco: MUITO BAIXO)

**O que muda:** Substituir tipos `any` por tipos corretos nos arquivos prioritários.

**Estado atual:** Há uso extenso de `any` (ex: `CEODashboard.tsx` linha 146 usa `as any` para contornar tipos do Supabase, `RestaurantLogin.tsx` linha 22 usa `as any`).

**Impacto em funcionalidades:** Nenhum se feito corretamente. Apenas melhora tipagem sem alterar lógica.

**Ação:** Substituir `any` por tipos reais ou `unknown` nos arquivos prioritários. Onde o `as any` é necessário por limitação do Supabase types (tabelas não expostas), manter como está.

---

## Prompt 6 — Unificar autenticação no ProtectedRoute (Risco: ALTO — ⚠️ NÃO RECOMENDADO AGORA)

**O que muda:** Remover fallback de `localStorage` no `ProtectedRoute.tsx`.

**Estado atual:**
- `RestaurantLogin.tsx` **NÃO cria sessão Supabase** — apenas grava `restaurant_id` no `localStorage`.
- `RestaurantAdmin.tsx` lê `restaurant_id` do `localStorage` para funcionar.
- `ProtectedRoute.tsx` aceita tanto sessão Supabase quanto `localStorage`.

**⚠️ ALERTA CRÍTICO:** Se removermos o fallback de `localStorage` sem antes migrar o login do restaurante para Supabase Auth, **TODOS os restaurantes perdem acesso ao painel admin**. O fluxo atual depende 100% do `localStorage`.

**Recomendação:** **NÃO APLICAR esta mudança agora.** Seria necessário primeiro reescrever todo o fluxo de login do restaurante para usar Supabase Auth, o que é uma mudança estrutural grande e com alto risco de regressão.

---

## Prompt 5 — Refatorar componentes grandes (Risco: BAIXO)

**O que muda:** Extrair subcomponentes de `ProductsTab.tsx`, `TablesTab.tsx`, `FluxoCaixaTab.tsx` e `PDVTab.tsx`.

**Impacto em funcionalidades:** Nenhum se feito como extração pura (mover JSX para componentes filhos, passar props). Zero mudança de lógica.

**Ação:** Criar subcomponentes na mesma pasta, mover blocos de JSX, passar state/handlers como props. Manter arquivo principal como orquestrador.

---

## Prompt 4 — CORS restrito nas Edge Functions (Risco: BAIXO)

**O que muda:** Substituir `'*'` por `Deno.env.get('ALLOWED_ORIGIN') || '*'` em todas as 11 edge functions.

**Estado atual:** Todas usam `Access-Control-Allow-Origin: '*'`.

**Impacto em funcionalidades:** Nenhum enquanto a variável `ALLOWED_ORIGIN` não for definida (fallback `*`). Quando configurada, restringe chamadas ao domínio correto.

**Ação:** Editar os 11 arquivos de edge functions. Criar secret `ALLOWED_ORIGIN`.

---

## Resumo de Segurança

| # | Prompt | Seguro? | Observação |
|---|--------|---------|------------|
| 7 | package.json | ✅ Sim | Zero impacto |
| 3 | Console.logs | ✅ Sim | Zero impacto |
| 1 | Hash senha | ⚠️ Com cuidado | Precisa de compatibilidade dual para não quebrar logins existentes |
| 2 | Reduzir `any` | ✅ Sim | Apenas tipagem |
| 6 | ProtectedRoute | ❌ Não aplicar | Quebraria login de todos os restaurantes |
| 5 | Refatorar componentes | ✅ Sim | Apenas reorganização |
| 4 | CORS | ✅ Sim | Fallback `*` garante segurança |

## Ordem de implementação recomendada

1. **Prompt 7** — package.json
2. **Prompt 3** — console.logs (+ instalar terser)
3. **Prompt 4** — CORS edge functions
4. **Prompt 2** — Reduzir `any`
5. **Prompt 1** — Hash de senha (com compatibilidade dual)
6. **Prompt 5** — Refatorar componentes grandes
7. **Prompt 6** — ❌ **PULAR** (requer migração completa do fluxo de autenticação)

## Próximos passos

Após sua aprovação, implemento os 6 prompts seguros na ordem acima, um por vez, para que você possa testar entre cada mudança.

