import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ShoppingBag, TrendingUp, Store, Truck } from "lucide-react";
import { useState } from "react";
import { useOrderMetrics, type DateRange } from "@/hooks/useOrderMetrics";
import { formatPaymentMethod } from "@/lib/utils";

interface OverviewTabProps {
  restaurantId: string;
}

const dateRangeLabels: Record<DateRange, string> = {
  today: "Hoje", yesterday: "Ontem", "7days": "Últimos 7 dias", "30days": "Últimos 30 dias",
  thisMonth: "Este mês", lastMonth: "Mês passado", "60days": "Últimos 60 dias", annual: "Anual",
};

const methodColors: Record<string, string> = {
  pix: "bg-emerald-500", credit: "bg-blue-500", debit: "bg-amber-500",
  cash: "bg-green-600", meal_voucher: "bg-purple-500", ifood_online: "bg-red-500", Outros: "bg-muted-foreground",
};

const OverviewTab = ({ restaurantId }: OverviewTabProps) => {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const { metrics: data, loading, refetch } = useOrderMetrics(restaurantId, dateRange);

  // Realtime refresh
  useEffect(() => {
    const ch = supabase.channel(`overview-rt-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, refetch]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Carregando...</div>;
  }

  const totalMethodRevenue = data.revenueByMethod.reduce((s, r) => s + r.total, 0);

  // Determine if single-day or multi-day
  const isSingleDay = dateRange === "today" || dateRange === "yesterday";
  const chartData = isSingleDay ? data.hourlySales : data.dailySales;
  const chartLabel = isSingleDay ? "Vendas por Hora" : "Vendas por Dia";
  const chartSubLabel = isSingleDay ? dateRangeLabels[dateRange] : dateRangeLabels[dateRange];

  // SVG Chart
  const maxChartValue = Math.max(...chartData.map(h => 'total' in h ? h.total : 0), 1);
  const chartPadding = { top: 10, right: 10, bottom: 25, left: 50 };
  const chartW = 600, chartH = 200;
  const innerW = chartW - chartPadding.left - chartPadding.right;
  const innerH = chartH - chartPadding.top - chartPadding.bottom;
  const points = chartData.map((h, i) => ({
    x: chartPadding.left + (i / Math.max(chartData.length - 1, 1)) * innerW,
    y: chartPadding.top + innerH - ((h as any).total / maxChartValue) * innerH,
    label: isSingleDay ? (h as any).hour : (h as any).day,
    value: (h as any).total,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1]?.x ?? 0} ${chartPadding.top + innerH} L ${points[0]?.x ?? 0} ${chartPadding.top + innerH} Z`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-[-0.025em]">Visão Geral</h2>
          <p className="text-sm text-muted-foreground font-light">Resumo e métricas do restaurante</p>
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
        <MetricCard title="Ticket Médio" value={`R$ ${data.averageTicket.toFixed(2)}`} sub="Por pedido" badge="Média" badgeColor="bg-blue-500" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Vendas Caixa (PDV)" value={`R$ ${data.localSales.toFixed(2)}`} sub="Local + Balcão" badge="Local" badgeColor="bg-orange-500" icon={<Store className="h-4 w-4" />} />
        <MetricCard title="Vendas Delivery" value={`R$ ${data.deliverySales.toFixed(2)}`} sub="Entregas" badge="Delivery" badgeColor="bg-violet-500" icon={<Truck className="h-4 w-4" />} />
      </div>

      {/* CHART + REVENUE BY METHOD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {chartData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm">{chartLabel}</h3>
                  <p className="text-xs text-muted-foreground">{chartSubLabel}</p>
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
                          {(maxChartValue * pct).toFixed(0)}
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
                  {points.filter((_, i) => {
                    // Show fewer labels for large datasets
                    const step = Math.max(1, Math.floor(points.length / 15));
                    return i % step === 0;
                  }).map((p, i) => (
                    <text key={i} x={p.x} y={chartH - 5} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
                      {isSingleDay ? p.label.slice(0, 2) + "h" : p.label.slice(5)}
                    </text>
                  ))}
                </svg>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={chartData.length === 0 ? "lg:col-span-3" : ""}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Receita por Método</h3>
              <span className="text-lg font-bold">R$ {totalMethodRevenue.toFixed(2)}</span>
            </div>
            {data.revenueByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem vendas finalizadas no período</p>
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
                        <span className="text-muted-foreground">{formatPaymentMethod(r.method)}</span>
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
