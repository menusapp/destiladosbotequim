import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShoppingBag, TrendingUp, Users, Clock, Utensils } from "lucide-react";

interface OverviewTabProps {
  restaurantId: string;
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
  hourlySales: { hour: string; total: number }[];
}

const OverviewTab = ({ restaurantId }: OverviewTabProps) => {
  const [data, setData] = useState<OverviewData>({
    todaySales: 0, todayOrdersCount: 0, pendingOrders: 0, preparingOrders: 0,
    monthRevenue: 0, averageTicket: 0, occupiedTables: 0, totalTables: 0, hourlySales: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Parallel queries
      const [ordersToday, ordersPending, ordersPreparing, ordersMonth, tables] = await Promise.all([
        supabase.from("orders").select("id, created_at, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId).gte("created_at", todayStart)
          .in("status", ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"]),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId).in("status", ["accepted", "preparing"]),
        supabase.from("orders").select("id, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId).gte("created_at", monthStart)
          .in("status", ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"]),
        supabase.from("tables").select("id, is_occupied").eq("restaurant_id", restaurantId).neq("table_number", 9999),
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

      const tablesData = tables.data || [];
      const occupiedTables = tablesData.filter(t => t.is_occupied).length;

      // Hourly sales
      const hourlyMap = new Map<string, number>();
      todayOrders.forEach(o => {
        const h = new Date(o.created_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcOrderTotal(o));
      });
      const hourlySales = Array.from(hourlyMap.entries())
        .map(([hour, total]) => ({ hour, total }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      setData({
        todaySales, todayOrdersCount: todayOrders.length,
        pendingOrders: ordersPending.count || 0,
        preparingOrders: ordersPreparing.count || 0,
        monthRevenue, averageTicket,
        occupiedTables, totalTables: tablesData.length,
        hourlySales,
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Carregando...</div>;
  }

  const cards = [
    { title: "Vendas Hoje", value: `R$ ${data.todaySales.toFixed(2)}`, sub: `${data.todayOrdersCount} pedidos`, icon: DollarSign, color: "text-green-600 bg-green-50 dark:bg-green-950/30" },
    { title: "Pedidos Pendentes", value: data.pendingOrders.toString(), sub: `${data.preparingOrders} em preparo`, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
    { title: "Faturamento Mensal", value: `R$ ${data.monthRevenue.toFixed(2)}`, sub: "Mês atual", icon: TrendingUp, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
    { title: "Ticket Medio", value: `R$ ${data.averageTicket.toFixed(2)}`, sub: "Hoje", icon: ShoppingBag, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
    { title: "Mesas Ocupadas", value: `${data.occupiedTables} / ${data.totalTables}`, sub: data.totalTables > 0 ? `${Math.round((data.occupiedTables / data.totalTables) * 100)}% ocupacao` : "Nenhuma mesa", icon: Utensils, color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" },
  ];

  const maxHourlySale = Math.max(...data.hourlySales.map(h => h.total), 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Visao Geral</h2>
        <p className="text-sm text-muted-foreground">Resumo do dia e metricas do restaurante</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                  <p className="text-lg font-bold">{card.value}</p>
                  <p className="text-[11px] text-muted-foreground">{card.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Hourly Sales Chart */}
      {data.hourlySales.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-4">Vendas por hora (hoje)</h3>
            <div className="flex items-end gap-1 h-32">
              {data.hourlySales.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/80 rounded-t min-h-[4px]"
                    style={{ height: `${(h.total / maxHourlySale) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{h.hour.slice(0, 2)}h</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OverviewTab;
