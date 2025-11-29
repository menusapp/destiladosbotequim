import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, Check, ChefHat, PackageCheck, Truck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface OrderItemExtra {
  price_at_order: number;
  product_extras: { name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  notes?: string;
  products: { name: string } | null;
  order_item_extras: OrderItemExtra[];
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_cpf: string;
  delivery_type: string;
  delivery_address?: string;
  delivery_phone?: string;
  notes?: string;
  order_items: OrderItem[];
}

const PedidosTab = ({ restaurantId }: { restaurantId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: new Date(),
  });

  useEffect(() => {
    fetchOrders();
    setupRealtime();
  }, [restaurantId, dateRange]);

  const setupRealtime = () => {
    const channel = supabase
      .channel(`delivery-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          created_at,
          customer_name,
          customer_cpf,
          delivery_type,
          delivery_address,
          delivery_phone,
          notes,
          order_items (
            id,
            quantity,
            price_at_order,
            notes,
            products (name),
            order_item_extras (
              price_at_order,
              product_extras (name)
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "delivery")
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase.rpc("admin_update_order_status", {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      toast.success("Status atualizado!");
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const getStatusColumn = (status: string) => {
    const columns: Record<string, string> = {
      pending: "pending",
      accepted: "accepted",
      preparing: "preparing",
      ready: "ready",
      out_for_delivery: "out_for_delivery",
      delivered: "delivered",
      picked_up: "delivered",
    };
    return columns[status] || "pending";
  };

  const groupedOrders = {
    pending: orders.filter((o) => o.status === "pending"),
    accepted: orders.filter((o) => o.status === "accepted"),
    preparing: orders.filter((o) => o.status === "preparing"),
    ready: orders.filter((o) => o.status === "ready"),
    out_for_delivery: orders.filter((o) => o.status === "out_for_delivery"),
    delivered: orders.filter((o) => ["delivered", "picked_up"].includes(o.status)),
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Aguardando", icon: Clock, variant: "secondary" as const },
      accepted: { label: "Aceito", icon: Check, variant: "default" as const },
      preparing: { label: "Preparando", icon: ChefHat, variant: "default" as const },
      ready: { label: "Pronto", icon: PackageCheck, variant: "default" as const },
      out_for_delivery: { label: "Saiu p/ Entrega", icon: Truck, variant: "default" as const },
      delivered: { label: "Entregue", icon: CheckCircle2, variant: "default" as const },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Carregando pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pedidos Delivery</h2>
          <p className="text-sm text-muted-foreground">Pedidos de entrega e retirada</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {Object.entries(groupedOrders).map(([status, statusOrders]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {status === "pending" && "Aguardando"}
                {status === "accepted" && "Aceito"}
                {status === "preparing" && "Preparando"}
                {status === "ready" && "Pronto"}
                {status === "out_for_delivery" && "Saiu p/ Entrega"}
                {status === "delivered" && "Entregue"}
              </h3>
              <Badge variant="secondary">{statusOrders.length}</Badge>
            </div>

            <div className="space-y-2">
              {statusOrders.map((order) => (
                <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(order.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <p className="text-sm font-medium mb-1">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
                    </p>

                    <div className="text-xs space-y-1 mb-3">
                      {order.order_items.slice(0, 2).map((item) => (
                        <p key={item.id}>
                          {item.quantity}x {item.products?.name || "Produto"}
                        </p>
                      ))}
                      {order.order_items.length > 2 && (
                        <p className="text-muted-foreground">
                          +{order.order_items.length - 2} itens
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1">
                      {order.status === "pending" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "accepted")}
                        >
                          Aceitar
                        </Button>
                      )}
                      {order.status === "accepted" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "preparing")}
                        >
                          Preparar
                        </Button>
                      )}
                      {order.status === "preparing" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "ready")}
                        >
                          Pronto
                        </Button>
                      )}
                      {order.status === "ready" && order.delivery_type === "delivery" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "out_for_delivery")}
                        >
                          Saiu
                        </Button>
                      )}
                      {order.status === "ready" && order.delivery_type === "pickup" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "picked_up")}
                        >
                          Retirado
                        </Button>
                      )}
                      {order.status === "out_for_delivery" && (
                        <Button
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateOrderStatus(order.id, "delivered")}
                        >
                          Entregue
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PedidosTab;
