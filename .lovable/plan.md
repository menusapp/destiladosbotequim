

# Plan: Fix 3 Issues — Complement Names & Payment Errors

## Diagnosis

### Issue 1 — Comanda "Itens Pedidos" shows empty complement names
**Root cause**: `Comanda.tsx` lines 530-532 query `order_item_extras(price_at_order, product_extras(name))` — missing the `extra_name` column. The rendering at line 1137 filters `e.product_extras?.name` which is null for complement-category extras (they have `product_extra_id: null`). The `extra_name` field exists in the DB and IS being saved correctly, but the query doesn't fetch it.

**Fix**: Add `extra_name` to both order queries (lines 532, 546). Update the `OrderItemExtra` interface to include `extra_name`. Update rendering to use `extra_name` as primary source with `product_extras?.name` as fallback.

### Issue 2 — Delivery shows "+Extra" instead of real complement name
**Root cause**: The data is being saved correctly (`extra_name: extra.name` in CheckoutDrawer). The admin queries and rendering in `OrderDetailModal` and `UnifiedOrdersTab` already use `extra_name`. This issue is likely caused by **old records** that were inserted before the `extra_name` column was added and populated. For those records, `extra_name` is null and `product_extra_id` is null (for complements), so it falls back to `"Extra"`.

**Fix**: Run a migration to backfill `extra_name` for records where it's still null but `product_extra_id` is not null (can derive from `product_extras.name`). For complement extras where `product_extra_id` IS null and `extra_name` IS null, these are unrecoverable — the fallback text should be the category name or remain as-is. Additionally, the `NewOrderNotification` in `RestaurantAdmin.tsx` should also include `extra_name` in its query.

### Issue 3 — Payment confirmation errors
**Root cause**: The `bills` table has a CHECK constraint (`bills_payment_method_check`) that only allows: `pix`, `card`, `credit`, `debit`, `cash`, `meal_voucher`, or NULL. Two places violate this:
1. **Split payment closure** in `TableDetailDialog.tsx` line 445 inserts `payment_method: "Dividido"` — violates constraint.
2. The `PaymentConfirmationModal` correctly uses `methodType` for bills, so that part is fine. But any custom or concatenated values would fail.

**Fix**: Update the CHECK constraint to also allow `"Dividido"` (or use null for split payments). Alternatively, map `"Dividido"` to null and store the detail elsewhere.

---

## Changes

### File 1: `src/pages/Comanda.tsx`
- Add `extra_name` to `OrderItemExtra` interface (line 64-69)
- Add `extra_name` to both order queries (lines 532, 546)
- Update rendering at lines 1136-1139 to use `extra_name || product_extras?.name` instead of filtering only on `product_extras?.name`

### File 2: `src/components/admin/TableDetailDialog.tsx`
- Change `payment_method: "Dividido"` to `payment_method: null` (line 445), since the split payment detail is already tracked in `order_item_splits`

### File 3: Database Migration
- Expand `bills_payment_method_check` constraint to also allow `'voucher'` (for consistency with `SplitPaymentSelect`) — or simply drop the constraint entirely since payment methods are now dynamic per restaurant
- Backfill `extra_name` for `order_item_extras` records where `extra_name IS NULL AND product_extra_id IS NOT NULL`

### File 4: `src/pages/RestaurantAdmin.tsx` (notification query)
- Ensure the notification order query includes `extra_name` in the `order_item_extras` select

---

## Safety
- No changes to delivery creation flow, fiscal emission, iFood, or Delivery Direto
- The Comanda query change only adds a field — no data modification
- The bills constraint change is additive (more values allowed)
- The backfill migration only updates null `extra_name` fields — never overwrites existing data

