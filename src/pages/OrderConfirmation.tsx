import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Clock, Phone, CheckCircle2, Package, Truck, MapPin } from "lucide-react";

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  products: {
    name: string;
  };
}

interface Order {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  delivery_address: string;
  delivery_phone: string;
  delivery_fee: number;
  coupon_code: string | null;
  coupon_discount: number;
  loyalty_points_used: number;
  restaurant_id: string;
  delivery_type?: string;
  order_items: OrderItem[];
}

interface Restaurant {
  name: string;
  logo_url: string | null;
  prep_time_minutes: number;
  service_fee_enabled: boolean;
  service_fee_percentage: number;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Aguardando confirmação",
    description: "Estamos recebendo seu pedido...",
    color: "bg-yellow-500",
  },
  accepted: {
    icon: CheckCircle2,
    label: "Pedido aceito",
    description: "Seu pedido foi confirmado!",
    color: "bg-blue-500",
  },
  preparing: {
    icon: Package,
    label: "Em preparo",
    description: "Estamos preparando seu pedido com carinho",
    color: "bg-orange-500",
  },
  ready: {
    icon: Truck,
    label: "Saiu para entrega",
    description: "Seu pedido está a caminho!",
    color: "bg-purple-500",
  },
  delivered: {
    icon: CheckCircle2,
    label: "Entregue",
    description: "Pedido entregue! Bom apetite!",
    color: "bg-green-500",
  },
};

export default function OrderConfirmation() {
  const { restaurantSlug, orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
    subscribeToOrderUpdates();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            price_at_order,
            products (name)
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData);

      // Buscar dados do restaurante usando restaurant_id direto do pedido
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("name, logo_url, prep_time_minutes, service_fee_enabled, service_fee_percentage")
        .eq("id", orderData.restaurant_id)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrderUpdates = () => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setOrder(payload.new as Order);

          // Notificações de mudança de status
          const newStatus = payload.new.status;
          if (newStatus === "accepted") {
            toast.success("Seu pedido foi aceito! 🎉");
          } else if (newStatus === "preparing") {
            toast.info("Seu pedido está sendo preparado! 👨‍🍳");
          } else if (newStatus === "ready") {
            toast.success("Seu pedido está a caminho! 🚚");
          } else if (newStatus === "delivered") {
            toast.success("Pedido entregue! Bom apetite! 🎉");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const calculateSubtotal = () => {
    if (!order) return 0;
    return order.order_items.reduce(
      (sum, item) => sum + item.price_at_order * item.quantity,
      0
    );
  };

  const calculateServiceFee = () => {
    if (!restaurant?.service_fee_enabled) return 0;
    return calculateSubtotal() * (restaurant.service_fee_percentage / 100);
  };

  const calculateTotal = () => {
    if (!order) return 0;
    return (
      calculateSubtotal() +
      order.delivery_fee +
      calculateServiceFee() -
      order.coupon_discount
    );
  };

  const StatusStep = ({ completed, label, time }: { completed: boolean; label: string; time?: string }) => (
    <div className="flex items-center gap-3">
      <div
        className={`w-3 h-3 rounded-full ${
          completed ? "bg-primary" : "bg-muted"
        }`}
      />
      <div className="flex-1">
        <p className={`text-sm ${completed ? "font-medium" : "text-muted-foreground"}`}>
          {label}
        </p>
        {time && <p className="text-xs text-muted-foreground">{time}</p>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!order || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-bold mb-2">Pedido não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Não foi possível encontrar este pedido
            </p>
            <Button onClick={() => navigate(`/delivery/${restaurantSlug}`)}>
              Voltar ao Cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
            />
          )}
          <h1 className="text-3xl font-bold">Pedido Confirmado!</h1>
          <p className="text-muted-foreground">
            Pedido #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Status atual */}
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <div className={`w-16 h-16 rounded-full ${statusInfo.color} flex items-center justify-center mx-auto mb-4`}>
              <StatusIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{statusInfo.label}</h2>
            <p className="text-muted-foreground">{statusInfo.description}</p>
          </CardContent>
        </Card>

        {/* Timeline de status */}
        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
              <StatusStep
                completed={true}
                label="Pedido recebido"
                time={format(new Date(order.created_at), "HH:mm")}
              />
              <StatusStep
                completed={["accepted", "ready", "delivered", "picked_up"].includes(order.status)}
                label="Em Preparo"
              />
              <StatusStep
                completed={["ready", "delivered", "picked_up"].includes(order.status)}
                label={order.delivery_type === "pickup" ? "Pronto para Retirada" : "Saiu para Entrega"}
              />
              <StatusStep 
                completed={["delivered", "picked_up"].includes(order.status)} 
                label={order.delivery_type === "pickup" ? "Retirado" : "Entregue"} 
              />
          </CardContent>
        </Card>

        {/* Detalhes do pedido */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Detalhes do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between mb-2">
                <span>
                  {item.quantity}x {item.products.name}
                </span>
                <span>R$ {(item.price_at_order * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <Separator className="my-4" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>R$ {calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de entrega</span>
                <span>R$ {order.delivery_fee.toFixed(2)}</span>
              </div>
              {restaurant.service_fee_enabled && (
                <div className="flex justify-between">
                  <span>Taxa de serviço ({restaurant.service_fee_percentage}%)</span>
                  <span>R$ {calculateServiceFee().toFixed(2)}</span>
                </div>
              )}
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto ({order.coupon_code})</span>
                  <span>-R$ {order.coupon_discount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço de entrega */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Endereço de Entrega
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2">{order.delivery_address}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {order.delivery_phone}
            </p>
          </CardContent>
        </Card>

        {/* Tempo estimado */}
        {["pending", "accepted", "preparing"].includes(order.status) && (
          <Card className="mb-6">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-lg font-medium">
                Tempo estimado: {restaurant.prep_time_minutes || 30}-{(restaurant.prep_time_minutes || 30) + 15} minutos
              </p>
            </CardContent>
          </Card>
        )}

        {/* Botão voltar */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => navigate(`/delivery/${restaurantSlug}`)}
        >
          Fazer Novo Pedido
        </Button>
      </div>
    </div>
  );
}
