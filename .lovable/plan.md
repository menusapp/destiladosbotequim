

# Plan: 5 Fixes — Stock Scroll, Payment Brand, PDV Extras, PDV Discount, Report Consistency

## 1. Stock Movements — Internal Scroll
**File**: `src/components/admin/StockMovementsTab.tsx`
- Wrap the table (line 250) in a `max-h-[60vh] overflow-y-auto` container
- Make `TableHeader` sticky with `sticky top-0 bg-background z-10`

## 2. Payment Brand Display in Order Lists
**Problem**: `UnifiedOrdersTab` and `OrderDetailModal` fetch `payment_type` but not `payment_brand`. The PDV saves brand correctly (`payment_brand: "visa"`) but display ignores it.

**Files**:
- `src/components/admin/UnifiedOrdersTab.tsx`: Add `payment_brand` to the Order interface and fetch query (line 221). Update `getPaymentDisplay` to combine: if `payment_brand` exists and `payment_type` doesn't already contain the brand, append it (e.g. `"Crédito"` + `"visa"` → pass `"Crédito - Visa"` to `formatPaymentMethod`).
- `src/components/admin/OrderDetailModal.tsx`: Same — add `payment_brand` to interface/query and display combined value.
- `src/lib/utils.ts`: Add helper `formatPaymentWithBrand(type, brand)` that combines type+brand before calling `formatPaymentMethod`.

## 3. PDV Orders — Extras Missing in Cash Register
**Problem**: PDV orders (all types) insert with `payment_type` already set. The DB trigger `add_local_order_to_cash_register` fires on UPDATE (when `payment_type` transitions from null to a value). Since PDV sets it on INSERT, trigger never fires for mesa orders. Also delivery PDV orders get `status: "preparing"` immediately, but the delivery trigger looks for `delivered`/`picked_up`.

**Fix in `src/components/admin/CreateOrderDrawer.tsx`**:
- For **mesa** orders: Insert with `payment_type: null`, insert order items+extras, then UPDATE with real `payment_type`. This fires the trigger which now sees items+extras.
- For **delivery/retirada**: Already work correctly (trigger fires on status change to delivered/picked_up). No change needed.

## 4. PDV Drawer — Discount Field
**File**: `src/components/admin/CreateOrderDrawer.tsx`
- Add state: `discountType` ("percentage" | "fixed"), `discountValue` (number)
- Add UI section in the form (between payment and cart summary): toggle for % vs R$, input for value
- Calculate `discountAmount` from subtotal
- Show discount line in cart summary, update total display
- Save to `coupon_discount` column on order insert (already exists in DB and used by reports)

## 5. Reports Consistency — Overview vs DRE
**Problem**: Overview uses `useOrderMetrics` which filters delivery orders by `created_at`. DRE (`ReportsTab`) filters delivery orders by `updated_at` (line 135). Orders created on one day but delivered on another appear in different date ranges.

**Fix in `src/components/admin/ReportsTab.tsx`**:
- Change delivery orders query (line 135) from `updated_at` to `created_at` to match `useOrderMetrics`
- Both will now use: delivery by `created_at`, bills by `paid_at`, counter_orders by `finalized_at`
- Also add `order_type: "balcao"` orders to the delivery query (line 133 already has `in("order_type", ["delivery", "balcao"])`) — this matches `useOrderMetrics` which only queries `order_type: "delivery"`. Need to align: make ReportsTab also only count `order_type: "delivery"` for delivery total, and handle `balcao` via counter_orders (same as useOrderMetrics). Actually looking closer, ReportsTab queries `in("order_type", ["delivery", "balcao"])` while useOrderMetrics only queries `order_type: "delivery"`. The "balcao" orders get double-counted if they also appear in counter_orders. Fix: Remove "balcao" from ReportsTab delivery query to match useOrderMetrics.

## Files Modified
1. `src/components/admin/StockMovementsTab.tsx` — scroll container
2. `src/lib/utils.ts` — `formatPaymentWithBrand` helper
3. `src/components/admin/UnifiedOrdersTab.tsx` — payment_brand in query + display
4. `src/components/admin/OrderDetailModal.tsx` — payment_brand in query + display
5. `src/components/admin/CreateOrderDrawer.tsx` — fix mesa order trigger timing, add discount UI
6. `src/components/admin/ReportsTab.tsx` — align date field and order_type filter with useOrderMetrics

## Safety
- No DB schema changes
- No changes to triggers, fiscal, or checkout flows
- PDV fix only changes INSERT/UPDATE ordering for mesa orders
- Report fix only aligns query filters — same data sources

