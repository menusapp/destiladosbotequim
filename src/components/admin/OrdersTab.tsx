import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, ChefHat, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItemExtra {
  price_at_order: number;
  product_extras: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  status: string;
  created_at: string;
  tables: {
    table_number: number;
  };
  order_items: {
    quantity: number;
    price_at_order: number;
    products: {
      name: string;
    } | null;
    order_item_extras: OrderItemExtra[];
  }[];
}

const OrdersTab = ({ restaurantId }: { restaurantId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetchOrders();
    
    // Realtime subscription
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        tables!inner(table_number, restaurant_id),
        order_items(
          quantity,
          price_at_order,
          products(name),
          order_item_extras(
            price_at_order,
            product_extras(name)
          )
        )
      `)
      .eq("tables.restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos");
      return;
    }

    setOrders(data || []);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success("Status atualizado!");
    fetchOrders();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
      accepted: { label: "Aceito", variant: "default" as const, icon: Check },
      preparing: { label: "Preparando", variant: "default" as const, icon: ChefHat },
      ready: { label: "Pronto", variant: "default" as const, icon: Check },
      delivered: { label: "Entregue", variant: "default" as const, icon: Truck },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getNextStatus = (currentStatus: string) => {
    const statusFlow: Record<string, string> = {
      pending: "accepted",
      accepted: "preparing",
      preparing: "ready",
      ready: "delivered",
    };
    return statusFlow[currentStatus];
  };

  const getNextStatusLabel = (currentStatus: string) => {
    const labels: Record<string, string> = {
      pending: "Aceitar",
      accepted: "Iniciar Preparo",
      preparing: "Marcar como Pronto",
      ready: "Marcar como Entregue",
    };
    return labels[currentStatus];
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Pedidos em Tempo Real</h3>

      {orders.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhum pedido ainda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-4 border rounded-lg space-y-3 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Mesa {order.tables.table_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {order.customer_name}
                  </p>
                </div>
                {getStatusBadge(order.status)}
              </div>

              <div className="space-y-1">
                {order.order_items.map((item, idx) => {
                  const extrasTotal = item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
                  const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
                  const productName = item.products?.name || "Produto excluído";
                  
                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between text-sm">
                        <span className={!item.products ? "text-muted-foreground" : ""}>
                          {item.quantity}x {productName}
                        </span>
                        <span className="text-primary font-medium">
                          R$ {itemTotal.toFixed(2)}
                        </span>
                      </div>
                      {item.order_item_extras && item.order_item_extras.length > 0 && (
                        <div className="text-xs text-muted-foreground pl-4">
                          + {item.order_item_extras.map(e => e.product_extras?.name || "Extra excluído").join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {order.status !== "delivered" && (
                <Button
                  className="w-full"
                  onClick={() => updateOrderStatus(order.id, getNextStatus(order.status))}
                >
                  {getNextStatusLabel(order.status)}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
