

## Analysis Confirmed

The edge function logs show the exact error: `Invalid transaction_amount` from Mercado Pago API. This happens because:

1. **Floating point precision**: `calculateRewardDiscount` can produce values like `subtotal * 0.15 = 8.849999999999998`, making the final `onlineTotal` have excessive decimal places. MP requires exactly 2 decimal places.

2. **Zero/negative total**: When a 100% discount reward is applied, `onlineTotal` becomes 0 or negative. MP rejects `transaction_amount <= 0`.

3. The frontend already checks `amount < 1` inside `OnlinePaymentStep`, but by that point the edge function call has already been triggered for PIX (line 77: `createPixCharge()` runs on mount).

## Plan

### Edit 1 — `src/components/menu/CheckoutDrawer.tsx` (~line 645-652)

Round `onlineTotal` to 2 decimal places and ensure it's not negative:

```tsx
const onlineTotal = (() => {
  const cd = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
  const ld = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
  const rd = calculateRewardDiscount(subtotal);
  const df = getDeliveryFee();
  const sf = restaurant.service_fee_enabled ? (subtotal * restaurant.service_fee_percentage / 100) : 0;
  const raw = subtotal + sf + df - cd - ld - rd;
  return Math.max(0, Math.round(raw * 100) / 100);
})();
```

### Edit 2 — `src/components/menu/CheckoutDrawer.tsx` (~line 608)

Same rounding fix for `orderTotal` in the payment step:

```tsx
const orderTotal = Math.max(0, Math.round((subtotal + serviceFee + deliveryFee - couponDiscount - loyaltyDiscount - rewardDiscount) * 100) / 100);
```

### Edit 3 — `src/components/menu/CheckoutDrawer.tsx` (~line 636)

When `onlineTotal` is 0 (100% discount), skip online payment and go directly to summary, marking order as "paid":

```tsx
if (data.isOnlinePayment) {
  // Recalculate total to check if payment is needed
  const cd2 = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
  const ld2 = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
  const rd2 = calculateRewardDiscount(subtotal);
  const df2 = getDeliveryFee();
  const sf2 = restaurant.service_fee_enabled ? (subtotal * restaurant.service_fee_percentage / 100) : 0;
  const finalTotal = Math.max(0, Math.round((subtotal + sf2 + df2 - cd2 - ld2 - rd2) * 100) / 100);
  
  if (finalTotal < 1) {
    // Total is zero/minimal after discounts — skip payment gateway
    toast.success("Desconto aplicado! Pedido sem custo adicional.");
    setStep("summary");
  } else {
    setStep("online-payment");
  }
} else {
  setStep("summary");
}
```

### Edit 4 — `supabase/functions/mercadopago-charge/index.ts` (~line 38-49)

Add server-side validation — round `amount` to 2 decimal places and reject if <= 0:

```typescript
// After extracting amount from req.json()
const roundedAmount = Math.round(Number(amount) * 100) / 100;

if (!restaurant_id || !roundedAmount || roundedAmount <= 0 || !billing_type) {
  return new Response(
    JSON.stringify({ error: "Valor inválido ou dados obrigatórios ausentes" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Then use `roundedAmount` instead of `amount` in all places within the function (transaction_amount, mpItems fallback, DB insert).

### Edit 5 — `supabase/functions/mercadopago-charge/index.ts` (mpItems construction)

Filter out items with `unit_price <= 0` to prevent MP rejection:

```typescript
const mpItems = Array.isArray(items) && items.length > 0
  ? items
      .filter((item: any) => Number(item.unit_price) > 0)
      .map((item: any) => ({
        id: item.id || "unknown",
        title: item.name || "Produto",
        description: item.name || "Produto",
        quantity: item.quantity || 1,
        unit_price: Math.round(Number(item.unit_price) * 100) / 100,
        category_id: "food",
      }))
  : [];

// Fallback if all items were filtered
if (mpItems.length === 0) {
  mpItems.push({ id: "order", title: `Pedido ${order_id || "delivery"}`, description: "Pedido delivery", quantity: 1, unit_price: roundedAmount, category_id: "food" });
}
```

### Files changed
- `src/components/menu/CheckoutDrawer.tsx` — Round totals, skip gateway when total is 0
- `supabase/functions/mercadopago-charge/index.ts` — Round amount, filter zero-price items

