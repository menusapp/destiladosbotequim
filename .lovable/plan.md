

## Plano: Relatório de Desempenho de Produtos na Visão Geral

### Resumo
Criar um hook `useProductPerformance` que busca métricas de produtos via Supabase JS (sem migration), e um componente `ProductPerformanceSection` renderizado no final do `OverviewTab`.

---

### 1. Novo hook: `src/hooks/useProductPerformance.ts`

- Recebe `restaurantId` e `dateRange` (mesmo tipo do useOrderMetrics)
- Usa `getDateRange()` do useOrderMetrics para calcular start/end
- Faz query client-side via Supabase JS:
  - `orders` filtrado por restaurant_id, created_at no range, status NOT IN cancelled/pending
  - Join com `order_items` → `products` → `categories`
  - Inclui `order_item_extras` para receita de extras
- Agrega no JS: por product_id calcula order_count, total_quantity, total_revenue (items + extras), avg_price, category_name
- Retorna array ordenado por total_quantity DESC
- `staleTime: 5 * 60 * 1000` — usa `useQuery` do TanStack Query (já instalado no projeto)
- Nenhuma alteração no backend

### 2. Novo componente: `src/components/admin/ProductPerformanceSection.tsx`

**Layout:**
- Filtro "Top X" (5, 10, 20) no canto superior direito
- Grid `grid-cols-1 lg:grid-cols-2 gap-6`:
  - **Esquerda — Mais Vendidos**: Top N por quantidade. Cada item: posição com badge dourado/prata/bronze para 1-2-3, nome, categoria, qty com barra de progresso relativa ao 1º, receita. Barra em cor primária.
  - **Direita — Menos Vendidos**: Bottom N (com ≥1 venda). Mesma estrutura, barra em tom suave (muted).
- Grid inferior `grid-cols-2 lg:grid-cols-4` com 4 mini-cards:
  - Total de produtos vendidos (soma qty)
  - Produto mais rentável (maior receita incluindo extras)
  - Ticket médio por produto (receita total / total produtos distintos vendidos)
  - Categoria mais vendida (categoria com maior soma qty)
- Loading: Skeleton placeholders
- Empty state: "Nenhum produto vendido no período"

### 3. Integração no OverviewTab

- Importar `ProductPerformanceSection`
- Renderizar após o grid de chart + receita por método, passando `restaurantId` e `dateRange`
- Zero alteração nos cálculos financeiros existentes

### Arquivos
- **Criar**: `src/hooks/useProductPerformance.ts`
- **Criar**: `src/components/admin/ProductPerformanceSection.tsx`
- **Editar**: `src/components/admin/OverviewTab.tsx` (adicionar import + render no final)

