import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { startOfDay, endOfDay } from "date-fns";

interface DashboardTabProps {
  restaurantId: string;
}

interface DashboardStats {
  salesToday: number;
  ordersCount: number;
  averageTicket: number;
  occupiedTables: number;
  inPreparation: number;
}

interface RecentOrder {
  id: string;
  customer_name: string;
  created_at: string;
  status: string;
  table_number: number;
}

interface OpenBill {
  id: string;
  table_number: number;
  total_amount: number;
  created_at: string;
}

export default function DashboardTab({ restaurantId }: DashboardTabProps) {
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    ordersCount: 0,
    averageTicket: 0,
    occupiedTables: 0,
    inPreparation: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [restaurantId]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startDate = startOfDay(today);
      const endDate = endOfDay(today);

      const { data: paidBills } = await supabase
        .from("bills")
        .select(`id, total_amount, tables!inner(restaurant_id)`)
        .eq("tables.restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString());

      let billsTotal = 0;
      let billsCount = 0;
      if (paidBills && paidBills.length > 0) {
        billsTotal = paidBills.reduce((sum, bill) => sum + Number(bill.total_amount), 0);
        billsCount = paidBills.length;
      }

      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select(`id, delivery_fee, coupon_discount, loyalty_points_used, order_items (quantity, price_at_order, order_item_extras (price_at_order))`)
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "delivery")
        .in("status", ["delivered", "picked_up"])
        .gte("updated_at", startDate.toISOString())
        .lte("updated_at", endDate.toISOString());

      let deliveryTotal = 0;
      deliveryOrders?.forEach((order: any) => {
        let orderSubtotal = 0;
        order.order_items?.forEach((item: any) => {
          const itemTotal = item.price_at_order * item.quantity;
          const extrasTotal = (item.order_item_extras || []).reduce(
            (sum: number, extra: any) => sum + Number(extra.price_at_order || 0), 0
          );
          orderSubtotal += itemTotal + extrasTotal;
        });
        const deliveryFee = Number(order.delivery_fee || 0);
        const couponDiscount = Number(order.coupon_discount || 0);
        const loyaltyDiscount = Number(order.loyalty_points_used || 0) * 0.01;
        deliveryTotal += orderSubtotal + deliveryFee - couponDiscount - loyaltyDiscount;
      });

      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select("total_amount")
        .eq("restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("finalized_at", startDate.toISOString())
        .lte("finalized_at", endDate.toISOString());

      const counterTotal = (counterOrders || []).reduce((sum, order) => sum + Number(order.total_amount), 0);
      
      const salesTotal = billsTotal + deliveryTotal + counterTotal;
      const ordersCount = billsCount + (deliveryOrders?.length || 0) + (counterOrders?.length || 0);
      const avgTicket = ordersCount > 0 ? salesTotal / ordersCount : 0;

      const { data: occupiedTablesData } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_occupied", true);

      const { data: inPrepData } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "accepted", "preparing"]);

      const { data: ordersData } = await supabase
        .from("orders")
        .select(`id, customer_name, created_at, status, order_type, tables (table_number)`)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(10);

      const recentOrdersFormatted = (ordersData || []).map((order: any) => ({
        id: order.id,
        customer_name: order.customer_name,
        created_at: order.created_at,
        status: order.status,
        table_number: order.order_type === "delivery" ? "Delivery" : order.tables?.table_number || 0,
      }));

      const { data: billsData } = await supabase
        .from("bills")
        .select(`id, total_amount, created_at, tables!inner(table_number, restaurant_id)`)
        .eq("tables.restaurant_id", restaurantId)
        .in("status", ["pending", "on_the_way"]);

      const openBillsFormatted = (billsData || []).map((bill: any) => ({
        id: bill.id,
        table_number: bill.tables?.table_number || 0,
        total_amount: Number(bill.total_amount),
        created_at: bill.created_at,
      }));

      setStats({ salesToday: salesTotal, ordersCount, averageTicket: avgTicket, occupiedTables: occupiedTablesData?.length || 0, inPreparation: inPrepData?.length || 0 });
      setRecentOrders(recentOrdersFormatted);
      setOpenBills(openBillsFormatted);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground text-sm">Carregando...</div>;
  }

  const metricCards = [
    { label: "Vendas Hoje", value: `R$ ${stats.salesToday.toFixed(2).replace(".", ",")}`, sub: `${stats.ordersCount} pedidos`, icon: DollarSign },
    { label: "Ticket Médio", value: `R$ ${stats.averageTicket.toFixed(2).replace(".", ",")}`, sub: "Por pedido pago", icon: TrendingUp },
    { label: "Mesas Ocupadas", value: String(stats.occupiedTables), sub: "ativas agora", icon: Users },
    { label: "Em Preparo", value: String(stats.inPreparation), sub: "pedidos", icon: Clock },
  ];

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return "Pendente";
      case "accepted": return "Aceito";
      case "preparing": return "Preparando";
      case "delivered": return "Entregue";
      default: return s;
    }
  };

  const statusClass = (s: string) => {
    switch (s) {
      case "pending": return "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "accepted": return "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "preparing": return "bg-primary/10 text-primary";
      default: return "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-page-title text-foreground">Dashboard</h1>
        <p className="text-label text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-label text-muted-foreground">{m.label}</p>
                <p className="text-xl font-semibold text-foreground mt-1">{m.value}</p>
                <p className="text-small text-muted-foreground mt-0.5">{m.sub}</p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <m.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Orders & Open Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h2 className="text-section-title text-foreground mb-3">Pedidos Recentes</h2>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-label">Nenhum pedido hoje</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin">
              {recentOrders.slice(0, 8).map((order) => (
                <div key={order.id} className="flex items-center justify-between py-2 px-2.5 rounded-button hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-small text-muted-foreground">
                      Mesa {order.table_number} · {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusClass(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-section-title text-foreground mb-3">Contas Abertas</h2>
          {openBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-label">Nenhuma conta aberta</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin">
              {openBills.slice(0, 8).map((bill) => (
                <div key={bill.id} className="flex items-center justify-between py-2 px-2.5 rounded-button hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mesa {bill.table_number}</p>
                    <p className="text-small text-muted-foreground">
                      {new Date(bill.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary">
                    R$ {bill.total_amount.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
