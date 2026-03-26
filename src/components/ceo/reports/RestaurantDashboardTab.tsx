import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, startOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, DollarSign, ShoppingBag, Users, BarChart3, Package, Truck, Store as StoreIcon, Coffee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface RestaurantStats {
  restaurant_id: string;
  restaurant_name: string;
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  avg_ticket: number;
  last_order_date: string | null;
  delivery_revenue: number;
  local_revenue: number;
  counter_revenue: number;
}

interface DailySale {
  date: string;
  total: number;
}

interface TopProduct {
  product_name: string;
  restaurant_name: string;
  quantity_sold: number;
  revenue: number;
}

const CHANNEL_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 150 60% 45%))",
];

export function RestaurantDashboardTab() {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string }[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [stats, setStats] = useState<RestaurantStats[]>([]);
  const [dailySales, setDailySales] = useState<DailySale[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  // Aggregated KPIs
  const filtered = selectedRestaurant === "all" ? stats : stats.filter(s => s.restaurant_id === selectedRestaurant);
  const totalRevenue = filtered.reduce((s, r) => s + r.total_revenue, 0);
  const totalOrders = filtered.reduce((s, r) => s + r.total_orders, 0);
  const totalCustomers = filtered.reduce((s, r) => s + r.total_customers, 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const deliveryTotal = filtered.reduce((s, r) => s + r.delivery_revenue, 0);
  const counterTotal = filtered.reduce((s, r) => s + r.counter_revenue, 0);
  const localTotal = filtered.reduce((s, r) => s + r.local_revenue, 0);

  const channelData = [
    { name: "Delivery", value: deliveryTotal },
    { name: "Balcão", value: counterTotal },
    { name: "Local", value: localTotal },
  ].filter(c => c.value > 0);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startISO = startDate.toISOString();
      const endISO = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString();

      const { data: rests } = await supabase.from("restaurants").select("id, name");
      setRestaurants(rests || []);
      const restMap = new Map((rests || []).map(r => [r.id, r.name]));

      // Delivery orders
      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select("id, restaurant_id, created_at, order_items(quantity, price_at_order)")
        .eq("order_type", "delivery")
        .in("status", ["delivered", "picked_up"])
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      // Bills (local)
      const { data: bills } = await supabase
        .from("bills")
        .select("id, table_id, total_amount, paid_at")
        .eq("status", "paid")
        .gte("paid_at", startISO)
        .lte("paid_at", endISO);

      // We need table -> restaurant mapping for bills
      const { data: tables } = await supabase.from("tables").select("id, restaurant_id");
      const tableRestMap = new Map((tables || []).map(t => [t.id, t.restaurant_id]));

      // Counter orders
      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select("id, restaurant_id, total_amount, finalized_at")
        .eq("status", "paid")
        .gte("finalized_at", startISO)
        .lte("finalized_at", endISO);

      // Customers
      const { data: customers } = await supabase.from("customers").select("id, restaurant_id");

      // Build stats
      const statsMap = new Map<string, RestaurantStats>();
      (rests || []).forEach(r => {
        statsMap.set(r.id, {
          restaurant_id: r.id,
          restaurant_name: r.name,
          total_revenue: 0, total_orders: 0, total_customers: 0,
          avg_ticket: 0, last_order_date: null,
          delivery_revenue: 0, local_revenue: 0, counter_revenue: 0,
        });
      });

      // Daily sales aggregation
      const dailyMap = new Map<string, number>();
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      allDays.forEach(d => dailyMap.set(format(d, "yyyy-MM-dd"), 0));

      // Delivery
      (deliveryOrders || []).forEach(o => {
        const stat = statsMap.get(o.restaurant_id);
        if (stat) {
          const orderTotal = (o.order_items || []).reduce((s: number, i: any) => s + (i.quantity * i.price_at_order), 0);
          stat.delivery_revenue += orderTotal;
          stat.total_revenue += orderTotal;
          stat.total_orders++;
          if (!stat.last_order_date || o.created_at > stat.last_order_date) stat.last_order_date = o.created_at;
          const day = format(new Date(o.created_at), "yyyy-MM-dd");
          dailyMap.set(day, (dailyMap.get(day) || 0) + orderTotal);
        }
      });

      // Local (bills)
      (bills || []).forEach(b => {
        const rid = tableRestMap.get(b.table_id);
        if (rid) {
          const stat = statsMap.get(rid);
          if (stat) {
            stat.local_revenue += b.total_amount;
            stat.total_revenue += b.total_amount;
            stat.total_orders++;
            if (b.paid_at && (!stat.last_order_date || b.paid_at > stat.last_order_date)) stat.last_order_date = b.paid_at;
            const day = format(new Date(b.paid_at!), "yyyy-MM-dd");
            dailyMap.set(day, (dailyMap.get(day) || 0) + b.total_amount);
          }
        }
      });

      // Counter
      (counterOrders || []).forEach(o => {
        const stat = statsMap.get(o.restaurant_id);
        if (stat) {
          stat.counter_revenue += o.total_amount;
          stat.total_revenue += o.total_amount;
          stat.total_orders++;
          if (o.finalized_at && (!stat.last_order_date || o.finalized_at > stat.last_order_date)) stat.last_order_date = o.finalized_at;
          const day = format(new Date(o.finalized_at!), "yyyy-MM-dd");
          dailyMap.set(day, (dailyMap.get(day) || 0) + o.total_amount);
        }
      });

      // Customers
      (customers || []).forEach(c => {
        const stat = statsMap.get(c.restaurant_id);
        if (stat) stat.total_customers++;
      });

      // Avg ticket
      statsMap.forEach(stat => {
        stat.avg_ticket = stat.total_orders > 0 ? stat.total_revenue / stat.total_orders : 0;
      });

      const statsList = Array.from(statsMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
      setStats(statsList);

      setDailySales(
        Array.from(dailyMap.entries())
          .map(([date, total]) => ({ date: format(new Date(date), "dd/MM"), total }))
      );

      // Top products
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, price_at_order, products(name, category_id, categories(restaurant_id))");

      const productSales = new Map<string, { name: string; restaurant: string; qty: number; revenue: number }>();
      (orderItems || []).forEach((item: any) => {
        const prod = item.products;
        if (prod) {
          const rid = prod.categories?.restaurant_id;
          const key = item.product_id;
          const curr = productSales.get(key) || { name: prod.name, restaurant: restMap.get(rid) || "—", qty: 0, revenue: 0 };
          curr.qty += item.quantity;
          curr.revenue += item.quantity * item.price_at_order;
          productSales.set(key, curr);
        }
      });

      setTopProducts(
        Array.from(productSales.values())
          .map(p => ({ product_name: p.name, restaurant_name: p.restaurant, quantity_sold: p.qty, revenue: p.revenue }))
          .sort((a, b) => b.quantity_sold - a.quantity_sold)
          .slice(0, 10)
      );

    } catch (err) {
      console.error("Error fetching restaurant dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(startDate, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">até</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(endDate, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar restaurante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os restaurantes</SelectItem>
            {restaurants.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground p-4">Carregando...</p>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Faturamento Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">R$ {totalRevenue.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Total de Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">R$ {avgTicket.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Total Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{totalCustomers}</p>
              </CardContent>
            </Card>
          </div>

          {/* Daily Sales Chart + Channel Pie */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" /> Vendas por Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dailySales.every(d => d.total === 0) ? (
                  <p className="text-muted-foreground text-center py-8">Sem vendas no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailySales}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                      <Tooltip
                        formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Vendas"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Receita por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                {channelData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {channelData.map((_, i) => (
                          <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`R$ ${value.toFixed(2)}`]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-restaurant breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><StoreIcon className="h-5 w-5" /> Detalhamento por Restaurante</CardTitle>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map(s => (
                    <div key={s.restaurant_id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-lg">{s.restaurant_name}</p>
                          {s.last_order_date && (
                            <p className="text-xs text-muted-foreground">
                              Último pedido: {format(new Date(s.last_order_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <span className="text-xl font-bold text-primary">R$ {s.total_revenue.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div className="bg-secondary/50 rounded-md p-2">
                          <p className="text-muted-foreground text-xs">Pedidos</p>
                          <p className="font-bold">{s.total_orders}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-2">
                          <p className="text-muted-foreground text-xs">Ticket Médio</p>
                          <p className="font-bold">R$ {s.avg_ticket.toFixed(2)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-2">
                          <p className="text-muted-foreground text-xs flex items-center gap-1"><Truck className="h-3 w-3" /> Delivery</p>
                          <p className="font-bold">R$ {s.delivery_revenue.toFixed(2)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-2">
                          <p className="text-muted-foreground text-xs flex items-center gap-1"><Coffee className="h-3 w-3" /> Balcão</p>
                          <p className="font-bold">R$ {s.counter_revenue.toFixed(2)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-2">
                          <p className="text-muted-foreground text-xs">Clientes</p>
                          <p className="font-bold">{s.total_customers}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 10 Products */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Top 10 Produtos Mais Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma venda registrada</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-8">#{i + 1}</span>
                        <div>
                          <p className="font-medium">{p.product_name}</p>
                          <p className="text-xs text-muted-foreground">{p.restaurant_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{p.quantity_sold} un.</p>
                        <p className="text-xs text-muted-foreground">R$ {p.revenue.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
