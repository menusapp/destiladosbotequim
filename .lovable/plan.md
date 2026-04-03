

## Plan: Softer selection styling + show descriptions in ProductDetailDrawer

### Changes

**1. `src/types/menu.ts`** — Add `description?: string | null` to `ProductExtra` interface.

**2. `src/components/menu/ProductDetailDrawer.tsx`** — Two changes:
- **Softer selection colors**: Replace `border-primary bg-accent/50` with a subtle tint using `primaryColor` at ~8% opacity for background and ~30% opacity for border. This applies to all 3 label blocks (required radio, required checkbox, optional checkbox).
- **Show description**: Below each extra's name, render `extra.description` in small muted text (`text-xs text-muted-foreground`) when present.

**3. `src/pages/Menu.tsx`** (line 966) — Add `description` to the select query for `product_extras`. Also add `description` to the `extra_category_items` select (line 972) and map it through in the complement conversion (line 980).

**4. `src/pages/DeliveryMenu.tsx`** (line 240) — Same: add `description` to both `product_extras` and `extra_category_items` select queries, and map it in complement conversion.

**5. `src/pages/Kiosk.tsx`** (line 196) — Already uses `select("*")` so description is fetched automatically. No change needed.

### Visual result
- Selected items get a very light tint of the restaurant's primary color instead of the hard orange
- Descriptions appear as small gray text below each variation/complement name, only when present

