

## Plan: 7 Improvements

### 1. Move Categorias and Destaques tabs to Configuracoes Gerais > Cardapio sub-tab

**Current**: CardapioTab has 4 sub-tabs (Produtos, Categorias, Complementos, Destaques).
**Change**: Remove Categorias and Destaques tabs from CardapioTab (keep only Produtos and Complementos). Add them as sections inside the existing "Cardapio" sub-tab in CompanyDataSettings, below the existing "Pedir Conta" toggle.

**Files**: `src/components/admin/CardapioTab.tsx`, `src/components/admin/settings/CompanyDataSettings.tsx`

---

### 2. Fix Planos page alignment

**Current**: `max-w-5xl mx-auto px-4 py-8` — cards float in center with excess whitespace.
**Change**: Remove `max-w-5xl mx-auto` and reduce padding. Use `w-full` so the plans grid fills the content area naturally, matching other admin tabs.

**File**: `src/components/admin/ModulosTab.tsx`

---

### 3. Suppress PDV order notifications

**Current**: Every new order INSERT triggers a popup notification via realtime channel.
**Change**: Add a `pdv_source` boolean column to the `orders` table (default false). When PDVTab or CreateOrderDrawer creates an order, set `pdv_source: true`. In the notification handler in RestaurantAdmin, skip notification if `order.pdv_source === true`.

**Files**: DB migration (add `pdv_source`), `src/components/admin/PDVTab.tsx`, `src/components/admin/CreateOrderDrawer.tsx`, `src/pages/RestaurantAdmin.tsx`

---

### 4. PDV orders (Delivery/Retirada/Viagem) start as "Preparando"

**Current**: All PDV orders are created with `status: "pending"`.
**Change**: In PDVTab, for delivery, retirada, and viagem order types, insert with `status: "preparing"` instead of `"pending"`. Mesa orders stay as `"pending"`. Same change in CreateOrderDrawer for non-mesa types.

**Files**: `src/components/admin/PDVTab.tsx`, `src/components/admin/CreateOrderDrawer.tsx`

---

### 5. Auto-print toggle in PDV

**Current**: No auto-print option in PDV.
**Change**: Add a "Imprimir Automaticamente" toggle button in the PDV header area. Store preference in localStorage (`pdv_auto_print`). After order creation succeeds, if enabled, call `printOrder()` with the newly created order data automatically.

**Files**: `src/components/admin/PDVTab.tsx` (add toggle + auto-print logic after order creation)

---

### 6. Internal scrolling for each cost category in CostosTab

**Current**: All cost lists render in a single scrollable card.
**Change**: Wrap each cost list (Custos Operacionais, Custos Variaveis, Mao de Obra) in a container with `max-h-[200px] overflow-y-auto` so each section scrolls independently when it has many items.

**File**: `src/components/admin/CostosTab.tsx`

---

### 7. Global 90% zoom

**Current**: Default 100% browser zoom scale.
**Change**: Add `font-size: 90%` or `zoom: 0.9` to the `#root` element in `src/index.css` for the admin layout. Use `transform: scale(0.9)` with `transform-origin: top left` and adjusted width on the admin wrapper to achieve a uniform 90% scale without breaking layouts.

**File**: `src/index.css` — add a CSS rule targeting the admin panel root. Specifically, set `font-size: 14.4px` (90% of 16px) on `html` and use relative units, or simpler: apply `zoom: 0.9` on the admin `SidebarInset` wrapper in RestaurantAdmin.tsx.

