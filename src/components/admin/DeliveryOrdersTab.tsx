import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, Check, Printer, Search, Trash2, Calendar, CheckCircle2, Timer, Utensils, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";

interface OrderItemExtra {
  price_at_order: number;
  product_extras: { name: string } | null;
}

interface Order {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  notes: string | null;
  order_type: string | null;
  delivery_address: string | null;
  delivery_neighborhood: string | null;
  delivery_city: string | null;
  delivery_phone: string | null;
  delivery_fee: number | null;
  tables: { table_number: number };
  order_items: {
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: { name: string } | null;
    order_item_extras: OrderItemExtra[];
  }[];
}

const DeliveryOrdersTab = ({ restaurantId }: { restaurantId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // Mostrar pedidos dos últimos 30 dias por padrão para manter histórico
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date(new Date().setDate(new Date().getDate() - 30))));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("delivery-orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`*, tables!inner(table_number, restaurant_id), order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("tables.restaurant_id", restaurantId)
      .eq("order_type", "delivery")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos de delivery");
      setLoading(false);
      return;
    }

    setOrders(data || []);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success("Status atualizado!");
    fetchOrders();
  };

  const deleteOrder = async (orderId: string) => {
    const { error } = await supabase.rpc("admin_delete_order", {
      p_order_id: orderId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao excluir pedido");
      return;
    }

    toast.success("Pedido excluído!");
    fetchOrders();
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open("", "", "height=600,width=400");
    if (!printWindow) return;

    const itemsHtml = order.order_items
      .map((item) => {
        const extrasTotal = item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
        const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
        const productName = item.products?.name || "Produto excluído";
        const extras =
          item.order_item_extras && item.order_item_extras.length > 0
            ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px;">+ ${item.order_item_extras.map((e) => e.product_extras?.name || "Extra excluído").join(", ")}</div>`
            : "";
        const notes = item.notes ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px; font-style: italic; color: #b45309;">Obs: ${item.notes}</div>` : "";

        return `
          <div style="margin: 6px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 12px;">
              <span><strong>${item.quantity}x</strong> ${productName}</span>
              <span>R$ ${itemTotal.toFixed(2)}</span>
            </div>
            ${extras}
            ${notes}
          </div>
        `;
      })
      .join("");

    const subtotal = order.order_items.reduce((sum, item) => {
      const extrasTotal = item.order_item_extras?.reduce((eSum, extra) => eSum + extra.price_at_order, 0) || 0;
      return sum + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0);

    const deliveryFee = order.delivery_fee || 0;
    const total = subtotal + deliveryFee;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Pedido Delivery #${order.id.slice(0, 8)}</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">PEDIDO DELIVERY</h2>
            <p style="margin: 4px 0; font-size: 11px; color: #666;">${format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
          </div>
          <div style="margin: 12px 0; padding: 8px; background: #f9fafb; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px;"><strong>Cliente:</strong> ${order.customer_name}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">CPF: ${order.customer_cpf}</p>
            ${order.delivery_phone ? `<p style="margin: 4px 0; font-size: 12px; color: #666;">Tel: ${order.delivery_phone}</p>` : ""}
          </div>
          <div style="margin: 12px 0; padding: 8px; background: #dbeafe; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px; font-weight: bold; color: #1e40af;">Endereço de Entrega:</p>
            <p style="margin: 4px 0; font-size: 12px; color: #1e3a8a;">${order.delivery_address || ""}</p>
            ${order.delivery_neighborhood ? `<p style="margin: 2px 0; font-size: 11px; color: #1e3a8a;">Bairro: ${order.delivery_neighborhood}</p>` : ""}
            ${order.delivery_city ? `<p style="margin: 2px 0; font-size: 11px; color: #1e3a8a;">Cidade: ${order.delivery_city}</p>` : ""}
          </div>
          <div style="border-top: 1px dashed #ddd; margin: 12px 0;"></div>
          ${itemsHtml}
          ${order.notes ? `<div style="margin: 12px 0; padding: 8px; background: #fef3c7; border-radius: 4px;"><p style="margin: 0; font-size: 12px;"><strong>Observação:</strong> ${order.notes}</p></div>` : ""}
          <div style="border-top: 1px solid #ddd; margin: 12px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0;">
            <span>Subtotal</span>
            <span>R$ ${subtotal.toFixed(2)}</span>
          </div>
          ${deliveryFee > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0;"><span>Taxa de Entrega</span><span>R$ ${deliveryFee.toFixed(2)}</span></div>` : ""}
          <div style="border-top: 2px solid #000; margin: 12px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
            <span>TOTAL</span>
            <span>R$ ${total.toFixed(2)}</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { icon: any; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { icon: Clock, label: "Pendente", variant: "outline" },
      accepted: { icon: CheckCircle2, label: "Aceito", variant: "default" },
      preparing: { icon: Utensils, label: "Preparando", variant: "secondary" },
      ready: { icon: Timer, label: "Pronto", variant: "default" },
      delivered: { icon: Check, label: "Entregue", variant: "default" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter((order) =>
    order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_cpf.includes(searchQuery) ||
    order.delivery_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.delivery_neighborhood?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Pedidos Delivery</h2>
          <p className="text-muted-foreground">Gerencie pedidos para entrega</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, CPF ou endereço..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Calendar className="h-4 w-4" />
                {format(startDate, "dd/MM/yyyy", { locale: pt })} - {format(endDate, "dd/MM/yyyy", { locale: pt })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 space-y-4">
                <div>
                  <div className="mb-2 font-semibold">Data inicial</div>
                  <CalendarComponent mode="single" selected={startDate} onSelect={(date) => date && setStartDate(startOfDay(date))} locale={pt} />
                </div>
                <div>
                  <div className="mb-2 font-semibold">Data final</div>
                  <CalendarComponent mode="single" selected={endDate} onSelect={(date) => date && setEndDate(endOfDay(date))} locale={pt} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando pedidos...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido de delivery encontrado</p>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const subtotal = order.order_items.reduce((sum, item) => {
                  const extrasTotal = item.order_item_extras?.reduce((eSum, extra) => eSum + extra.price_at_order, 0) || 0;
                  return sum + (item.price_at_order + extrasTotal) * item.quantity;
                }, 0);

                const deliveryFee = order.delivery_fee || 0;
                const total = subtotal + deliveryFee;

                return (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                              <Truck className="h-3 w-3" />
                              Delivery
                            </Badge>
                            {getStatusBadge(order.status)}
                          </div>
                          <div>
                            <p className="font-semibold">{order.customer_name}</p>
                            <p className="text-sm text-muted-foreground">CPF: {order.customer_cpf}</p>
                            {order.delivery_phone && <p className="text-sm text-muted-foreground">Tel: {order.delivery_phone}</p>}
                            <p className="text-sm text-muted-foreground">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
                          </div>
                          {order.delivery_address && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                              <p className="text-sm font-semibold text-blue-800">Endereço de Entrega:</p>
                              <p className="text-sm text-blue-700">{order.delivery_address}</p>
                              {order.delivery_neighborhood && <p className="text-xs text-blue-600">Bairro: {order.delivery_neighborhood}</p>}
                              {order.delivery_city && <p className="text-xs text-blue-600">Cidade: {order.delivery_city}</p>}
                            </div>
                          )}
                          <div className="space-y-1">
                            {order.order_items.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium">{item.quantity}x</span> {item.products?.name || "Produto excluído"}
                                {item.order_item_extras && item.order_item_extras.length > 0 && (
                                  <span className="text-muted-foreground text-xs ml-2">
                                    + {item.order_item_extras.map((e) => e.product_extras?.name || "Extra excluído").join(", ")}
                                  </span>
                                )}
                                {item.notes && <p className="text-xs text-orange-600 italic ml-4">Obs: {item.notes}</p>}
                              </div>
                            ))}
                          </div>
                          {order.notes && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                              <p className="font-semibold text-yellow-800">Observação:</p>
                              <p className="text-yellow-700">{order.notes}</p>
                            </div>
                          )}
                          <div className="space-y-1 pt-2 border-t">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span>R$ {subtotal.toFixed(2)}</span>
                            </div>
                            {deliveryFee > 0 && (
                              <div className="flex justify-between text-sm">
                                <span>Taxa de Entrega:</span>
                                <span>R$ {deliveryFee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total:</span>
                              <span>R$ {total.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => printOrder(order)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {order.status === "pending" && (
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, "accepted")}>
                              <Check className="h-4 w-4 mr-1" />
                              Aceitar
                            </Button>
                          )}
                          {order.status === "accepted" && (
                            <Button size="sm" onClick={() => updateOrderStatus(order.id, "delivered")}>
                              <Check className="h-4 w-4 mr-1" />
                              Concluir
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteOrder(order.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryOrdersTab;
