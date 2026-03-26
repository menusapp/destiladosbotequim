

## Remove Success Toasts — Keep Only Errors/Warnings

### Problem
Success toasts (green confirmations like "Produto salvo!", "Bem-vindo!") fire on nearly every action, cluttering the screen. The user wants to keep only error, warning, and validation toasts.

### Approach

**Strategy**: Instead of editing 65+ files individually, create a wrapper around sonner's `toast` that silences `.success()` calls, then bulk-update imports.

### Steps

**Step 1 — Create toast wrapper in `src/components/ui/sonner.tsx`**
Re-export a modified `toast` object where `toast.success` is a no-op (does nothing). All other methods (`.error()`, `.info()`, `.warning()`, bare `toast()`) remain functional.

**Step 2 — Update all 65+ files importing from `"sonner"`**
Change `import { toast } from "sonner"` to `import { toast } from "@/components/ui/sonner"` across all files. This is a mechanical find-replace — no logic changes.

Files include: RestaurantAdmin, PDVTab, ProductsGrid, ClientesTab, ContasTab, CategoriesTab, StockTab, UnifiedOrdersTab, TablesTab, OverviewTab, MargensTab, FidelityTab, LoyaltyManagement, CouponsTab, MarketingTab, CampaignsList, ScheduledMessages, all settings files, menu components, CEODashboard tabs, DevDashboard tabs, etc.

**Step 3 — Clean up `useToast` success toasts**
For files using the `useToast` hook (AdminPanel, WhatsAppSettings, DestaquesTab, StockCategoriesTab): remove toast calls that show success messages (no `variant: "destructive"`). Keep all error/destructive toasts intact.

**Step 4 — Review `toast.info()` calls**
Keep `toast.info()` calls that are genuinely useful (e.g. "Sessão expirada", "Novo pedido do iFood", "Produto duplicado — altere e salve"). These are informational, not success confirmations.

### What stays
- All `toast.error()` calls
- All `toast({ variant: "destructive" })` calls  
- All validation messages ("digite valor válido", "falta pagamento")
- `toast.info()` for genuinely useful notifications
- Realtime notifications (new orders, new bills)

### What gets removed
- All `toast.success()` calls (~65 files, ~90 occurrences)
- `useToast` success confirmations without `variant: "destructive"` (~10 occurrences)

### Risk
Zero functionality impact — only visual notifications are removed. All underlying operations (save, delete, update) continue working exactly the same.

