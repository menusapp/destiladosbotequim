

## Plan: Show ingredient cost values in variable variations

**What you reported**: Fixed ingredients already show the cost (e.g., "0,22kg de acém — R$ 6,60"), but variable ingredient variations only show the name and quantity without the corresponding cost.

**Root cause**: In `ProductsGrid.tsx`, line 951, variation ingredients are displayed as:
```
{i.stock_item_name} — {i.quantity}{i.stock_item_unit}
```
Missing the cost calculation that fixed ingredients have on line 891.

### Changes

**File: `src/components/admin/ProductsGrid.tsx`**

Two places need the cost display added:

1. **Line 928-930 (New variation ingredient list — editing mode)**: Change the ingredient display from just name/quantity to also show the cost value:
   - From: `{ing.stock_item_name} — {ing.quantity} {ing.stock_item_unit}`
   - To: `{ing.stock_item_name} — {ing.quantity} {ing.stock_item_unit}` + `R$ {((ing.stock_item_price || 0) * ing.quantity).toFixed(2)}`

2. **Line 951 (Saved variations list)**: Change the ingredient summary from just name/quantity to include cost:
   - From: `` `${i.stock_item_name} — ${i.quantity}${i.stock_item_unit}` ``
   - To: `` `${i.stock_item_name} — ${i.quantity}${i.stock_item_unit} (R$ ${((i.stock_item_price || 0) * i.quantity).toFixed(2)})` ``

Both changes mirror the pattern already used for fixed ingredients on line 891.

