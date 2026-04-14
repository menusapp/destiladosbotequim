

## Plan: Separate Restaurant Credentials from Staff Account

### Problem
Currently, when registering a restaurant, the `register-restaurant` edge function creates both `restaurant_credentials` (for restaurant login) AND a `restaurant_staff` admin account with the **same** username and password. This means the same credentials are used for both logins, which is incorrect.

### Solution

**1. Remove staff account creation from `register-restaurant` edge function**
- Delete the step 3 block (lines ~149-163) that creates the `restaurant_staff` record
- The registration form credentials will only be saved to `restaurant_credentials` (restaurant login)

**2. Update registration form label**
- In `RestaurantRegistration.tsx`, change the section title from "Dados de Acesso ao Painel" to "Credenciais do Restaurante" and add a helper text explaining these are for the restaurant login only

**3. Fix post-registration redirect**
- In `RestaurantRegistration.tsx`, after successful registration, store `restaurant_id`, `restaurant_name`, and `restaurant_slug` in localStorage, then redirect to `/login/staff` instead of directly to `/slug/admin`
- Remove the premature `staff_role: "admin"` localStorage set (line 118) since no staff account exists yet

**4. First-time staff setup already works**
- The `StaffLogin.tsx` page already has the first-time setup flow: it calls `admin_check_has_staff` RPC and shows the "Criar Conta de Proprietário" form when no staff exists
- No changes needed here — it will naturally trigger after registration since no staff was created

### Files Changed
- `supabase/functions/register-restaurant/index.ts` — Remove staff creation block
- `src/pages/RestaurantRegistration.tsx` — Update labels, fix redirect logic

