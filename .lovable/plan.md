

## Plan: Integrate Reservations into Delivery Menu

### Overview
Add a "Reservas" tab to the delivery menu bottom navigation (conditionally shown when restaurant has `reservations_enabled`), with reservation history for the logged-in customer, a "New Reservation" flow, past-time slot filtering, and proper status display when reservation is accepted.

### Changes

#### 1. Create `ReservationsView` component
**New file: `src/components/menu/ReservationsView.tsx`**

A mobile-friendly component that combines:
- **Reservation history list** at the top — fetches reservations from `reservations` table filtered by `customer_cpf` + `restaurant_id`, showing status badges:
  - `pending` → "Aguardando Confirmação" (yellow)
  - `confirmed` → "Reserva Confirmada" (green)  
  - `cancelled` → "Cancelada" (red)
- **"Fazer Nova Reserva" button** at the top that opens the reservation flow
- **New reservation flow** (reuses logic from `Reservations.tsx`):
  - Step 1: Select table (grid of available tables)
  - Step 2: Form (date, time, party size, notes)
  - Step 3: Success confirmation
- **Time slot filtering**: In `generateTimeSlots`, if the selected date is **today**, filter out all slots where the time is <= current time (e.g., if it's 12:15, hide 08:00–12:00)
- **Realtime subscription** on `reservations` table for the customer's CPF to update status live (so when restaurant confirms, badge updates instantly)
- WhatsApp integration on submit (same as current `Reservations.tsx`)

#### 2. Update `DeliveryBottomNav`
**Edit: `src/components/menu/DeliveryBottomNav.tsx`**

- Change type from `"menu" | "pedidos" | "perfil"` to `"menu" | "pedidos" | "reservas" | "perfil"`
- Conditionally include the "Reservas" tab (with `CalendarCheck` icon) — controlled by a new `showReservations` prop
- Update grid from `grid-cols-3` to `grid-cols-3` or `grid-cols-4` based on whether reservations is shown

#### 3. Update `DeliveryMenu` page
**Edit: `src/pages/DeliveryMenu.tsx`**

- Add `activeTab` type to include `"reservas"`
- Fetch `reservations_enabled` from restaurant data (already fetched via `select("*")`)
- Render `ReservationsView` when `activeTab === "reservas"`, passing `customerCPF`, `restaurant`, `primaryColor`, and `businessHours`
- Pass `showReservations={restaurant.reservations_enabled}` to `DeliveryBottomNav`

#### 4. Time slot past-time filtering (inside ReservationsView)
In the `generateTimeSlots` function:
```
const now = new Date();
const isToday = date same day as now;
if (isToday) {
  filter slots where hour:minute <= now hour:minute
}
```

#### 5. Status mapping
- `pending` → "Aguardando Confirmação" (amber badge)
- `confirmed` → "Mesa Reservada ✅" (green badge)
- `cancelled` → "Cancelada" (red badge)

### What stays unchanged
- All backend logic, database schema, RLS policies
- WhatsApp automation for reservations (reused as-is)
- The standalone `/reservas/:restaurantSlug` route continues to work
- Admin reservation management unchanged

