import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShoppingBag, TrendingUp, Users, Clock, Utensils, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface OverviewTabProps {
  restaurantId: string;
}

interface TableData {
  id: string;
  table_number: number;
  table_name: string | null;
  is_occupied: boolean;
}

interface DebtorData {
  tableName: string;
  totalOrders: number;
  totalItems: number;
  totalAmount: number;
}

interface OverviewData {
  todaySales: number;
  todayOrdersCount: number;
  pendingOrders: number;
  preparingOrders: number;
  monthRevenue: number;
  averageTicket: number;
  occupiedTables: number;
  totalTables: number;
  tables: TableData[];
  totalCustomersToday: number;
  hourlySales: { hour: string; total: number }[];
  debtors: DebtorData[];
  revenueByMethod: { method: string; total: number }[];
  activeTablesRevenue: number;
}

const OverviewTab = ({ restaurantId }: OverviewTabProps) => {
  const [data, setData] = useState<OverviewData>({
    todaySales: 0, todayOrdersCount: 0, pendingOrders: 0, preparingOrders: 0,
    monthRevenue: 0, averageTicket: 0, occupiedTables: 0, totalTables: 0,
    tables: [], totalCustomersToday: 0, hourlySales: [], debtors: [],
    revenueByMethod: [], activeTablesRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [ordersToday, ordersPending, ordersPreparing, ordersMonth, tables, activeBills, todayBills] = await Promise.all([
        supabase.from("orders").select("id, created_at, customer_name, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId).gte("created_at", todayStart)
          .in("status", ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"]),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId).in("status", ["accepted", "preparing"]),
        supabase.from("orders").select("id, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId).gte("created_at", monthStart)
          .in("status", ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"]),
        supabase.from("tables").select("id, table_number, table_name, is_occupied").eq("restaurant_id", restaurantId).neq("table_number", 9999).order("table_number"),
        supabase.from("bills").select("id, total_amount, status, tables(table_number, table_name)")
          .eq("status", "active"),
        supabase.from("bills").select("id, total_amount, payment_method, paid_at")
          .eq("status", "paid").gte("paid_at", todayStart),
      ]);

      const calcOrderTotal = (order: any) => {
        return (order.order_items || []).reduce((sum: number, item: any) => {
          const extras = (item.order_item_extras || []).reduce((s: number, e: any) => s + (e.price_at_order || 0), 0);
          return sum + (item.price_at_order + extras) * item.quantity;
        }, 0);
      };

      const todayOrders = ordersToday.data || [];
      const todaySales = todayOrders.reduce((sum, o) => sum + calcOrderTotal(o), 0);
      const monthOrders = ordersMonth.data || [];
      const monthRevenue = monthOrders.reduce((sum, o) => sum + calcOrderTotal(o), 0);
      const averageTicket = todayOrders.length > 0 ? todaySales / todayOrders.length : 0;

      const uniqueCustomers = new Set(todayOrders.map(o => o.customer_name)).size;

      const tablesData = (tables.data || []) as TableData[];
      const occupiedTables = tablesData.filter(t => t.is_occupied).length;

      // Hourly sales
      const hourlyMap = new Map<string, number>();
      for (let h = 8; h <= 23; h++) {
        hourlyMap.set(h.toString().padStart(2, "0") + ":00", 0);
      }
      todayOrders.forEach(o => {
        const h = new Date(o.created_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcOrderTotal(o));
      });
      const hourlySales = Array.from(hourlyMap.entries())
        .map(([hour, total]) => ({ hour, total }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      // Debtors (active bills)
      const debtors: DebtorData[] = (activeBills.data || []).map((bill: any) => ({
        tableName: bill.tables?.table_name || `Mesa ${bill.tables?.table_number}`,
        totalOrders: 1,
        totalItems: 0,
        totalAmount: bill.total_amount || 0,
      }));

      // Revenue by payment method
      const methodMap = new Map<string, number>();
      (todayBills.data || []).forEach((bill: any) => {
        const method = bill.payment_method || "Outros";
        methodMap.set(method, (methodMap.get(method) || 0) + (bill.total_amount || 0));
      });
      const revenueByMethod = Array.from(methodMap.entries()).map(([method, total]) => ({ method, total }));

      const activeTablesRevenue = debtors.reduce((s, d) => s + d.totalAmount, 0);

      setData({
        todaySales, todayOrdersCount: todayOrders.length,
        pendingOrders: ordersPending.count || 0,
        preparingOrders: ordersPreparing.count || 0,
        monthRevenue, averageTicket,
        occupiedTables, totalTables: tablesData.length,
        tables: tablesData, totalCustomersToday: uniqueCustomers,
        hourlySales, debtors, revenueByMethod, activeTablesRevenue,
      });
    } catch (err) {
      console.error("Error fetching overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const ch = supabase.channel(`overview-rt-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Carregando...</div>;
  }

  const maxHourlySale = Math.max(...data.hourlySales.map(h => h.total), 1);

  const methodLabels: Record<string, string> = {
    pix: "Pix", credit: "Credito", debit: "Debito", cash: "Dinheiro", Outros: "Outros",
  };
  const methodColors: Record<string, string> = {
    pix: "bg-emerald-500", credit: "bg-blue-500", debit: "bg-amber-500", cash: "bg-green-600", Outros: "bg-muted-foreground",
  };

  const totalMethodRevenue = data.revenueByMethod.reduce((s, r) => s + r.total, 0);

  // Build SVG line chart points
  const chartPadding = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartW = 600;
  const chartH = 200;
  const innerW = chartW - chartPadding.left - chartPadding.right;
  const innerH = chartH - chartPadding.top - chartPadding.bottom;
  const points = data.hourlySales.map((h, i) => ({
    x: chartPadding.left + (i / Math.max(data.hourlySales.length - 1, 1)) * innerW,
    y: chartPadding.top + innerH - (h.total / maxHourlySale) * innerH,
    label: h.hour,
    value: h.total,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1]?.x ?? 0} ${chartPadding.top + innerH} L ${points[0]?.x ?? 0} ${chartPadding.top + innerH} Z`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-[-0.025em]">Visao Geral</h2>
        <p className="text-sm text-muted-foreground font-light">Resumo do dia e metricas do restaurante</p>
      </div>

      {/* === TOP CARDS === */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Vendas Hoje"
          value={`R$ ${data.todaySales.toFixed(2)}`}
          sub={`Total ${data.todayOrdersCount} pedidos`}
          badge="Hoje"
          badgeColor="bg-emerald-500"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Pedidos"
          value={data.todayOrdersCount.toString()}
          sub={`${data.pendingOrders} pendentes`}
          badge={data.pendingOrders > 0 ? "Pendente" : "OK"}
          badgeColor={data.pendingOrders > 0 ? "bg-amber-500" : "bg-emerald-500"}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <MetricCard
          title="Ticket Medio"
          value={`R$ ${data.averageTicket.toFixed(2)}`}
          sub="Por pedido hoje"
          badge="Media"
          badgeColor="bg-blue-500"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          title="Clientes Hoje"
          value={data.totalCustomersToday.toString()}
          sub={`Total ${data.todayOrdersCount} pedidos`}
          badge="Ativos"
          badgeColor="bg-emerald-500"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          title="Faturamento Mensal"
          value={`R$ ${data.monthRevenue.toFixed(2)}`}
          sub="Mes atual"
          badge="Mensal"
          badgeColor="bg-orange-500"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* === CHART + TABLE STATUS === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Chart */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm">Vendas por Hora</h3>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
              <span className="text-lg font-bold">R$ {data.todaySales.toFixed(2)}</span>
            </div>
            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" style={{ minHeight: 180 }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const y = chartPadding.top + innerH - pct * innerH;
                  return (
                    <g key={pct}>
                      <line x1={chartPadding.left} y1={y} x2={chartW - chartPadding.right} y2={y} stroke="hsl(var(--border))" strokeWidth={0.5} strokeDasharray="4,4" />
                      <text x={chartPadding.left - 5} y={y + 3} textAnchor="end" className="fill-muted-foreground" fontSize={9}>
                        {(maxHourlySale * pct).toFixed(0)}
                      </text>
                    </g>
                  );
                })}
                {/* Area + Line */}
                {points.length > 1 && (
                  <>
                    <path d={areaPath} fill="hsl(var(--primary) / 0.15)" />
                    <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                {/* Dots */}
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1.5} />
                ))}
                {/* X labels */}
                {points.filter((_, i) => i % 2 === 0).map((p, i) => (
                  <text key={i} x={p.x} y={chartH - 5} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                    {p.label.slice(0, 2)}h
                  </text>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>

        {/* Table Status Grid */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm">Status das Mesas</h3>
                <p className="text-xs text-muted-foreground">{data.occupiedTables} de {data.totalTables} ocupadas</p>
              </div>
              <span className="text-lg font-bold">R$ {data.activeTablesRevenue.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {data.tables.map((table) => (
                <div
                  key={table.id}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-medium border transition-colors ${
                    table.is_occupied
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground"
                  }`}
                >
                  <Utensils className="h-3.5 w-3.5 mb-0.5" />
                  <span>{table.table_name || table.table_number}</span>
                </div>
              ))}
              {data.tables.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground text-center py-4">Nenhuma mesa cadastrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* === DEBTORS + REVENUE BY METHOD === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Debtors */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold text-sm mb-4">Contas Abertas</h3>
            {data.debtors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta aberta</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left py-2 font-medium">Mesa</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.debtors.map((d, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2.5 flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                          {d.tableName}
                        </td>
                        <td className="py-2.5 text-right font-medium">R$ {d.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Payment Method */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Receita por Metodo</h3>
              <span className="text-lg font-bold">R$ {totalMethodRevenue.toFixed(2)}</span>
            </div>
            {data.revenueByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem vendas finalizadas hoje</p>
            ) : (
              <div className="space-y-3">
                {/* Stacked bar */}
                <div className="flex h-4 rounded-full overflow-hidden bg-muted/40">
                  {data.revenueByMethod.map((r, i) => (
                    <div
                      key={i}
                      className={`${methodColors[r.method] || "bg-muted-foreground"} transition-all`}
                      style={{ width: `${(r.total / totalMethodRevenue) * 100}%` }}
                    />
                  ))}
                </div>
                {/* Legend */}
                <div className="space-y-2">
                  {data.revenueByMethod.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-sm ${methodColors[r.method] || "bg-muted-foreground"}`} />
                        <span className="text-muted-foreground">{methodLabels[r.method] || r.method}</span>
                      </div>
                      <span className="font-medium">R$ {r.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* === Metric Card Component === */
function MetricCard({ title, value, sub, badge, badgeColor, icon }: {
  title: string; value: string; sub: string; badge: string; badgeColor: string; icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">{title}</p>
          <span className={`text-[10px] text-white font-medium px-1.5 py-0.5 rounded ${badgeColor}`}>{badge}</span>
        </div>
        <p className="text-xl font-bold tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

export default OverviewTab;
