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

      // Buscar bills PAGAS do dia (pedidos locais)
      const { data: paidBills } = await supabase
        .from("bills")
        .select(`
          id,
          total_amount,
          tables!inner(restaurant_id)
        `)
        .eq("tables.restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString());

      // Calcular total das bills pagas
      let billsTotal = 0;
      let billsCount = 0;
      if (paidBills && paidBills.length > 0) {
        billsTotal = paidBills.reduce((sum, bill) => sum + Number(bill.total_amount), 0);
        billsCount = paidBills.length;
      }

    // Buscar pedidos DELIVERY finalizados do dia (delivered ou picked_up)
    const { data: deliveryOrders } = await supabase
      .from("orders")
      .select(`
        id,
        delivery_fee,
        coupon_discount,
        loyalty_points_used,
        order_items (
          quantity,
          price_at_order,
          order_item_extras (price_at_order)
        )
      `)
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "delivery")
      .in("status", ["delivered", "picked_up"])
      .gte("updated_at", startDate.toISOString())
      .lte("updated_at", endDate.toISOString());

      // Calcular total dos pedidos delivery incluindo taxas
      let deliveryTotal = 0;
      deliveryOrders?.forEach((order: any) => {
        let orderSubtotal = 0;
        order.order_items?.forEach((item: any) => {
          const itemTotal = item.price_at_order * item.quantity;
          const extrasTotal = (item.order_item_extras || []).reduce(
            (sum: number, extra: any) => sum + Number(extra.price_at_order || 0),
            0
          );
          orderSubtotal += itemTotal + extrasTotal;
        });
        // Adicionar taxa de entrega e descontar cupom/fidelidade
        const deliveryFee = Number(order.delivery_fee || 0);
        const couponDiscount = Number(order.coupon_discount || 0);
        const loyaltyDiscount = Number(order.loyalty_points_used || 0) * 0.01;
        deliveryTotal += orderSubtotal + deliveryFee - couponDiscount - loyaltyDiscount;
      });

      // Não aplicar taxa de serviço novamente, já está incluída no checkout

      // Buscar pedidos de balcão finalizados do dia
      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select("total_amount")
        .eq("restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("finalized_at", startDate.toISOString())
        .lte("finalized_at", endDate.toISOString());

      const counterTotal = (counterOrders || []).reduce((sum, order) => sum + Number(order.total_amount), 0);
      
      // Total geral = bills pagas (locais) + delivery + balcão
      const salesTotal = billsTotal + deliveryTotal + counterTotal;
      const ordersCount = billsCount + (deliveryOrders?.length || 0) + (counterOrders?.length || 0);
      const avgTicket = ordersCount > 0 ? salesTotal / ordersCount : 0;

      // Mesas ocupadas
      const { data: occupiedTablesData } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_occupied", true);

      // Pedidos em preparo
      const { data: inPrepData } = await supabase
        .from("orders")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "accepted", "preparing"]);

      // Pedidos recentes (últimos 10)
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id,
          customer_name,
          created_at,
          status,
          order_type,
          tables (table_number)
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(10);

      const recentOrdersFormatted = (ordersData || []).map((order: any) => ({
        id: order.id,
        customer_name: order.customer_name,
        created_at: order.created_at,
        status: order.status,
        table_number: order.order_type === "delivery" 
          ? "Delivery" 
          : order.tables?.table_number || 0,
      }));

      // Contas abertas
      const { data: billsData } = await supabase
        .from("bills")
        .select(`
          id,
          total_amount,
          created_at,
          tables!inner(table_number, restaurant_id)
        `)
        .eq("tables.restaurant_id", restaurantId)
        .in("status", ["pending", "on_the_way"]);

      const openBillsFormatted = (billsData || []).map((bill: any) => ({
        id: bill.id,
        table_number: bill.tables?.table_number || 0,
        total_amount: Number(bill.total_amount),
        created_at: bill.created_at,
      }));

      setStats({
        salesToday: salesTotal,
        ordersCount,
        averageTicket: avgTicket,
        occupiedTables: occupiedTablesData?.length || 0,
        inPreparation: inPrepData?.length || 0,
      });

      setRecentOrders(recentOrdersFormatted);
      setOpenBills(openBillsFormatted);
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { 
            weekday: "long", 
            day: "numeric", 
            month: "long" 
          })}
        </p>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Vendas Hoje */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-300 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700">Vendas Hoje</p>
              <p className="text-3xl font-bold text-orange-900">
                R$ {stats.salesToday.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-orange-600">{stats.ordersCount} pedidos</p>
            </div>
            <div className="p-3 bg-orange-600 rounded-xl">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Ticket Médio */}
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-700">Ticket Médio</p>
              <p className="text-3xl font-bold text-amber-900">
                R$ {stats.averageTicket.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-amber-600">Por pedido pago</p>
            </div>
            <div className="p-3 bg-amber-500 rounded-xl">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Mesas Ocupadas */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700">Mesas Ocupadas</p>
              <p className="text-3xl font-bold text-orange-900">{stats.occupiedTables}</p>
              <p className="text-xs text-orange-600">de 4 mesas</p>
            </div>
            <div className="p-3 bg-orange-500 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Em Preparo */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700">Em Preparo</p>
              <p className="text-3xl font-bold text-orange-900">{stats.inPreparation}</p>
              <p className="text-xs text-orange-600">0 pendentes</p>
            </div>
            <div className="p-3 bg-orange-400 rounded-xl">
              <Clock className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>
      </div>

      {/* Seções: Pedidos Recentes e Contas Abertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pedidos Recentes */}
        <Card className="p-6 shadow-card">
          <h2 className="text-lg font-bold text-foreground mb-4">Pedidos Recentes</h2>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum pedido hoje</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Mesa {order.table_number} • {new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    order.status === "accepted" ? "bg-orange-100 text-orange-700" :
                    order.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-orange-50 text-orange-600"
                  }`}>
                    {order.status === "pending" ? "Pendente" : 
                     order.status === "accepted" ? "Aceito" : 
                     order.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Contas Abertas */}
        <Card className="p-6 shadow-card">
          <h2 className="text-lg font-bold text-foreground mb-4">Contas Abertas</h2>
          {openBills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma conta aberta</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openBills.slice(0, 5).map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">Mesa {bill.table_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bill.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary">
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
