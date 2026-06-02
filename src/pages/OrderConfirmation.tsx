import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { resolveSlug } from "@/lib/slugResolver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { Clock, Phone, CheckCircle2, Package, Truck, MapPin, XCircle } from "lucide-react";
import { ReviewModal } from "@/components/menu/ReviewModal";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";

interface OrderItemExtra {
  price_at_order: number;
  extra_name?: string | null;
  product_extras: { name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  notes?: string | null;
  products: {
    name: string;
  };
  order_item_extras: OrderItemExtra[];
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
  service_fee?: number;
  ifood_source?: boolean;
  order_items: OrderItem[];
}

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  prep_time_minutes: number;
  service_fee_enabled: boolean;
  service_fee_percentage: number;
  store_address?: string | null;
}

const getStatusConfig = (status: string, deliveryType?: string) => {
  const configs: Record<string, any> = {
    pending: {
      icon: Clock,
      label: "Aguardando confirmação",
      description: "Estamos recebendo seu pedido...",
      color: "bg-yellow-500",
    },
    accepted: {
      icon: Package,
      label: "Em Preparo",
      description: "Seu pedido foi aceito e está sendo preparado!",
      color: "bg-blue-500",
    },
    out_for_delivery: {
      icon: deliveryType === "pickup" ? Package : Truck,
      label: deliveryType === "pickup" ? "Pronto para Retirada" : "Saiu para Entrega",
      description: deliveryType === "pickup" 
        ? "Seu pedido está pronto! Pode retirar." 
        : "Seu pedido está a caminho!",
      color: "bg-indigo-500",
    },
    delivered: {
      icon: CheckCircle2,
      label: "Entregue",
      description: "Pedido entregue! Bom apetite!",
      color: "bg-green-500",
    },
    picked_up: {
      icon: CheckCircle2,
      label: "Retirado",
      description: "Pedido retirado! Bom apetite!",
      color: "bg-green-500",
    },
    cancelled: {
      icon: XCircle,
      label: "Pedido Cancelado",
      description: "Infelizmente seu pedido foi cancelado.",
      color: "bg-red-500",
    },
  };
  return configs[status] || configs.pending;
};

