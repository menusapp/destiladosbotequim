

## Plan: Soft-unlink on deletion (categories, products, stock items)

### Goal
- Deleting a **category** removes the category but keeps products (they become uncategorized)
- Deleting a **product** removes the product but keeps stock items (only the link in `product_ingredients` is removed)
- Deleting a **stock item** removes the stock item but keeps products (only the link in `product_ingredients` is removed)

### Current behavior (problematic)
1. FK `products.category_id → categories(id) ON DELETE CASCADE` — deletes all products when category is deleted
2. Function `admin_delete_category` explicitly loops and calls `admin_delete_product` for each product before deleting category
3. Function `admin_delete_product` deletes `product_ingredients`, `product_extras`, `product_extra_ingredients`, then the product
4. FK `product_ingredients.stock_item_id → stock_items(id) ON DELETE CASCADE` — deletes ingredient links when stock item deleted (this one is already correct behavior)
5. FK `product_ingredients.product_id → products(id) ON DELETE CASCADE` — deletes ingredient links when product deleted (also correct)

### Changes

**Migration (1 file):**

1. **Change FK on `products.category_id`** from `ON DELETE CASCADE` to `ON DELETE SET NULL`
   - First make `category_id` nullable (currently `NOT NULL`)
   - Drop and re-create the FK constraint
   - Drop the unique constraint `products_name_category_unique` and re-create it to allow NULL category_id

2. **Replace `admin_delete_category` function** — new version just sets `category_id = NULL` on all products in the category, then deletes the category. No more product deletion.

3. **`admin_delete_product` function** — keep as-is. It correctly removes ingredient links (junction table rows) before deleting the product. Stock items are untouched.

4. Stock item deletion — FKs already use `ON DELETE CASCADE` on the junction tables (`product_ingredients`, `product_extra_ingredients`), which only removes the **link rows**, not the products themselves. This is already correct behavior.

**Code changes (2-3 files):**

1. **`ProductsGrid.tsx`** — handle products with `category_id = null` (show "Sem categoria" or similar)
2. **Menu pages** (`Menu.tsx`, `DeliveryMenu.tsx`, `Kiosk.tsx`) — ensure uncategorized products still appear (e.g., in a "Outros" section)
3. **`StockTab.tsx`** or related — no changes needed since stock item deletion already only removes junction rows

### Safety
- No changes to delivery, PDV, mesas, fiscal, or order flows
- Products remain fully functional without a category — they just need to be displayed somewhere
- Stock items remain fully functional when unlinked from products

