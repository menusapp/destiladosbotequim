

## Root Cause Found

The issue is **NOT about touch events or vaul drag interception**. The button IS being clicked, but `handleContinue()` silently returns early due to a validation failure.

### The Problem

In `PaymentStep.tsx`, when `requireCustomerInfo` is `true` (which happens only for **Retirada**, line 587 of CheckoutDrawer), `handleContinue` validates:

```tsx
if (requireCustomerInfo) {
  if (!customerName || !customerCPF || !customerPhone) {
    toast.error("Preencha todos os dados");
    return;  // ← Button "doesn't work"
  }
}
```

The customer data is empty because of **mismatched sessionStorage keys**:

- **DeliveryMenu.tsx** stores data with keys: `delivery-customer-${slug}`, `delivery-cpf-${slug}`, `delivery-phone-${slug}`
- **PaymentStep.tsx** reads from keys: `customer_name`, `customer_cpf`, `customer_phone`

These keys never match, so for Retirada the data is empty.

For **Entrega**, it works because the AddressStep collects data and passes it via `customerData` prop — sessionStorage is never consulted.

For **Retirada**, the flow skips AddressStep, `customerData` is null, so the props fallback to sessionStorage which has the wrong keys → empty → validation fails → toast fires (probably unnoticed on mobile) → button appears to "not work".

### Why it broke after the frictionless changes

Before the frictionless changes, PaymentStep had visible input fields for name/CPF/phone that the user could fill manually. After removing those fields, the component relies entirely on auto-fill which fails due to the key mismatch.

### The Fix

Two changes needed:

**1. CheckoutDrawer.tsx (lines 586-616)** — When rendering PaymentStep for pickup, pass the customer data from the correct sessionStorage keys (the ones DeliveryMenu actually writes to):

Replace the PaymentStep render block to properly resolve customer data before passing props. Use the slug-based keys as fallback.

**2. PaymentStep.tsx (lines 233-241)** — Make phone optional in validation since `login_require_phone` defaults to `false`. Phone is not always collected during login, so requiring it blocks checkout:

```tsx
// Before:
if (!customerName || !customerCPF || !customerPhone) {

// After: 
if (!customerName || !customerCPF) {
```

### Detailed Edits

**File: `src/components/menu/CheckoutDrawer.tsx`**

In the PaymentStep render section (~line 584-616), resolve customer name/CPF/phone from the correct sessionStorage keys. Add a helper that checks both key formats:

```tsx
// Before passing props, resolve from slug-based keys too
const resolvedName = customerData?.name 
  || sessionStorage.getItem("customer_name") 
  || sessionStorage.getItem(`delivery-customer-${restaurantSlug}`) 
  || "";
const resolvedCPF = customerData?.cpf 
  || getCustomerCPF() 
  || sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`) 
  || "";
const resolvedPhone = customerData?.phone 
  || sessionStorage.getItem("customer_phone") 
  || sessionStorage.getItem(`delivery-phone-${restaurantSlug}`) 
  || "";
```

And use these resolved values in the PaymentStep props AND in the `onContinue` callback for pickup.

**File: `src/components/menu/checkout/PaymentStep.tsx`**

1. Line 91-92: Also initialize state from the slug-based keys as fallback
2. Lines 233-237: Remove `!customerPhone` from the validation — phone is not always required
3. Lines 193-194: Same for the online payment validation

### Files Changed
- `src/components/menu/CheckoutDrawer.tsx` — Fix sessionStorage key resolution for pickup flow
- `src/components/menu/checkout/PaymentStep.tsx` — Remove phone from required validation, fix data initialization

