

## Plan: Make Login/Registration Popup Optional

### What Changes

Users can dismiss the login popup and browse the menu freely. Login is only required when they try to: place an order, view "Pedidos" tab, or view "Perfil" tab.

### Changes by File

**1. `src/pages/DeliveryMenu.tsx`**
- Remove auto-show of `showCustomerDialog` in `loadCustomerInfo` when no stored session exists — start with dialog closed
- When user clicks "Pedidos" or "Perfil" tab without being logged in (`!customerCPF`), show the login dialog instead of switching tab
- Wrap the tab change handler: if target is `pedidos`/`perfil` and not logged in, show dialog and store intended tab; after login, navigate to that tab
- In checkout flow, if not logged in, show dialog before proceeding
- Keep `onClose` allowing dismiss: `() => setShowCustomerDialog(false)`

**2. `src/pages/Menu.tsx` (QR Code / Mesa)**
- Similar approach: don't auto-show dialog on load
- Allow closing with X: change `onClose={() => {}}` to `onClose={() => setShowCustomerDialog(false)}`
- Block `handleProductClick` → instead of requiring login to view product details, allow viewing but block "add to cart" if not logged in (or keep current behavior of showing login when clicking a product — simpler)
- Actually, for Mesa menu there are no tabs like pedidos/perfil, but the user said "tanto delivery, tanto o cardápio local". The key restriction: can't place orders without login.

**3. `src/components/menu/CustomerInfoDialog.tsx`**
- Allow the X button to actually close: the dialog currently has `onOpenChange={() => {}}` which prevents closing. Need to pass an `onClose` that works and wire it to the X button via `onOpenChange`.

### Technical Details

- Add a `pendingTab` state in DeliveryMenu to remember which tab the user wanted after login
- In DeliveryMenu's tab change handler, intercept non-menu tabs when `!customerCPF`
- In Menu.tsx, allow product viewing freely but show login dialog when trying to add to cart
- CustomerInfoDialog: change `onOpenChange={() => {}}` to `onOpenChange={(open) => { if (!open) onClose(); }}`

