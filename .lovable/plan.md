

## Root Cause Analysis

The issue is **NOT a CSS z-index problem**. It's vaul (the Drawer library) intercepting touch events.

Here's what happens:

1. **Vaul's drag handler**: When you touch anywhere inside the Drawer content, vaul captures the pointer event to detect drag-to-close gestures. It checks `shouldDrag()` (line 979-982 of vaul source) which walks up the DOM tree looking for scrollable containers or elements with `data-vaul-no-drag`.

2. **Why only "Retirada"**: When "Entrega" is selected, the flow goes through AddressStep first, which has many form fields and a scrollable container. By the time PaymentStep renders, the drawer content is tall enough that vaul detects a scrollable child and allows normal touch behavior. When "Retirada" is selected, PaymentStep renders directly with minimal content — the buttons sit in a zone where vaul's `shouldDrag()` returns `true`, so the touch is consumed as a drag gesture instead of passed through as a click.

3. **Why z-50 didn't fix it**: `z-index` and `pointer-events` are CSS properties. Vaul's issue is at the JavaScript event handler level — it intercepts `onPointerDown` before the CSS layer can matter.

**Proof**: Vaul explicitly supports `data-vaul-no-drag` attribute (line 981 of vaul source): elements (or children of elements) with this attribute are excluded from drag detection.

## Plan

### Edit 1 — `src/components/menu/checkout/PaymentStep.tsx` (line ~437)

Add `data-vaul-no-drag` to the button container so vaul ignores touch events on the buttons:

```tsx
<div className="flex gap-3 relative z-50 pointer-events-auto pb-safe" data-vaul-no-drag>
```

### Edit 2 — `src/components/menu/checkout/DeliveryTypeStep.tsx` (line ~128)

Same fix for the DeliveryTypeStep buttons:

```tsx
<div className="flex gap-2 pt-4 relative z-50 pointer-events-auto pb-safe" data-vaul-no-drag>
```

### Edit 3 — `src/components/menu/CheckoutDrawer.tsx` (line 714)

Add `data-vaul-no-drag` to the content wrapper so vaul doesn't intercept any touches inside the step content. This prevents the drag-to-close gesture from eating button clicks across ALL steps:

```tsx
<div className="overflow-y-auto flex-1" data-vaul-no-drag>
```

### Why this works

Vaul's `shouldDrag()` function checks: `element.hasAttribute('data-vaul-no-drag') || element.closest('[data-vaul-no-drag]')`. If either is true, it returns `false` and vaul does NOT capture the pointer event — allowing the button's `onClick` to fire normally. The drawer can still be closed via the ✕ button or overlay click.

### Files changed
- `src/components/menu/checkout/PaymentStep.tsx` (1 attribute)
- `src/components/menu/checkout/DeliveryTypeStep.tsx` (1 attribute)
- `src/components/menu/CheckoutDrawer.tsx` (1 attribute)

