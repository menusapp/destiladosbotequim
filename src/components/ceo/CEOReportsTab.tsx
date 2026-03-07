import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, TrendingUp, Store, ShoppingBag, Package, Users, ArrowUpRight, ArrowDownRight, CalendarIcon } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RestaurantStats {
  restaurant_id: string;
  restaurant_name: string;
  total_revenue: number;
  total_orders: number;
  total_products: number;
  total_customers: number;
  avg_ticket: number;
  last_order_date: string | null;
  delivery_revenue: number;
  local_revenue: number;
  counter_revenue: number;
}

interface PaymentSummary {
  restaurant_id: string;
  restaurant_name: string;
  total_paid: number;
  last_payment: string | null;
}

interface TopProduct {
  product_name: string;
  restaurant_name: string;
  quantity_sold: number;
  revenue: number;
}

export function CEOReportsTab() {
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [summaries, setSummaries] = useState<PaymentSummary[]>([]);
  const [restaurantStats, setRestaurantStats] = useState<RestaurantStats[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("all");
  const [totalPlatformOrders, setTotalPlatformOrders] = useState(0);
  const [totalPlatformRevenue, setTotalPlatformRevenue] = useState(0);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    fetchReports();
  }, [startDate, endDate]);

  const fetchReports = async () => {
    try {
      const startISO = startDate.toISOString();
      const endISO = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59).toISOString();

      // Fetch all payments in date range
      const { data: payments } = await supabase
        .from("subscription_payments" as any)
        .select("*")
        .eq("status", "paid")
        .gte("payment_date", startISO)
        .lte("payment_date", endISO) as any;

      // Fetch active subscriptions with plan prices
      const { data: subs } = await supabase
        .from("restaurant_subscriptions" as any)
        .select("*, subscription_plans(price)")
        .eq("status", "active") as any;

      // Fetch restaurants
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name");

      const restMap = new Map((restaurants || []).map(r => [r.id, r.name]));

      // MRR
      const activeMRR = ((subs as any[]) || []).reduce((sum: number, s: any) => {
        const plan = s.subscription_plans as any;
        return sum + (plan?.price || 0);
      }, 0);
      setMrr(activeMRR);

      // Total revenue from payments
      const total = ((payments as any[]) || []).reduce((sum: number, p: any) => sum + p.amount, 0);
      setTotalRevenue(total);

      // Group payments by restaurant
      const byRestaurant = new Map<string, { total: number; last: string | null }>();
      ((payments as any[]) || []).forEach((p: any) => {
        const curr = byRestaurant.get(p.restaurant_id) || { total: 0, last: null };
        curr.total += p.amount;
        if (!curr.last || p.payment_date > curr.last) curr.last = p.payment_date;
        byRestaurant.set(p.restaurant_id, curr);
      });

      const summaryList: PaymentSummary[] = Array.from(byRestaurant.entries()).map(([rid, data]) => ({
        restaurant_id: rid,
        restaurant_name: restMap.get(rid) || "—",
        total_paid: data.total,
        last_payment: data.last,
      })).sort((a, b) => b.total_paid - a.total_paid);
      setSummaries(summaryList);

      // === RESTAURANT SALES STATS ===
      const startISO2 = startISO;
      const endISO2 = endISO;

      // Delivery orders
      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select("id, restaurant_id, created_at, order_items(quantity, price_at_order)")
        .eq("order_type", "delivery")
        .in("status", ["delivered", "picked_up"])
        .gte("created_at", startISO2)
        .lte("created_at", endISO2);

      // Local orders (bills paid)
      const { data: bills } = await supabase
        .from("bills")
        .select("id, table_id, total_amount, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", startISO2)
        .lte("paid_at", endISO2);

      // Counter orders
      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select("id, restaurant_id, total_amount, finalized_at, status")
        .eq("status", "paid")
        .gte("finalized_at", startISO2)
        .lte("finalized_at", endISO2);

      // Products count per restaurant
      const { data: products } = await supabase
        .from("products")
        .select("id, category_id, categories(restaurant_id)");

      // Customers per restaurant
      const { data: customers } = await supabase
        .from("customers")
        .select("id, restaurant_id");

      // Top selling products
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity, price_at_order, products(name, category_id, categories(restaurant_id))");

      // Build stats per restaurant
      const statsMap = new Map<string, RestaurantStats>();

      (restaurants || []).forEach(r => {
        statsMap.set(r.id, {
          restaurant_id: r.id,
          restaurant_name: r.name,
          total_revenue: 0,
          total_orders: 0,
          total_products: 0,
          total_customers: 0,
          avg_ticket: 0,
          last_order_date: null,
          delivery_revenue: 0,
          local_revenue: 0,
          counter_revenue: 0,
        });
      });

      // Delivery revenue
      (deliveryOrders || []).forEach(o => {
        const stat = statsMap.get(o.restaurant_id);
        if (stat) {
          const orderTotal = (o.order_items || []).reduce((s: number, i: any) => s + (i.quantity * i.price_at_order), 0);
          stat.delivery_revenue += orderTotal;
          stat.total_revenue += orderTotal;
          stat.total_orders++;
          if (!stat.last_order_date || o.created_at > stat.last_order_date) stat.last_order_date = o.created_at;
        }
      });

      // Counter revenue
      (counterOrders || []).forEach(o => {
        const stat = statsMap.get(o.restaurant_id);
        if (stat) {
          stat.counter_revenue += o.total_amount;
          stat.total_revenue += o.total_amount;
          stat.total_orders++;
          if (o.finalized_at && (!stat.last_order_date || o.finalized_at > stat.last_order_date)) stat.last_order_date = o.finalized_at;
        }
      });

      // Products per restaurant
      (products || []).forEach((p: any) => {
        const rid = p.categories?.restaurant_id;
        if (rid) {
          const stat = statsMap.get(rid);
          if (stat) stat.total_products++;
        }
      });

      // Customers per restaurant
      (customers || []).forEach(c => {
        const stat = statsMap.get(c.restaurant_id);
        if (stat) stat.total_customers++;
      });

      // Avg ticket
      statsMap.forEach(stat => {
        stat.avg_ticket = stat.total_orders > 0 ? stat.total_revenue / stat.total_orders : 0;
      });

      const statsList = Array.from(statsMap.values()).sort((a, b) => b.total_revenue - a.total_revenue);
      setRestaurantStats(statsList);

      // Platform totals
      setTotalPlatformOrders(statsList.reduce((s, r) => s + r.total_orders, 0));
      setTotalPlatformRevenue(statsList.reduce((s, r) => s + r.total_revenue, 0));

      // Top products
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

      const topProds: TopProduct[] = Array.from(productSales.values())
        .map(p => ({ product_name: p.name, restaurant_name: p.restaurant, quantity_sold: p.qty, revenue: p.revenue }))
        .sort((a, b) => b.quantity_sold - a.quantity_sold)
        .slice(0, 10);
      setTopProducts(topProds);

    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = selectedRestaurant === "all"
    ? restaurantStats
    : restaurantStats.filter(s => s.restaurant_id === selectedRestaurant);

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Relatórios & Analytics</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-sm">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar restaurante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os restaurantes</SelectItem>
              {restaurantStats.map(s => (
                <SelectItem key={s.restaurant_id} value={s.restaurant_id}>{s.restaurant_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Platform Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> MRR (Assinaturas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {mrr.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Faturamento Total (Vendas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">R$ {totalPlatformRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Total de Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{totalPlatformOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" /> Restaurantes Pagantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{summaries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Restaurant Sales Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Vendas por Restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum dado encontrado</p>
          ) : (
            <div className="space-y-3">
              {filteredStats.map(s => (
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
                      <p className="text-muted-foreground text-xs">Delivery</p>
                      <p className="font-bold">R$ {s.delivery_revenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-md p-2">
                      <p className="text-muted-foreground text-xs">Balcão</p>
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

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Top 10 Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma venda registrada ainda</p>
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

      {/* Subscription Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Pagamentos de Assinatura por Restaurante</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum pagamento registrado ainda</p>
          ) : (
            <div className="space-y-3">
              {summaries.map(s => (
                <div key={s.restaurant_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{s.restaurant_name}</p>
                    {s.last_payment && (
                      <p className="text-xs text-muted-foreground">
                        Último pagamento: {format(new Date(s.last_payment), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-primary">R$ {s.total_paid.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
