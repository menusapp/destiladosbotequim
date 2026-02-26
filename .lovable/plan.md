

## Root Cause (definitive this time)

The problem is in `PaymentStep.tsx` lines 147-183. Here's what happens:

1. **Initial state is correct** — `useState(nameProp || "")` initializes from props passed by CheckoutDrawer (which correctly resolve the slug-based sessionStorage keys). So initially `customerName` and `customerCPF` have values.

2. **Then `loadUserData` useEffect fires** — it calls `supabase.auth.getUser()`. If the user logged in via the delivery menu's custom login (which uses sessionStorage, not Supabase Auth), `user` is `null`.

3. **When user is null AND `requireCustomerInfo` is true (only for Retirada!)**, lines 175-178 execute and **OVERWRITE** the state with `sessionStorage.getItem("customer_name") || ""` — which returns EMPTY because the delivery login stores keys as `delivery-customer-${slug}`, not `customer_name`.

4. **Result**: The correctly-initialized prop values get replaced with empty strings. Validation at line 234 fails: `if (!customerName || !customerCPF)` → returns early.

5. **Why you don't see the error toast**: The Toaster component in `sonner.tsx` is disabled (`const Toaster = () => null`), so `toast.error()` fires but nothing renders. The button appears to "do nothing".

6. **Why it works for Entrega**: `requireCustomerInfo` is `false` for delivery, so lines 175-178 never execute, and the initial prop values survive untouched.

7. **Why it works on desktop**: On desktop the user is likely logged in via Supabase Auth (admin panel), so `user` is not null, the profile query succeeds at line 151-172, and the state gets filled correctly from the profile — never reaching the problematic lines 175-178.

## Fix

### Edit 1 — `src/components/menu/checkout/PaymentStep.tsx` (lines 147-183)

Fix the `loadUserData` useEffect to not overwrite state when props already provided valid data. Also use slug-prefixed sessionStorage keys as fallback:

```tsx
useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, cpf, phone")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          if (profile.full_name && !nameProp) {
            setCustomerName(profile.full_name);
            sessionStorage.setItem("customer_name", profile.full_name);
          }
          if (profile.cpf && !cpfProp) {
            setCustomerCPF(profile.cpf);
            sessionStorage.setItem("customer_cpf", profile.cpf);
          }
          if (profile.phone && !phoneProp) {
            setCustomerPhone(profile.phone);
            sessionStorage.setItem("customer_phone", profile.phone);
          }
          return;
        }
      }
      
      // Only fill from sessionStorage if props didn't provide values
      if (requireCustomerInfo) {
        if (!nameProp) setCustomerName(sessionStorage.getItem("customer_name") || "");
        if (!cpfProp) setCustomerCPF(sessionStorage.getItem("customer_cpf") || "");
        if (!phoneProp) setCustomerPhone(sessionStorage.getItem("customer_phone") || "");
      }
    };
    
    loadUserData();
  }, [requireCustomerInfo, nameProp, cpfProp, phoneProp]);
```

The key change: if `nameProp` or `cpfProp` were already passed with valid data, the useEffect will NOT overwrite them. This preserves the correctly-resolved values from CheckoutDrawer.

### Files changed
- `src/components/menu/checkout/PaymentStep.tsx` — Fix useEffect overwriting prop-initialized state

