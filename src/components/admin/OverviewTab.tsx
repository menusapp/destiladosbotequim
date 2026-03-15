import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ShoppingBag, TrendingUp, Store, Truck } from "lucide-react";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";

interface OverviewTabProps {
  restaurantId: string;
}

type DateRange = "today" | "7days" | "30days" | "thisMonth" | "lastMonth" | "60days" | "annual";

interface OverviewData {
  totalSales: number;
  ordersCount: number;
  averageTicket: number;
  localSales: number;
  deliverySales: number;
  hourlySales: { hour: string; total: number }[];
  revenueByMethod: { method: string; total: number }[];
}

function getDateRange(range: DateRange): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  switch (range) {
    case "today":
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), end };
    case "7days":
      return { start: subDays(now, 7).toISOString(), end };
    case "30days":
      return { start: subDays(now, 30).toISOString(), end };
    case "thisMonth":
      return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm).toISOString(), end: endOfMonth(lm).toISOString() };
    }
    case "60days":
      return { start: subDays(now, 60).toISOString(), end };
    case "annual":
      return { start: startOfYear(now).toISOString(), end };
  }
}

const VALID_STATUSES = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"];

const OverviewTab = ({ restaurantId }: OverviewTabProps) => {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [data, setData] = useState<OverviewData>({
    totalSales: 0, ordersCount: 0, averageTicket: 0,
    localSales: 0, deliverySales: 0, hourlySales: [], revenueByMethod: [],
  });
  const [loading, setLoading] = useState(true);

  const calcOrderTotal = (order: any) => {
    return (order.order_items || []).reduce((sum: number, item: any) => {
      const extras = (item.order_item_extras || []).reduce((s: number, e: any) => s + (e.price_at_order || 0), 0);
      return sum + (item.price_at_order + extras) * item.quantity;
    }, 0);
  };

  const fetchData = async () => {
    try {
      const { start, end } = getDateRange(dateRange);

      const [ordersRes, counterOrdersRes, billsRes] = await Promise.all([
        supabase.from("orders")
          .select("id, created_at, order_type, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", start).lte("created_at", end)
          .in("status", VALID_STATUSES),
        supabase.from("counter_orders")
          .select("id, total_amount, finalized_at")
          .eq("restaurant_id", restaurantId).eq("status", "paid")
          .gte("finalized_at", start).lte("finalized_at", end),
        supabase.from("bills")
          .select("id, total_amount, payment_method, paid_at")
          .eq("status", "paid")
          .gte("paid_at", start).lte("paid_at", end),
      ]);

      const orders = ordersRes.data || [];
      const counterOrders = counterOrdersRes.data || [];

      // Total sales from orders
      let deliverySales = 0;
      let localOrderSales = 0;
      orders.forEach(o => {
        const t = calcOrderTotal(o);
        if (o.order_type === "delivery") deliverySales += t;
        else localOrderSales += t;
      });

      // Counter orders are always local/PDV
      const counterTotal = counterOrders.reduce((s, co) => s + (co.total_amount || 0), 0);
      const localSales = localOrderSales + counterTotal;
      const totalSales = localSales + deliverySales;
      const totalCount = orders.length + counterOrders.length;
      const averageTicket = totalCount > 0 ? totalSales / totalCount : 0;

      // Hourly sales (only for "today")
      let hourlySales: { hour: string; total: number }[] = [];
      if (dateRange === "today") {
        const hourlyMap = new Map<string, number>();
        for (let h = 8; h <= 23; h++) hourlyMap.set(h.toString().padStart(2, "0") + ":00", 0);
        orders.forEach(o => {
          const h = new Date(o.created_at).getHours().toString().padStart(2, "0") + ":00";
          hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcOrderTotal(o));
        });
        counterOrders.forEach(co => {
          if (co.finalized_at) {
            const h = new Date(co.finalized_at).getHours().toString().padStart(2, "0") + ":00";
            hourlyMap.set(h, (hourlyMap.get(h) || 0) + (co.total_amount || 0));
          }
        });
        hourlySales = Array.from(hourlyMap.entries()).map(([hour, total]) => ({ hour, total })).sort((a, b) => a.hour.localeCompare(b.hour));
      }

      // Revenue by payment method
      const methodMap = new Map<string, number>();
      (billsRes.data || []).forEach((bill: any) => {
        const method = bill.payment_method || "Outros";
        methodMap.set(method, (methodMap.get(method) || 0) + (bill.total_amount || 0));
      });
      const revenueByMethod = Array.from(methodMap.entries()).map(([method, total]) => ({ method, total }));

      setData({ totalSales, ordersCount: totalCount, averageTicket, localSales, deliverySales, hourlySales, revenueByMethod });
    } catch (err) {
      console.error("Error fetching overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [restaurantId, dateRange]);

  useEffect(() => {
    const ch = supabase.channel(`overview-rt-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, dateRange]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Carregando...</div>;
  }

  const dateRangeLabels: Record<DateRange, string> = {
    today: "Hoje", "7days": "Ultimos 7 dias", "30days": "Ultimos 30 dias",
    thisMonth: "Este mes", lastMonth: "Mes passado", "60days": "Ultimos 60 dias", annual: "Anual",
  };

  const methodLabels: Record<string, string> = { pix: "Pix", credit: "Credito", debit: "Debito", cash: "Dinheiro", Outros: "Outros" };
  const methodColors: Record<string, string> = { pix: "bg-emerald-500", credit: "bg-blue-500", debit: "bg-amber-500", cash: "bg-green-600", Outros: "bg-muted-foreground" };
  const totalMethodRevenue = data.revenueByMethod.reduce((s, r) => s + r.total, 0);

  // SVG Chart
  const maxHourlySale = Math.max(...data.hourlySales.map(h => h.total), 1);
  const chartPadding = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartW = 600, chartH = 200;
  const innerW = chartW - chartPadding.left - chartPadding.right;
  const innerH = chartH - chartPadding.top - chartPadding.bottom;
  const points = data.hourlySales.map((h, i) => ({
    x: chartPadding.left + (i / Math.max(data.hourlySales.length - 1, 1)) * innerW,
    y: chartPadding.top + innerH - (h.total / maxHourlySale) * innerH,
    label: h.hour, value: h.total,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1]?.x ?? 0} ${chartPadding.top + innerH} L ${points[0]?.x ?? 0} ${chartPadding.top + innerH} Z`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.025em]">Visao Geral</h2>
          <p className="text-sm text-muted-foreground font-light">Resumo e metricas do restaurante</p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(dateRangeLabels) as DateRange[]).map(k => (
              <SelectItem key={k} value={k}>{dateRangeLabels[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* TOP CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard title="Vendas Totais" value={`R$ ${data.totalSales.toFixed(2)}`} sub={`${data.ordersCount} pedidos`} badge={dateRangeLabels[dateRange]} badgeColor="bg-emerald-500" icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Pedidos" value={data.ordersCount.toString()} sub={dateRangeLabels[dateRange]} badge="Total" badgeColor="bg-blue-500" icon={<ShoppingBag className="h-4 w-4" />} />
        <MetricCard title="Ticket Medio" value={`R$ ${data.averageTicket.toFixed(2)}`} sub="Por pedido" badge="Media" badgeColor="bg-blue-500" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Vendas Caixa (PDV)" value={`R$ ${data.localSales.toFixed(2)}`} sub="Local + Balcao" badge="Local" badgeColor="bg-orange-500" icon={<Store className="h-4 w-4" />} />
        <MetricCard title="Vendas Delivery" value={`R$ ${data.deliverySales.toFixed(2)}`} sub="Entregas" badge="Delivery" badgeColor="bg-violet-500" icon={<Truck className="h-4 w-4" />} />
      </div>

      {/* CHART + REVENUE BY METHOD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Chart (only today) */}
        {dateRange === "today" && (
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm">Vendas por Hora</h3>
                  <p className="text-xs text-muted-foreground">Hoje</p>
                </div>
                <span className="text-lg font-bold">R$ {data.totalSales.toFixed(2)}</span>
              </div>
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" style={{ minHeight: 180 }}>
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
                  {points.length > 1 && (
                    <>
                      <path d={areaPath} fill="hsl(var(--primary) / 0.15)" />
                      <path d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}
                  {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={1.5} />
                  ))}
                  {points.filter((_, i) => i % 2 === 0).map((p, i) => (
                    <text key={i} x={p.x} y={chartH - 5} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                      {p.label.slice(0, 2)}h
                    </text>
                  ))}
                </svg>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue by Payment Method */}
        <Card className={dateRange !== "today" ? "lg:col-span-3" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Receita por Metodo</h3>
              <span className="text-lg font-bold">R$ {totalMethodRevenue.toFixed(2)}</span>
            </div>
            {data.revenueByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem vendas finalizadas no periodo</p>
            ) : (
              <div className="space-y-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-muted/40">
                  {data.revenueByMethod.map((r, i) => (
                    <div key={i} className={`${methodColors[r.method] || "bg-muted-foreground"} transition-all`} style={{ width: `${(r.total / totalMethodRevenue) * 100}%` }} />
                  ))}
                </div>
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
