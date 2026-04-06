

# Plan: Remove Dark Mode + Reorganize Order Detail Modal

## Correction 1 — Remove Dark Mode

**Files to modify:**

1. **`src/components/ThemeProvider.tsx`** — Force `forcedTheme="light"` and `enableSystem={false}` so the theme is always light regardless of OS preference.

2. **`src/components/admin/AdminHeader.tsx`** — Remove the theme toggle button (Moon/Sun icon, lines ~155-167). Remove `useTheme` import and `theme`/`setTheme` usage.

3. **`src/index.css`** — Keep the `.dark` block as-is (it won't be applied since theme is forced to light, and `chart.tsx` references it). No CSS changes needed.

No other files use `setTheme` or `useTheme`.

## Correction 2 — Reorganize Order Detail Modal with Collapsible Sections

**File:** `src/components/admin/OrderDetailModal.tsx`

The current modal is a `Dialog` (`max-w-4xl`). The user refers to it as a "drawer do PDV" but it's actually a centered Dialog. The plan reorganizes it with collapsible sections.

**Changes:**

1. **Add imports:** `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`, `Separator` from `@/components/ui/separator`, `ChevronDown` icon.

2. **Replace the Card-based layout** (lines ~406-607) with collapsible sections:

   - **Resumo do Pedido** (always visible, not collapsible): Order number, origin, status badge, elapsed time, date, total, payment method. Compact summary at the top.

   - **Ações do Pedido** (always visible): Keep all action buttons as-is.

   - **Itens Pedidos** (collapsible, open by default): The items table with extras, subtotals, delivery fee, discounts, grand total.

   - **Cliente** (collapsible, closed by default): Name, phone, address, CPF.

   - **Detalhes** (collapsible, closed by default): Origin, date, table, scheduled time, cancellation reason.

   - **Pagamento** (collapsible, closed by default): Payment confirmation button when payment is pending.

3. **Add `Separator`** between each section.

4. **Increase padding** from default to `p-6` on the dialog content.

5. **Each collapsible section** uses a clickable header with `ChevronDown` that rotates when open, consistent UX pattern.

## What does NOT change
- Order status flow, iFood/DD sync, WhatsApp, printing, stock restoration
- Cancel dialog, payment modals, add items drawer
- Any business logic

