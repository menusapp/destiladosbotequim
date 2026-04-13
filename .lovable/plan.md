

## Plano: 3 Melhorias no Sistema

---

### Melhoria 1 — Otimizar carregamento da Visão Geral

**Diagnóstico atual:**
- `OverviewTab` usa `useOrderMetrics` que já faz `Promise.all` para 5 queries em paralelo (delivery, bills, counter, totem, payment_methods) -- isso está OK
- Porém não usa `react-query` / `useQuery` -- é um `useState` + `useEffect` manual sem `staleTime`
- Loading state mostra texto simples "Carregando..." sem skeleton
- `ProductPerformanceSection` carrega junto, sem lazy loading
- Realtime listener faz `refetch()` a cada mudança em `orders` ou `bills`, sem debounce

**Alterações:**

1. **`src/components/admin/OverviewTab.tsx`**
   - Substituir loading text por skeleton cards (5 cards + chart placeholder + method card)
   - Envolver `ProductPerformanceSection` em lazy load com `Suspense` + skeleton, carregando apenas após cards superiores renderizarem (usar estado `dataLoaded`)
   - Adicionar debounce de 2s no refetch do realtime para evitar múltiplas chamadas

2. **`src/hooks/useOrderMetrics.ts`**
   - Migrar para `useQuery` do react-query com `staleTime: 2 * 60 * 1000` para evitar re-fetches desnecessários
   - Manter `refetch` exposto para realtime
   - Selects já são específicos (não usam `select('*')`) -- sem mudança necessária

3. **`src/hooks/useProductPerformance.ts`**
   - Verificar e adicionar `staleTime: 5 * 60 * 1000` se não existir (já usa react-query pelo contexto do código)

**Nenhuma métrica ou cálculo será alterado.**

---

### Melhoria 2 — Abas bloqueadas com blur em vez de ocultas

**Diagnóstico atual:**
- `AppSidebar.tsx` filtra abas via `checkAllowed()` e `isStaffAllowed()` -- abas bloqueadas simplesmente não aparecem
- `RestaurantAdmin.tsx` força `setActiveSection("modulos")` quando `hasActiveSubscription === false`
- `useRestaurantModules` retorna `isSectionAllowed`, `allowedModules`, `hasActiveSubscription`

**Alterações:**

1. **Novo hook: `src/hooks/usePageAccess.ts`**
   - `usePageAccess(sectionId)` retorna `{ hasAccess, reason: 'plan' | 'permission' | null, currentPlanName, requiredPlanName }`
   - Usa `isSectionAllowed` do `useRestaurantModules` + staff permissions

2. **`src/components/admin/AppSidebar.tsx`**
   - Remover filtragem de abas -- mostrar todas sempre
   - Abas bloqueadas ficam visíveis mas com estilo mais sutil (opacity reduzida, ícone de cadeado pequeno)

3. **Novo componente: `src/components/admin/BlockedOverlay.tsx`**
   - Overlay com blur para plano insuficiente (com botão "Ver planos")
   - Overlay para permissão de staff (com mensagem de contato ao admin)

4. **`src/pages/RestaurantAdmin.tsx`**
   - Remover o `useEffect` que força `modulos` quando sem assinatura
   - No `renderContent()`, envolver cada tab em verificação: se bloqueado, renderizar tab + overlay por cima
   - Quando bloqueado, passar `enabled: false` para queries internas (evitar requests)

**Nenhuma lógica de autenticação ou planos será alterada.**

---

### Melhoria 3 — Trial gratuito de 7 dias

**Backend:**

1. **Migration SQL:**
   - Adicionar colunas em `restaurants`: `trial_started_at`, `trial_ends_at`, `trial_expired`
   - Adicionar coluna em `restaurant_subscriptions`: `is_trial`

2. **Edge function `register-restaurant/index.ts`:**
   - Aceitar `planSlug = "trial"` como opção válida
   - Quando trial: criar subscription com `is_trial = true`, `status = 'active'`, plan_id = plano Básico, `trial_ends_at = now() + 7 days`
   - Salvar `trial_started_at` e `trial_ends_at` no restaurante
   - Criar também o staff admin automaticamente (para login direto)

3. **Nova edge function `check-trial-expiry/index.ts`:**
   - Expira trials vencidos (update subscriptions + restaurants)
   - Chamada via cron job diário (pg_cron)

**Frontend:**

4. **`src/pages/LandingPage.tsx`:**
   - Alterar CTAs para "Criar cardápio grátis"
   - Ao clicar, navegar para `/registro/trial`

5. **`src/pages/RestaurantRegistration.tsx`:**
   - Aceitar `planSlug = "trial"`
   - Simplificar formulário: nome restaurante, tipo, e-mail, senha (passo 1)
   - Passo 2 opcional: primeira categoria + até 3 produtos
   - Passo 3: confirmação com countdown de 7 dias + botão "Acessar meu painel"

6. **`src/hooks/useRestaurantModules.ts`:**
   - Detectar trial ativo e trial expirado
   - Retornar `isTrial`, `trialEndsAt`, `trialExpired`

7. **`src/components/admin/BlockedOverlay.tsx`** (do item 2):
   - Adicionar variante de trial expirado com ícone Clock, mensagem sobre 7 dias, botão "Ver planos"

**Nenhum fluxo de pagamento, iFood, Delivery Direto ou fiscal será alterado.**

---

### Arquivos impactados (resumo)

| Arquivo | Ação |
|---------|------|
| `src/components/admin/OverviewTab.tsx` | Skeleton + lazy ProductPerformance |
| `src/hooks/useOrderMetrics.ts` | Migrar para useQuery com staleTime |
| `src/hooks/useProductPerformance.ts` | Adicionar staleTime |
| `src/hooks/usePageAccess.ts` | Novo hook |
| `src/components/admin/BlockedOverlay.tsx` | Novo componente |
| `src/components/admin/AppSidebar.tsx` | Mostrar todas as abas |
| `src/pages/RestaurantAdmin.tsx` | Overlay em vez de ocultar |
| `src/hooks/useRestaurantModules.ts` | Adicionar trial info |
| `src/pages/LandingPage.tsx` | CTAs para trial |
| `src/pages/RestaurantRegistration.tsx` | Fluxo trial step-by-step |
| `supabase/functions/register-restaurant/index.ts` | Suporte a trial |
| `supabase/functions/check-trial-expiry/index.ts` | Nova function |
| Migration SQL | Colunas trial |

