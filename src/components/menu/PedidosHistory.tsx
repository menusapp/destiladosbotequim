import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Clock, MapPin, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PedidosHistoryProps {
  customerCPF: string;
  restaurantId: string;
  restaurantSlug: string;
}

export const PedidosHistory = ({
  customerCPF,
  restaurantId,
  restaurantSlug,
}: PedidosHistoryProps) => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();

    // Realtime subscription
    const channel = supabase
      .channel("customer-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_cpf=eq.${customerCPF}`,
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerCPF, restaurantId]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items(
            *,
            products(name, price),
            order_item_extras(
              *,
              product_extras(name, price)
            )
          )
        `
        )
        .eq("customer_cpf", customerCPF)
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "delivery")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pedido Recebido",
      accepted: "Em Preparo",
      ready: "Saiu para Entrega/Retirada",
      delivered: "Entregue",
      picked_up: "Retirado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500",
      accepted: "bg-blue-500",
      ready: "bg-orange-500",
      delivered: "bg-green-500",
      picked_up: "bg-purple-500",
      cancelled: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const calculateTotal = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras?.reduce(
        (s: number, e: any) => s + e.price_at_order,
        0
      ) || 0;
      return sum + itemTotal + extrasTotal;
    }, 0) || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Package className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum pedido ainda</h3>
        <p className="text-sm text-muted-foreground">
          Seus pedidos aparecerão aqui após a primeira compra
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-180px)]">
      <div className="space-y-4 p-4 pb-20">
        {orders.map((order) => (
          <Card 
            key={order.id}
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate(`/delivery/${restaurantSlug}/pedido/${order.id}`)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    Pedido #{order.id.slice(0, 8)}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </div>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.delivery_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">
                    {order.delivery_address}
                  </span>
                </div>
              )}
              
              <Separator />
              
              <div className="space-y-2">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.products?.name}
                      {item.order_item_extras?.length > 0 && (
                        <span className="text-muted-foreground text-xs block ml-4">
                          {item.order_item_extras
                            .map((e: any) => e.product_extras?.name)
                            .join(", ")}
                        </span>
                      )}
                    </span>
                    <span className="font-medium">
                      R$ {((item.price_at_order * item.quantity) + 
                        (item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>R$ {calculateTotal(order).toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};
