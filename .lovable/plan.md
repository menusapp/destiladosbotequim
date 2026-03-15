

## Plano de Execucao: 8 Correcoes Criticas

---

### 1. Single Source of Truth — `useOrderMetrics` hook

**Problema:** `OverviewTab` usa `VALID_STATUSES = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"]` (inclui pedidos em preparo!). `ReportsTab` usa `bills.status = "paid"` para local e `status IN ["delivered", "picked_up"]` para delivery. Calculo diferente = numeros diferentes.

**Solucao:** Criar `src/hooks/useOrderMetrics.ts` com:
- `getDateRange(range)` unificado (reusa a logica existente)
- `FINALIZED_STATUSES = ["delivered", "picked_up"]` — UNICA fonte de verdade
- Funcao `fetchOrderMetrics(restaurantId, start, end)` que retorna: totalSales, ordersCount, averageTicket, localSales, deliverySales, revenueByMethod, hourlySales
- Query unificada: `orders` filtrados por `.in("status", FINALIZED_STATUSES)` + `counter_orders` com `status = "paid"` + `bills` com `status = "paid"`
- `OverviewTab` e `ReportsTab` ambos consomem esse hook

**Arquivos:** Criar `src/hooks/useOrderMetrics.ts`, editar `OverviewTab.tsx` e `ReportsTab.tsx`

---

### 2. Link Publico de Reservas

**Problema:** `TablesTab` ja tem `handleCopyReservationLink()` (linha 521-525) mas nao exibe o link visualmente.

**Solucao:** Na aba de Reservas dentro de `TablesTab`, quando `reservationsEnabled = true`, adicionar no topo um bloco com `Input readOnly` contendo `${window.location.origin}/${restaurantSlug}/reservas` + botao "Copiar Link" com icone `Copy`.

**Arquivo:** `TablesTab.tsx`

---

### 3. Remover botao verde "Falar com suporte"

**Problema:** `AppSidebar.tsx` linhas 216-223 tem botao verde de suporte duplicado (ja existe widget laranja).

**Solucao:** Deletar o `SidebarMenuItem` com `"Falar com Suporte"` do `AppSidebar.tsx`.

**Arquivo:** `AppSidebar.tsx`

---

### 4. Traduzir `meal_voucher` para "Vale Refeicao"

**Problema:** Em `FluxoCaixaTab.tsx` linhas 768 e 965, `mov.payment_method` e renderizado cru (ex: "meal_voucher", "cash", "credit"). Nao ha mapeamento de labels.

**Solucao:** Criar funcao utilitaria `formatPaymentMethod(method: string): string` em `src/lib/utils.ts` com mapeamento:
```
cash → Dinheiro, credit → Credito, debit → Debito, pix → PIX, 
meal_voucher → Vale Refeicao, pending → Pendente
```
Aplicar em: `FluxoCaixaTab.tsx` (linhas 768, 965), `CashMovementDetailSheet.tsx`, `OverviewTab.tsx` (methodLabels), e qualquer outro ponto que renderize `payment_method` cru.

**Arquivos:** `src/lib/utils.ts`, `FluxoCaixaTab.tsx`, `CashMovementDetailSheet.tsx`, `OverviewTab.tsx`

---

### 5. Redesign Categorias do Estoque

**Problema:** `StockCategoriesTab.tsx` usa grid de Cards com layout diferente do `CategoriesTab.tsx` (Cardapio).

**Solucao:** Refatorar `StockCategoriesTab` para usar layout de lista vertical simples (como CategoriesTab do cardapio): cada categoria em uma linha com nome + botoes Editar/Excluir alinhados a direita. Sem cards pesados, apenas rows com `border-b` e `hover:bg-muted/50`.

**Arquivo:** `StockCategoriesTab.tsx`

---

### 6. Caixa Minimalista

**Problema:** `FluxoCaixaTab.tsx` usa cores fortes: `border-orange-200`, `text-orange-700`, `bg-orange-500`, `hover:bg-orange-600`, `bg-orange-50/50`, `border-orange-100`.

**Solucao:** Substituir:
- `border-orange-*` → `border` (default border)
- `text-orange-700` → `text-foreground`
- `bg-orange-500 hover:bg-orange-600` → `bg-primary hover:bg-primary/90`
- `bg-orange-50/50` → `hover:bg-muted/50`
- `text-orange-600` (entrada) → `text-green-600`
- `text-orange-800` (saida) → `text-red-600`
- Manter numeros legiveis com `font-mono` para valores

**Arquivo:** `FluxoCaixaTab.tsx`

---

### 7. Clientes — Emojis + Scroll

**Emojis:** Linhas 293-297 de `ClientesTab.tsx`: remover emojis dos SelectItems:
- `💰 Mais gasto` → `Mais gasto`
- `📉 Menos gasto` → `Menos gasto`
- `🆕 Recentes` → `Recentes`
- `📅 Mais antigos` → `Mais antigos`
- `🔤 A-Z` → `A-Z`

**Scroll:** Linha 303 tem `ScrollArea className="h-[600px]"`. Trocar para `max-h-[calc(100vh-280px)]` para adaptar a viewport.

**Arquivo:** `ClientesTab.tsx`

---

### 8. Rolagem Interna Padrao (Global)

Aplicar `overflow-y-auto max-h-[calc(100vh-250px)]` nos containers de conteudo de:
- `ProductsTab.tsx` — grid de produtos
- `StockCategoriesTab.tsx` — lista de categorias
- `StockItemsGrid.tsx` — grid de insumos
- `CardapioTab.tsx` — container principal de conteudo
- `CategoriesTab.tsx` — lista de categorias do cardapio

Padrao: header/tabs ficam fixos, apenas o conteudo da lista rola.

**Arquivos:** `ProductsTab.tsx`, `StockCategoriesTab.tsx`, `StockItemsGrid.tsx`, `CardapioTab.tsx`, `CategoriesTab.tsx`

---

### Resumo de Arquivos

| Acao | Arquivo |
|---|---|
| Criar | `src/hooks/useOrderMetrics.ts` |
| Editar | `src/components/admin/OverviewTab.tsx` |
| Editar | `src/components/admin/ReportsTab.tsx` |
| Editar | `src/components/admin/TablesTab.tsx` |
| Editar | `src/components/admin/AppSidebar.tsx` |
| Editar | `src/lib/utils.ts` |
| Editar | `src/components/admin/FluxoCaixaTab.tsx` |
| Editar | `src/components/admin/CashMovementDetailSheet.tsx` |
| Editar | `src/components/admin/ClientesTab.tsx` |
| Editar | `src/components/admin/StockCategoriesTab.tsx` |
| Editar | `src/components/admin/StockItemsGrid.tsx` |
| Editar | `src/components/admin/ProductsTab.tsx` |
| Editar | `src/components/admin/CardapioTab.tsx` |
| Editar | `src/components/admin/CategoriesTab.tsx` |

Nenhuma migracao de banco necessaria.

