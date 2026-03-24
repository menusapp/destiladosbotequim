

## Bug Fix: PDV Comanda Not Filtering by Customer

### Problem
In `PDVTab.tsx` lines 397-399, when a table is already occupied and a new order is created for a different customer, the code queries for any active comanda on that table without filtering by customer name/cpf. This causes all orders to fall into the first customer's comanda.

### Root Cause
```typescript
// Current broken query (line 397-399):
const { data: existingComanda } = await supabase.from("comandas")
  .select("*").eq("table_id", tableId).eq("status", "active")
  .order("created_at", { ascending: false }).limit(1).maybeSingle();
```
Missing `.eq("customer_name", ...)` filter — returns first active comanda regardless of customer.

### Fix
**File: `src/components/admin/PDVTab.tsx`** (lines 395-409)

Replace the comanda lookup in the `table.is_occupied` branch to match by customer name (and cpf when available), mirroring the pattern already used in `CreateOrderDrawer.tsx`:

```typescript
let comandaId: string | null = null;
const currentCustomerName = customerName || "Cliente PDV";
const currentCustomerCpf = customerCpf || "000.000.000-00";

if (table.is_occupied) {
  let query = supabase.from("comandas")
    .select("*").eq("table_id", tableId).eq("status", "active")
    .eq("customer_name", currentCustomerName);
  if (currentCustomerCpf !== "000.000.000-00") {
    query = query.eq("customer_cpf", currentCustomerCpf);
  }
  const { data: existingComanda } = await query
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existingComanda) {
    comandaId = existingComanda.id;
  } else {
    const { data: nc } = await supabase.from("comandas").insert({
      restaurant_id: restaurantId, table_id: tableId,
      customer_name: currentCustomerName,
      customer_cpf: currentCustomerCpf, status: "active",
    }).select().single();
    comandaId = nc?.id || null;
  }
} else {
  // ... keep existing "not occupied" branch unchanged
}
```

Also update the `else` branch and the order insert to use `currentCustomerName` and `currentCustomerCpf` for consistency.

### Scope
- **Only file changed**: `src/components/admin/PDVTab.tsx`
- **Only branch affected**: Mesa order creation in PDV
- **No changes** to delivery, retirada, or any other flow
- **No migration needed** — the `comandas` table already has `customer_name` and `customer_cpf` columns

### Expected Result
Mesa 1 with Gustavo and Artur will have two separate comandas, each with their own orders — matching the behavior already implemented in `CreateOrderDrawer.tsx`.

