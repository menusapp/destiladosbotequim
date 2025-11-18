import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Printer, Trash2, Clock, User, Phone, MapPin, Package, Check, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface OrderItemExtra {
  id: string;
  price_at_order: number;
  product_extra_id: string | null;
  product_extras: {
    name: string;
    price: number;
  } | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_cpf: string;
  delivery_phone: string | null;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  order_type: string | null;
  order_items: Array<{
    id: string;
    quantity: number;
    price_at_order: number;
    products: {
      name: string;
    } | null;
    order_item_extras: OrderItemExtra[];
  }>;
}

interface DeliveryOrdersTabProps {
  restaurantId: string;
}

export default function DeliveryOrdersTab({ restaurantId }: DeliveryOrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("delivery-orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, startDate, endDate]);

  const fetchOrders = async () => {
    try {
      let query = supabase
        .from("orders")
        .select(
          `
          *,
          order_items(
            id,
            quantity,
            price_at_order,
            products(name),
            order_item_extras(
              id,
              price_at_order,
              product_extra_id,
              product_extras(name, price)
            )
          ),
          tables!inner(restaurant_id)
        `
        )
        .eq("tables.restaurant_id", restaurantId)
        .eq("order_type", "delivery")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
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

      const statusMessages: Record<string, string> = {
        accepted: "Pedido aceito e em produção",
        ready: "Pedido marcado como pronto",
        delivered: "Entrega confirmada",
        picked_up: "Retirada confirmada",
      };

      toast.success(statusMessages[newStatus] || "Status atualizado");
      fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Erro ao atualizar pedido");
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase.rpc("admin_delete_order", {
        p_order_id: orderId,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;

      toast.success("Pedido excluído com sucesso");
      fetchOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Erro ao excluir pedido");
    }
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const orderTotal = order.order_items.reduce((sum, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce(
        (extraSum, extra) => extraSum + extra.price_at_order,
        0
      );
      return sum + itemTotal + extrasTotal * item.quantity;
    }, 0);

    const isDelivery = !!order.delivery_address;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido #${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 20px; margin-bottom: 10px; }
            .info { margin: 10px 0; }
            .items { margin-top: 20px; }
            .item { margin: 10px 0; padding: 10px; border-bottom: 1px solid #ddd; }
            .total { margin-top: 20px; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Pedido #${order.id.slice(0, 8)}</h1>
          <div class="info">
            <p><strong>Tipo:</strong> ${isDelivery ? "Delivery" : "Retirada"}</p>
            <p><strong>Data:</strong> ${order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}</p>
            <p><strong>Cliente:</strong> ${order.customer_name}</p>
            <p><strong>CPF:</strong> ${order.customer_cpf}</p>
            <p><strong>Telefone:</strong> ${order.delivery_phone || "Não informado"}</p>
            ${
              isDelivery
                ? `<p><strong>Endereço:</strong> ${order.delivery_address}, ${order.delivery_neighborhood}, ${order.delivery_city}</p>`
                : ""
            }
          </div>
          <div class="items">
            <h2>Itens do Pedido</h2>
            ${order.order_items
              .map(
                (item) => `
              <div class="item">
                <p><strong>${item.quantity}x ${item.products?.name || "Produto removido"}</strong></p>
                <p>R$ ${item.price_at_order.toFixed(2)}</p>
                ${
                  item.order_item_extras.length > 0
                    ? `<p style="margin-left: 20px;">Adicionais:<br/>${item.order_item_extras
                        .map(
                          (extra) =>
                            `- ${extra.product_extras?.name || "Extra removido"} (R$ ${extra.price_at_order.toFixed(2)})`
                        )
                        .join("<br/>")}</p>`
                    : ""
                }
              </div>
            `
              )
              .join("")}
          </div>
          ${order.notes ? `<div class="info"><p><strong>Observações:</strong> ${order.notes}</p></div>` : ""}
          <div class="total">
            <p>Total: R$ ${orderTotal.toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const isDeliveryOrder = (order: Order) => !!order.delivery_address;

  const calculateTotal = (order: Order) => {
    return order.order_items.reduce((sum, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce(
        (extraSum, extra) => extraSum + extra.price_at_order,
        0
      );
      return sum + itemTotal + extrasTotal * item.quantity;
    }, 0);
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_cpf.includes(searchQuery) ||
      (order.delivery_address && order.delivery_address.toLowerCase().includes(searchLower))
    );
  });

  const pendingOrders = filteredOrders.filter((o) => o.status === "pending");
  const acceptedOrders = filteredOrders.filter((o) => o.status === "accepted");
  const readyOrders = filteredOrders.filter((o) => o.status === "ready");
  const finishedOrders = filteredOrders.filter((o) => o.status === "delivered" || o.status === "picked_up");

  const OrderCard = ({ order }: { order: Order }) => {
    const isDelivery = isDeliveryOrder(order);
    const total = calculateTotal(order);
    const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <Card className="p-4 mb-3 hover:shadow-md transition-shadow">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">#{order.id.slice(0, 8)}</span>
              <Badge variant={isDelivery ? "default" : "secondary"}>
                {isDelivery ? "🚚 Delivery" : "📦 Retirada"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              {order.created_at ? format(new Date(order.created_at), "HH:mm", { locale: ptBR }) : ""}
            </div>
          </div>

          {/* Customer Info */}
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="text-muted-foreground">CPF: {order.customer_cpf}</div>
            {order.delivery_phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4" />
                {order.delivery_phone}
              </div>
            )}
          </div>

          {/* Address for delivery */}
          {isDelivery && order.delivery_address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {order.delivery_address}, {order.delivery_neighborhood}, {order.delivery_city}
              </span>
            </div>
          )}

          {/* Items Summary */}
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span>
          </div>

          {/* Total */}
          <div className="font-semibold text-lg text-primary">
            Total: R$ {total.toFixed(2)}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <strong>Obs:</strong> {order.notes}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {order.status === "pending" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "accepted")}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                Aceitar Pedido
              </Button>
            )}

            {order.status === "accepted" && (
              <Button
                size="sm"
                onClick={() => updateOrderStatus(order.id, "ready")}
                className="flex-1"
              >
                Avançar Pedido
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}

            {order.status === "ready" && (
              <Button
                size="sm"
                onClick={() =>
                  updateOrderStatus(order.id, isDelivery ? "delivered" : "picked_up")
                }
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-1" />
                {isDelivery ? "Confirmar Entrega" : "Confirmar Retirada"}
              </Button>
            )}

            <Button size="sm" variant="outline" onClick={() => printOrder(order)}>
              <Printer className="w-4 h-4" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O pedido será permanentemente removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteOrder(order.id)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>
    );
  };

  const FinishedOrderCard = ({ order }: { order: Order }) => {
    const isDelivery = isDeliveryOrder(order);
    const total = calculateTotal(order);
    const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
        {/* Coluna 1: ID + Status */}
        <div className="flex items-center gap-3 min-w-[180px]">
          <span className="font-semibold text-sm">#{order.id.slice(0, 8)}</span>
          <Badge variant={order.status === "delivered" ? "default" : "outline"} className="text-xs">
            {order.status === "delivered" ? "✓ Entregue" : "✓ Retirado"}
          </Badge>
        </div>

        {/* Coluna 2: Data/Hora */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-[140px]">
          <Clock className="w-4 h-4" />
          {order.created_at ? format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}
        </div>

        {/* Coluna 3: Cliente */}
        <div className="flex-1 min-w-[200px]">
          <div className="font-medium text-sm">{order.customer_name}</div>
          <div className="text-xs text-muted-foreground">{order.customer_cpf}</div>
        </div>

        {/* Coluna 4: Tipo + Itens */}
        <div className="min-w-[120px]">
          <Badge variant={isDelivery ? "default" : "secondary"} className="text-xs">
            {isDelivery ? "🚚 Delivery" : "📦 Retirada"}
          </Badge>
          <span className="text-xs text-muted-foreground ml-2">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
        </div>

        {/* Coluna 5: Total */}
        <div className="font-semibold text-primary min-w-[100px] text-right">
          R$ {total.toFixed(2)}
        </div>

        {/* Coluna 6: Ações */}
        <div className="flex items-center gap-2 ml-4">
          <Button size="sm" variant="outline" onClick={() => printOrder(order)}>
            <Printer className="w-4 h-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir pedido finalizado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteOrder(order.id)}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por cliente, CPF ou endereço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate && endDate
                ? `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`
                : "Filtrar por período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-3 space-y-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Data Início</label>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Data Fim</label>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Em Análise */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg">Em Análise</h3>
            <Badge variant="secondary">{pendingOrders.length}</Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-3 pr-2">
              {pendingOrders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum pedido pendente
                </div>
              ) : (
                pendingOrders.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 2: Em Produção */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg">Em Produção</h3>
            <Badge variant="secondary">{acceptedOrders.length}</Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-3 pr-2">
              {acceptedOrders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum pedido em produção
                </div>
              ) : (
                acceptedOrders.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Column 3: Pronto */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold text-lg">Pronto p/ Entrega/Retirada</h3>
            <Badge variant="secondary">{readyOrders.length}</Badge>
          </div>
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-3 pr-2">
              {readyOrders.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Nenhum pedido pronto
                </div>
              ) : (
                readyOrders.map((order) => <OrderCard key={order.id} order={order} />)
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Card de Pedidos Finalizados */}
      <div className="mt-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-3">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Package className="w-5 h-5" />
            Pedidos Finalizados
          </h3>
          <Badge variant="secondary">{finishedOrders.length}</Badge>
        </div>
        
        {finishedOrders.length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              Nenhum pedido finalizado no período selecionado
            </div>
          </Card>
        ) : (
          <Card className="p-4">
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-2">
                {finishedOrders.map((order) => (
                  <FinishedOrderCard key={order.id} order={order} />
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}
