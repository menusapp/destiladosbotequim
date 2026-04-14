

## Plan: Fix 3 UI Issues

### Issue 1: "Recolher" text overlapping notifications in admin panel
The "Recolher" button sits inside the expanded notification list but uses `self-end mb-1` which can overlap notification cards. Fix: add proper positioning with `sticky top-0 z-10 bg-background` so it stays above the scrollable list and doesn't overlap.

**File:** `src/pages/RestaurantAdmin.tsx`
- Both "Recolher" buttons (order notifications ~line 964-968, bill notifications ~line 1054-1058): wrap in a sticky header or add background and padding so the text doesn't overlap the cards below.

### Issue 2: Complement field in address form — label and placeholder
Currently the label says "Complemento" and placeholder says "Opcional". Change to:
- Label: `Complemento (opcional)`
- Placeholder: `Ex: Casa, Apartamento, Bloco B`

**Files:**
- `src/components/menu/checkout/AddressStep.tsx` (~line 584, 591)
- `src/components/kiosk/KioskDeliveryAddress.tsx` (~line 168-169) — same fix

### Issue 3: Notifications should start collapsed (cascaded), not expanded
Currently `cascadeExpanded` and `billCascadeExpanded` default to `false` (line 80, 88), which means they already start collapsed. However, the issue is that when new notifications arrive they may be auto-expanding. I'll verify the state isn't being set to `true` anywhere on arrival and ensure notifications always arrive in collapsed/cascaded mode.

**File:** `src/pages/RestaurantAdmin.tsx`
- Confirm initial state is `false` (already is)
- Check if any notification arrival logic sets expanded to `true` and remove it if so

