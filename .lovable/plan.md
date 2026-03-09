

## Plan: Reservation System Adjustments

### Changes

#### 1. Time slot filtering: 1 hour buffer (ReservationsView.tsx + Reservations.tsx)
In `generateTimeSlots`, change the today filter from "current time" to "current time + 60 minutes":
```
const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 60;
slots = slots.filter(slot => h * 60 + m > bufferMinutes);
```
Apply to both `ReservationsView.tsx` (line ~235) and `Reservations.tsx` (line ~285, which currently has no today filter — add it there too).

#### 2. Show "table already reserved" message in table selection (ReservationsView.tsx)
When a customer selects a date and a table already has a confirmed reservation for that date, show a visual indicator on the table card (e.g., a red badge "Reservada para esta data") and block selection. Currently `reservedTableIds` is fetched but only checked at submit time — surface this in the table list UI.

#### 3. Remove public reservation link from admin (TablesTab.tsx)
Remove the card at lines ~1198-1215 that shows the public link and "Copiar Link" button. Also update the description text at line ~1170 from "pelo link público" to "pelo cardápio digital".

#### 4. Change default status filter in History tab (TablesTab.tsx)
Change `useState("pending")` at line 126 to `useState("all")` so the history tab shows all reservations by default.

#### 5. Set default reservations sub-tab to "today" (TablesTab.tsx)
Change `<Tabs defaultValue="pending"` at line 1217 to `defaultValue="today"` so the admin sees today's reservations first.

### Files to edit
- `src/components/menu/ReservationsView.tsx` — 1-hour buffer on time slots, reserved table indicator
- `src/pages/Reservations.tsx` — 1-hour buffer on time slots
- `src/components/admin/TablesTab.tsx` — Remove public link card, change default filter to "all", default sub-tab to "today"

### No changes to
- Backend, database, APIs, WhatsApp automations, business logic