export default function OrderConfirmation() {
  const { slug: pathSlug, orderId } = useParams();
  const restaurantSlug = resolveSlug(pathSlug);
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useDynamicFavicon(restaurant?.logo_url, restaurant?.name);

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
            notes,
            products (name),
            order_item_extras (price_at_order, extra_name, product_extras(name))
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData as any);

      // Buscar dados do restaurante usando restaurant_id direto do pedido
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select(`
          id,
          name, 
          logo_url, 
          prep_time_minutes, 
          service_fee_enabled, 
          service_fee_percentage,
          delivery_config(store_address)
        `)
        .eq("id", orderData.restaurant_id)
        .single();

      if (restaurantError) throw restaurantError;
      
      // Extrair store_address do delivery_config
      const storeAddress = (restaurantData as any).delivery_config?.store_address;
      setRestaurant({ 
        id: restaurantData.id,
        name: restaurantData.name,
        logo_url: restaurantData.logo_url,
        prep_time_minutes: restaurantData.prep_time_minutes,
        service_fee_enabled: restaurantData.service_fee_enabled,
        service_fee_percentage: restaurantData.service_fee_percentage,
        store_address: storeAddress 
      });
      
      // Verificar se pedido já foi avaliado
      await checkExistingReview();
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Erro ao carregar pedido");
    } finally {
      setLoading(false);
    }
  };

  const checkExistingReview = async () => {
    if (!orderId) return;
    
    const { data } = await supabase
      .from("restaurant_reviews")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();
    
    setHasReviewed(!!data);
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
        async (payload) => {
          const newStatus = (payload.new as any).status;
          const deliveryType = (payload.new as any).delivery_type;

          // Re-fetch full order with relations instead of using incomplete payload
          const { data: fullOrder } = await supabase
            .from("orders")
            .select(`
              *,
              order_items (
                id,
                quantity,
                price_at_order,
                notes,
                products (name),
                order_item_extras (price_at_order, extra_name, product_extras(name))
              )
            `)
            .eq("id", orderId)
            .single();

          if (fullOrder) {
            setOrder(fullOrder as any);
          }

          // Notificações de mudança de status
          if (newStatus === "accepted") {
            toast.success("Seu pedido foi aceito e está em preparo! 🎉");
          } else if (newStatus === "out_for_delivery") {
            toast.success(
              deliveryType === "pickup" 
                ? "Seu pedido está pronto para retirada! 📦" 
                : "Seu pedido saiu para entrega! 🚚"
            );
          } else if (newStatus === "delivered") {
            toast.success("Pedido entregue! Bom apetite! 🎉");
            setTimeout(async () => {
              await checkExistingReview();
              if (!hasReviewed) {
                setShowReview(true);
              }
            }, 2000);
          } else if (newStatus === "picked_up") {
            toast.success("Pedido retirado! Bom apetite! 🎉");
            setTimeout(async () => {
              await checkExistingReview();
              if (!hasReviewed) {
                setShowReview(true);
              }
            }, 2000);
          } else if (newStatus === "cancelled") {
            toast.error("Seu pedido foi cancelado 😔");
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
    return (order.order_items ?? []).reduce((sum, item) => {
      const extrasTotal = (item.order_item_extras ?? []).reduce((s, e) => s + e.price_at_order, 0);
      return sum + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0);
  };

  const calculateServiceFee = () => {
    // iFood/external orders carry their own marketplace service fee in `service_fee`.
    if (order?.service_fee && order.service_fee > 0) return order.service_fee;
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
            <Button onClick={() => navigate(`/${restaurantSlug}`)}>
              Voltar ao Cardápio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusConfig(order.status, order.delivery_type);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
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
              {order.status === "cancelled" ? (
                <>
                  <StatusStep
                    completed={true}
                    label="Pedido recebido"
                    time={format(new Date(order.created_at), "HH:mm")}
                  />
                  <StatusStep
                    completed={true}
                    label="Pedido Cancelado"
                  />
                </>
              ) : (
                <>
                  <StatusStep
                    completed={true}
                    label="Pedido recebido"
                    time={format(new Date(order.created_at), "HH:mm")}
                  />
                  <StatusStep
                    completed={["accepted", "out_for_delivery", "delivered", "picked_up"].includes(order.status)}
                    label="Em Preparo"
                  />
                  {order.delivery_type === "pickup" ? (
                    <StatusStep
                      completed={["out_for_delivery", "picked_up"].includes(order.status)}
                      label="Pronto para Retirada"
                    />
                  ) : (
                    <StatusStep
                      completed={["out_for_delivery", "delivered"].includes(order.status)}
                      label="Saiu para Entrega"
                    />
                  )}
                  <StatusStep 
                    completed={["delivered", "picked_up"].includes(order.status)} 
                    label={order.delivery_type === "pickup" ? "Retirado" : "Entregue"} 
                  />
                </>
              )}
            </CardContent>
          </Card>

          {/* Detalhes do pedido */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Detalhes do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              {(order.order_items ?? []).map((item) => {
                const extrasTotal = (item.order_item_extras ?? []).reduce((s, e) => s + e.price_at_order, 0);
                const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
                return (
                  <div key={item.id} className="mb-3">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {item.quantity}x {item.products?.name}
                      </span>
                      <span>R$ {itemTotal.toFixed(2)}</span>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground italic ml-4">Obs: {item.notes}</p>
                    )}
                    {(item.order_item_extras ?? []).map((extra, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-muted-foreground ml-4">
                        <span>+ {extra.extra_name || extra.product_extras?.name || "Extra"}</span>
                        <span>R$ {extra.price_at_order.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
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
                {(order.service_fee ?? 0) > 0 ? (
                  <div className="flex justify-between">
                    <span>Taxa de serviço</span>
                    <span>R$ {calculateServiceFee().toFixed(2)}</span>
                  </div>
                ) : restaurant.service_fee_enabled && (
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

          {/* Endereço de entrega/retirada */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {order.delivery_type === "pickup" ? "Local de Retirada" : "Endereço de Entrega"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.delivery_type === "pickup" ? (
                <>
                  <p className="mb-2">{restaurant.store_address || "Retirar na loja"}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.delivery_phone}
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-2">{order.delivery_address}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {order.delivery_phone}
                  </p>
                </>
              )}
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
        </div>
      </div>

      {/* Botão fixo no rodapé */}
      <div className="shrink-0 p-4 border-t bg-background">
        <div className="max-w-2xl mx-auto">
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate(`/${restaurantSlug}`)}
          >
            Fazer Novo Pedido
          </Button>
        </div>
      </div>
      
      {/* Review Modal */}
      <ReviewModal
        open={showReview}
        onClose={() => {
          setShowReview(false);
          setHasReviewed(true);
        }}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        orderId={order.id}
      />
    </div>
  );
}
