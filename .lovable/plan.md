

## Plano: Verificar planos/módulos + adicionar filtro de data nos Relatórios CEO

### 1. Planos e Módulos — Validação

O fluxo já está correto:
- `SubscriptionPlansTab` salva `features` como array de IDs de módulos no campo JSONB do `subscription_plans`
- `useRestaurantModules` busca o plano ativo via `restaurant_subscriptions` → `subscription_plans(features)` e filtra a sidebar
- `AppSidebar` recebe `isSectionAllowed` e esconde seções não permitidas

O mapeamento `SECTION_TO_MODULE` cobre todos os módulos definidos em `ALL_MODULES`. A lógica está funcional — nenhuma alteração necessária aqui.

### 2. Filtro de Data nos Relatórios (`CEOReportsTab.tsx`)

Adicionar dois campos de data (Data Início e Data Fim) ao lado do filtro de restaurante existente. Ao mudar as datas, refiltrar os dados.

**Mudanças no componente:**

- Adicionar estados `startDate` e `endDate` (default: primeiro dia do mês atual / hoje)
- Adicionar dois `<Input type="date">` na barra de filtros ao lado do Select de restaurante
- Passar as datas para `fetchReports()` e aplicar filtros nas queries:
  - `orders`: filtrar por `created_at` entre as datas
  - `bills`: filtrar por `paid_at` entre as datas
  - `counter_orders`: filtrar por `finalized_at` entre as datas
  - `order_items`: filtrar via join com orders no range de datas
  - `subscription_payments`: filtrar por `payment_date` entre as datas
- Re-fetch ao mudar datas (useEffect com dependências `startDate`, `endDate`)

**Arquivo afetado:** `src/components/ceo/CEOReportsTab.tsx`

Nenhuma mudança no banco de dados necessária.

