

## Plan: Show menu when closed + allow only scheduled orders

### What changes

**Current behavior**: When restaurant is closed (`is_open = false`), Menu.tsx and DeliveryMenu.tsx show a full-screen "Estamos Fechados" blocking page. No menu is visible.

**New behavior**: Show the full menu normally. Add a banner at the top saying the restaurant is closed. Block immediate orders but allow scheduled orders (using `dd_scheduled_for`).

### Changes

**1. Remove the closed-screen early return in `Menu.tsx` and `DeliveryMenu.tsx`**
- Delete the `if (!restaurant.is_open) return <RestaurantClosedScreen />` blocks
- Instead, pass `isOpen` state down to components that need it

**2. Add a "Restaurant Closed" banner**
- In both `Menu.tsx` and `DeliveryMenu.tsx`, when `!restaurant.is_open`, render a dismissible banner at the top of the menu (below header) with a Clock icon and text like "Restaurante fechado no momento. Você pode agendar seu pedido para quando estivermos abertos."
- Use a soft yellow/amber background for visibility without being intrusive

**3. Add scheduling UI to `CheckoutDrawer.tsx` (SummaryStep)**
- When `!restaurant.is_open`:
  - Replace the "Finalizar Pedido" button behavior: require scheduling
  - Add a date/time picker (date input + time input) for the customer to choose when they want the order
  - Validate that the selected time is in the future
  - Store the chosen datetime in `dd_scheduled_for` on the order insert (in `handleFinishOrder`)
- When restaurant IS open:
  - Optionally show a toggle "Agendar para outro horário?" that reveals the same date/time picker (nice-to-have, can keep current flow unchanged)

**4. Update `handleFinishOrder` in `CheckoutDrawer.tsx`**
- Accept `scheduledFor?: string` parameter
- When `scheduledFor` is provided, add `dd_scheduled_for: scheduledFor` to `orderData`
- Set status to `"pending"` as normal (kitchen handles it when the time comes)

**5. Update `SummaryStep.tsx`**
- Add props: `isRestaurantOpen: boolean`, `scheduledFor: string | null`, `onScheduledForChange: (date: string | null) => void`
- When `!isRestaurantOpen`: show mandatory scheduling section with date + time inputs
- When `isRestaurantOpen`: optionally show a "Agendar pedido?" toggle
- Disable "Finalizar Pedido" if restaurant is closed and no schedule is selected

**6. Comanda flow (`Menu.tsx` local/table mode)**
- When restaurant is closed and mode is `"local"` (table ordering via QR): also show the banner but still allow adding items to cart
- On the ComandaBottomBar or cart submission, apply the same scheduling requirement

### Files modified
- `src/pages/Menu.tsx` — remove closed screen, add banner, pass `isOpen` to checkout
- `src/pages/DeliveryMenu.tsx` — same
- `src/components/menu/CheckoutDrawer.tsx` — add scheduling state, pass to SummaryStep, include in order insert
- `src/components/menu/checkout/SummaryStep.tsx` — add scheduling UI (date+time picker)
- `src/components/menu/RestaurantClosedScreen.tsx` — no longer used as blocking screen (can keep file for reference or remove)

### No database changes needed
The `dd_scheduled_for` column already exists on the `orders` table.

