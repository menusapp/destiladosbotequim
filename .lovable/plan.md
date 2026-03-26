

## Plan: Two Parts

### Part 1: Replace SVG Chart with Recharts BarChart in OverviewTab

**Current**: OverviewTab uses a hand-coded SVG line/area chart with no hover tooltips.
**Target**: Replace with Recharts `BarChart` (same style as CEO RestaurantDashboardTab) with interactive tooltip on hover showing date/hour + value.

**File: `src/components/admin/OverviewTab.tsx`**

Changes:
- Add imports: `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer` from `recharts`
- Remove all SVG chart calculation code (lines 49-62: `maxChartValue`, `chartPadding`, `chartW`, `chartH`, `innerW`, `innerH`, `points`, `linePath`, `areaPath`)
- Replace the `<svg>` block (lines 104-135) with a `ResponsiveContainer` + `BarChart` using the existing `chartData` array
- Tooltip shows `R$ {value}` on hover with date/hour label
- Keep the same card layout, header, and total display
- No new data fetching — reuse existing `data.hourlySales` and `data.dailySales` from `useOrderMetrics`

Lightweight: Recharts is already bundled (used in CEO dashboard + chart.tsx). No new dependencies.

---

### Part 2: Dead Code Cleanup & Optimization

**Dead files to delete:**
1. `src/lib/localDB.ts` — ~500 lines of Electron SQLite adapter. Only imported by PrintersSettings (one `isElectronApp` call that always returns false in cloud)
2. `src/vite-env.d.ts` — ~290 lines of Electron type declarations. Replace with minimal Vite env types only
3. `src/components/admin/DevelopmentPlaceholder.tsx` — imported in RestaurantAdmin but never used in render

**Dead code in existing files:**
4. `src/pages/RestaurantAdmin.tsx` — remove unused `DevelopmentPlaceholder` import, remove unused `Card/CardContent/CardHeader/CardTitle` imports (not used in render)
5. `src/components/admin/settings/PrintersSettings.tsx` — remove `isElectronApp` import and all Electron-related branches/variables (lines referencing `getElectronPrinter`, `getElectronDB`, `isElectronApp`). Since cloud-only, simplify to always show cloud printer UI

**Optimization approach:**
- Focus only on removing dead imports and dead files
- No logic or functionality changes
- No query changes (queries are already optimized with Promise.all)

**Latency report**: Will provide a before/after summary of:
- Files removed and lines saved
- Dead imports removed per file
- No query count changes (queries are already minimal)

