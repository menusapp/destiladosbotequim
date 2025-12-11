import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Truck, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NewOrderNotification } from "./NewOrderNotification";
import { OrderDetailModal } from "./OrderDetailModal";

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
  delivery_type?: string;
  order_type?: string;
  delivery_address?: string;
  delivery_phone?: string;
  notes?: string;
  payment_type?: string;
  table_id?: string;
  tables?: {
    table_number: number;
  };
  order_items: OrderItem[];
}

const PedidosTab = ({ 
  restaurantId, 
  pendingOrderToOpen,
  onOrderOpened 
}: { 
  restaurantId: string;
  pendingOrderToOpen: string | null;
  onOrderOpened: () => void;
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return { from, to };
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
    setupRealtime();
  }, [restaurantId, dateRange]);

  // Auto-open pending order if passed from parent
  useEffect(() => {
    if (pendingOrderToOpen && orders.length > 0) {
      const orderToOpen = orders.find(o => o.id === pendingOrderToOpen);
      if (orderToOpen) {
        setSelectedOrder(orderToOpen);
        onOrderOpened();
      }
    }
  }, [pendingOrderToOpen, orders]);

  const setupRealtime = () => {
    const channel = supabase
      .channel(`all-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          fetchOrders();
        }
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
          order_type,
          delivery_address,
          delivery_phone,
          notes,
          payment_type,
          table_id,
          tables (table_number),
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

  const calculateTotal = (order: Order) => {
    return order.order_items.reduce((total, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce(
        (sum, extra) => sum + extra.price_at_order,
        0
      ) * item.quantity;
      return total + itemTotal + extrasTotal;
    }, 0);
  };

  const getElapsedMinutes = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const getElapsedColor = (minutes: number) => {
    if (minutes < 5) return "text-green-600 bg-green-50 border-green-200";
    if (minutes < 15) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const groupedOrders = {
    pending: orders.filter((o) => o.status === "pending"),
    preparing: orders.filter((o) => ["accepted", "preparing"].includes(o.status)),
    out_for_delivery: orders.filter((o) => o.status === "out_for_delivery"),
    delivered: orders.filter((o) => ["delivered", "picked_up"].includes(o.status)),
    cancelled: orders.filter((o) => o.status === "cancelled"),
  };

  const getOrderTypeIcon = (order: Order) => {
    if (order.order_type === "local") {
      return <UtensilsCrossed className="w-4 h-4" />;
    }
    if (order.delivery_type === "delivery") {
      return <Truck className="w-4 h-4" />;
    }
    return <ShoppingBag className="w-4 h-4" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Carregando pedidos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pedidos Online</h2>
          <p className="text-sm text-muted-foreground">Pedidos de delivery e retirada do cardápio digital</p>
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
                  const from = new Date(range.from);
                  from.setHours(0, 0, 0, 0);
                  const to = new Date(range.to);
                  to.setHours(23, 59, 59, 999);
                  setDateRange({ from, to });
                }
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { key: "pending", title: "Aguardando confirmação", bg: "bg-red-50" },
          { key: "preparing", title: "Preparando", bg: "bg-orange-50" },
          { key: "out_for_delivery", title: "Saiu / Pronto Retirada", bg: "bg-sky-50" },
          { key: "delivered", title: "Entregue", bg: "bg-green-50" },
          { key: "cancelled", title: "Cancelado", bg: "bg-gray-50" },
        ].map(({ key, title, bg }) => {
          const columnOrders = groupedOrders[key as keyof typeof groupedOrders];
          
          return (
            <div key={key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{title}</h3>
                <Badge variant="secondary">{columnOrders.length}</Badge>
              </div>

              <div className="space-y-2">
                {columnOrders.map((order) => {
                  const total = calculateTotal(order);
                  const elapsed = getElapsedMinutes(order.created_at);

                  return (
                    <Card
                      key={order.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${bg}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <CardContent className="p-4 space-y-2">
                        {/* Header with ID and Total */}
                        <div className="flex items-start justify-between">
                          <p className="font-bold text-sm">#{order.id.slice(0, 8)}</p>
                          <p className="font-bold text-sm">R$ {total.toFixed(2)}</p>
                        </div>

                        {/* Type badge */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getOrderTypeIcon(order)}
                          <span>
                            {order.delivery_type === "delivery" ? "Entrega" : "Retirada"}
                          </span>
                        </div>

                        {/* Customer name */}
                        <p className="text-sm font-medium flex items-center gap-1">
                          👤 {order.customer_name}
                        </p>

                        {/* Items */}
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Itens:</p>
                          {order.order_items.slice(0, 2).map((item) => (
                            <p key={item.id}>
                              {item.quantity}x {item.products?.name || "Produto"}
                            </p>
                          ))}
                          {order.order_items.length > 2 && (
                            <p>+{order.order_items.length - 2} itens</p>
                          )}
                        </div>

                        {/* Date and elapsed time */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            📅 {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                          </span>
                          <Badge className={getElapsedColor(elapsed)}>
                            ⏱️ {elapsed} min
                          </Badge>
                        </div>

                        {/* Ver detalhes link */}
                        <Button
                          variant="link"
                          className="w-full p-0 h-auto text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        >
                          🔗 Ver detalhes
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          restaurantId={restaurantId}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={fetchOrders}
        />
      )}
    </div>
  );
};

export default PedidosTab;
