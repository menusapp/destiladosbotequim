

## Performance Optimization Plan — Admin Dashboard

### Current Problems Identified

**1. ProductsGrid.tsx — N+1 Query Problem (CRITICAL)**
`fetchProducts()` (line 214-253) makes **2 extra queries PER product** (`product_ingredients` + `product_extras` with nested joins). With 50 products, that's ~100+ sequential requests on every load AND on every realtime change.

**2. ProductsTab.tsx — Duplicate fetches**
`fetchProducts()` (line 208-234) first queries `categories` to get IDs, then queries `products` — 2 sequential requests where 1 JOIN would suffice. Also duplicates the same `categories` query already done in `fetchCategories()`.

**3. ClientesTab.tsx — N+1 Query Problem (CRITICAL)**
`queryFn` (line 83-120) runs `Promise.all` with **2 queries PER customer** (orders + comandas). With 100 customers, that's ~200 sequential requests per load.

**4. ReportsTab.tsx — Serial waterfall**
`fetchData()` (line 109-348) makes **~8 sequential requests** (costs, bills, delivery orders, restaurant config, counter orders, comandas, payment methods, then CMV + operational expenses). Most can be parallelized.

**5. Realtime triggers full refetches**
Multiple tabs (ProductsGrid, UnifiedOrdersTab, TablesTab, OverviewTab) subscribe to realtime and call full `fetchProducts()` / `fetchOrders()` on ANY change event, causing unnecessary round-trips.

**6. TablesTab.tsx — Multiple realtime channels**
Creates 4 separate realtime channels (tables, comandas, orders, reservations) where 1 multiplexed channel would suffice.

**7. Redundant realtime across tabs**
When switching between PDV and TablesTab, both have separate realtime subscriptions for `tables` and `comandas` that overlap.

**8. No all tabs are mounted but they are not lazy**
`RestaurantAdmin.tsx` imports all tabs eagerly at the top (lines 11-42). Though it uses conditional rendering, the imports themselves add to bundle size.

---

### Optimization Plan

#### Fix 1 — ProductsGrid: Batch metrics query (eliminates ~100 requests → 2)
Replace the N+1 pattern in `fetchProducts()`. Instead of querying `product_ingredients` and `product_extras` per product, fetch ALL ingredients and extras for all products in 2 bulk queries, then join client-side.

```
Before: categories(1) + products(1) + ingredients(N) + extras(N) = ~102 requests for 50 products
After:  categories(1) + products(1) + ingredients(1) + extras(1) = 4 requests total
```

**File**: `src/components/admin/ProductsGrid.tsx` — rewrite `fetchProducts()`

#### Fix 2 — ProductsTab: Merge duplicate category queries
Merge `fetchCategories()` + `fetchProducts()` into a single flow. Use `products` table with `categories!inner(...)` JOIN to avoid the extra round-trip.

**File**: `src/components/admin/ProductsTab.tsx` — merge fetch functions

#### Fix 3 — ClientesTab: Aggregate stats server-side (eliminates ~200 requests → 1)
Replace per-customer `Promise.all` with a single query. Fetch all orders for the restaurant once, then aggregate by `customer_cpf` client-side.

```
Before: customers(1) + orders(N) + comandas(N) = ~201 requests for 100 customers
After:  customers(1) + orders(1) + comandas(1) = 3 requests total
```

**File**: `src/components/admin/ClientesTab.tsx` — rewrite `queryFn`

#### Fix 4 — ReportsTab: Parallelize fetches
Group the serial requests in `fetchData()` into `Promise.all` batches. Costs, bills, delivery orders, counter orders, restaurant config, and payment methods can ALL be fetched in parallel.

```
Before: 8 sequential requests (~800ms+ at 100ms/req)
After:  1 parallel batch (~150ms)
```

**File**: `src/components/admin/ReportsTab.tsx` — restructure `fetchData()`

#### Fix 5 — Consolidate realtime channels
Merge multiple channels into fewer multiplexed ones where possible:
- TablesTab: 4 channels → 1 with multiple `.on()` calls
- PDVTab: already uses 1 channel (good)
- Prevent redundant full refetches on realtime by checking if the change is relevant

**Files**: `src/components/admin/TablesTab.tsx`

#### Fix 6 — Debounce realtime refetches
Add a simple debounce/throttle to realtime-triggered refetches so rapid consecutive changes don't cause a flood of queries.

**Files**: ProductsGrid, TablesTab, UnifiedOrdersTab — wrap refetch calls

---

### Estimated Latency Improvement

| Tab | Before (requests) | After (requests) | Estimated speedup |
|-----|----|----|----|
| Produtos (ProductsGrid) | ~102 sequential | 4 parallel | **~90% faster** |
| Clientes | ~201 sequential | 3 parallel | **~95% faster** |
| Relatório DRE | ~8 serial | 1 parallel batch | **~70% faster** |
| Pedidos | 3 (already decent) | 3 (unchanged) | — |
| Estoque | 3 sequential | 3 parallel | ~30% faster |
| Mesas | 4 + 4 channels | 3 + 1 channel | ~20% faster |
| PDV | 6 queries (react-query cached) | same, better cache | ~10% faster |

**Overall system**: The two critical N+1 patterns (Products and Clientes) account for the majority of the perceived slowness. Fixing those alone should make the admin feel near-instant.

### What will NOT change
- No changes to delivery menu, checkout, or customer-facing flows
- No changes to database schema or RLS
- Realtime subscriptions remain active (data stays live)
- All existing functionality preserved
- No changes to authentication or routing

