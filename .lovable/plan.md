

## Plan: Split CEO Reports into Two Sub-Tabs

### Overview
Refactor `CEOReportsTab` into two sub-tabs using inner `Tabs`:
1. **Plataforma Menu's** — Platform-level metrics (MRR, subscription revenue, subscriptions sold, partner restaurants, platform avg ticket, charts)
2. **Dashboard Restaurantes** — Per-restaurant sales dashboard with date + restaurant filters, showing faturamento total, pedidos, ticket medio, charts

### Changes

**File: `src/components/ceo/CEOReportsTab.tsx`** — Full rewrite

Split the existing single view into two sub-tabs:

**Sub-tab 1: "Plataforma Menu's"**
- KPI cards: MRR, Faturamento Total (subscription payments), Assinaturas Vendidas (count of payments), Restaurantes Parceiros, Ticket Médio (avg subscription price)
- Bar chart: MRR evolution by month (using Recharts BarChart from existing chart infrastructure)
- Table: Subscription payments per restaurant (existing `summaries` section)

**Sub-tab 2: "Dashboard Restaurantes"**
- Filters bar: Date range pickers (start/end) + Restaurant select (all or specific) — reuse existing filter logic
- KPI cards: Faturamento Total, Total de Pedidos, Ticket Médio, Total Clientes
- Bar chart: Daily sales aggregation using Recharts (BarChart with daily totals)
- Revenue breakdown by channel (Delivery / Balcão / Local) as horizontal bar or pie chart
- Per-restaurant breakdown cards (existing `filteredStats` section)
- Top 10 Products table (existing)

**Technical details:**
- Use `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from existing UI components for inner tabs
- Use `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` from recharts (already in project via chart.tsx)
- Split data fetching: platform metrics fetch on mount, restaurant metrics fetch when date/restaurant filter changes
- Add daily sales aggregation logic (group delivery orders, bills, counter orders by date) for the restaurant dashboard chart
- Add subscription count metric (count of paid subscription_payments in range)

