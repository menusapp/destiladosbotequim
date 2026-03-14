import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, User, Phone, MapPin, Printer, MessageCircle, XCircle, Play, Plus, Home, Trash2, RefreshCw
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PaymentConfirmationModal } from "./PaymentConfirmationModal";
import { printOrder } from "@/lib/printOrder";
import { AddItemsToOrderDrawer } from "./AddItemsToOrderDrawer";

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
  tables?: { table_number: number };
  order_items: OrderItem[];
  delivery_fee?: number;
  coupon_discount?: number;
  loyalty_points_used?: number;
}

interface OrderDetailModalProps {
  order: Order;
  restaurantId: string;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export const OrderDetailModal = ({ order, restaurantId, onClose, onStatusUpdate }: OrderDetailModalProps) => {
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChangePaymentModal, setShowChangePaymentModal] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);

  const getElapsedTime = () => {
    const elapsed = Date.now() - new Date(order.created_at).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 5) return { text: `${minutes} min`, color: "text-green-600" };
    if (minutes < 15) return { text: `${minutes} min`, color: "text-yellow-600" };
    return { text: `${minutes} min`, color: "text-red-600" };
  };

  const elapsedTime = getElapsedTime();

  const calculateTotal = () => {
    return order.order_items.reduce((total, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce((sum, extra) => sum + extra.price_at_order, 0) * item.quantity;
      return total + itemTotal + extrasTotal;
    }, 0);
  };

  const sendWhatsAppNotification = async (newStatus: string) => {
    try {
      if (!order.delivery_phone) return;
      const { data: config } = await supabase.from('whatsapp_config').select('*').eq('restaurant_id', restaurantId).maybeSingle();
      if (!config?.enabled || config?.instance_status !== 'connected') return;

      let template: string | null = null;
      let messageType = '';
      if (newStatus === 'accepted' || newStatus === 'preparing') { template = config.message_accepted; messageType = 'accepted'; }
      else if (newStatus === 'out_for_delivery') {
        if (order.delivery_type === 'pickup') { template = config.message_ready_for_pickup; messageType = 'ready_for_pickup'; }
        else { template = config.message_out_for_delivery; messageType = 'out_for_delivery'; }
      } else if (newStatus === 'ready') { template = config.message_ready_for_pickup; messageType = 'ready_for_pickup'; }
      else if (newStatus === 'delivered') { template = config.message_delivered; messageType = 'delivered'; }
      else if (newStatus === 'picked_up') { template = config.message_picked_up; messageType = 'picked_up'; }
      else if (newStatus === 'cancelled') { template = config.message_cancelled; messageType = 'cancelled'; }
      if (!template) return;

      const { data: restaurant } = await supabase.from('restaurants').select('prep_time_minutes').eq('id', restaurantId).single();
      const tempoEstimado = restaurant?.prep_time_minutes?.toString() || '30';
      const message = template.replace(/{nome}/g, order.customer_name || 'Cliente').replace(/{pedido}/g, order.id.slice(0, 8)).replace(/{tempo}/g, tempoEstimado);

      await supabase.functions.invoke('whatsapp-send', { body: { restaurantId, phone: order.delivery_phone, message, orderId: order.id, messageType } });
    } catch (error) { console.error('[WhatsApp][AUTO] Erro:', error); }
  };

  const requiresPaymentForFinalization = (newStatus: string) => {
    const isLocal = order.order_type === "local" || (!order.order_type && order.table_id);
    if (isLocal) {
      if (newStatus === "delivered") return false;
      return false;
    }
    return ["delivered", "picked_up"].includes(newStatus);
  };

  const updateStatus = async (newStatus: string) => {
    // Block finalization without payment
    if (requiresPaymentForFinalization(newStatus) && (!order.payment_type || order.payment_type === "pending")) {
      toast.error("Defina a forma de pagamento antes de finalizar o pedido");
      setShowPaymentModal(true);
      return;
    }

    try {
      const { error } = await supabase.rpc("admin_update_order_status", { p_order_id: order.id, p_new_status: newStatus, p_restaurant_id: restaurantId });
      if (error) throw error;
      sendWhatsAppNotification(newStatus);
      if (newStatus === 'accepted') {
        try {
          const { data: printerConfig } = await supabase.from('printer_settings').select('auto_print_orders').eq('restaurant_id', restaurantId).maybeSingle();
          if (printerConfig?.auto_print_orders) await printOrder(order, restaurantId);
        } catch (printErr) { console.error('Auto-print error:', printErr); }
      }
      if (newStatus === 'delivered' || newStatus === 'picked_up') {
        supabase.functions.invoke('marketing-trigger', { body: { orderId: order.id, restaurantId } });
      }
      toast.success("Status atualizado!");
      onStatusUpdate();
      onClose();
    } catch (error) { console.error("Erro ao atualizar status:", error); toast.error("Erro ao atualizar status"); }
  };

  const handlePrint = async () => {
    try { await printOrder(order, restaurantId); } catch (error: any) { toast.error(error.message || "Erro ao imprimir"); }
  };

  const handleWhatsApp = () => {
    if (order.delivery_phone) { const phone = order.delivery_phone.replace(/\D/g, ""); window.open(`https://wa.me/55${phone}`, "_blank"); }
    else { toast.error("Telefone não informado"); }
  };

  const handleGoToTable = () => {
    if (order.table_id) { const slug = localStorage.getItem("restaurant_slug") || ""; navigate(`/${slug}/admin/mesa/${order.table_id}`); }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Aguardando confirmação", accepted: "Em preparo", preparing: "Preparando",
      ready: "Pronto para entrega", out_for_delivery: "Saiu para entrega",
      delivered: "Entregue", picked_up: "Retirado", cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getOrderOrigin = () => {
    const isLocal = order.order_type === "local" || (!order.order_type && order.table_id);
    if (isLocal) return `Digital - Mesa ${order.tables?.table_number || "?"}`;
    return order.delivery_type === "delivery" ? "Digital - Delivery" : "Digital - Retirada";
  };

  const canAddItems = ["pending", "accepted", "preparing"].includes(order.status);

  const handleAddItems = () => {
    setShowAddItems(true);
  };

  const handleChangePaymentConfirm = async () => {
    setShowChangePaymentModal(false);
    onStatusUpdate();
    toast.success("Forma de pagamento atualizada!");
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl">Pedido #{order.id.slice(0, 8)}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={elapsedTime.color}><Clock className="w-3 h-3 mr-1" />Tempo: {elapsedTime.text}</Badge>
                <Badge variant="secondary">{getStatusLabel(order.status)}</Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Ações */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Ações do Pedido</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {order.status === "pending" && (
                <Button onClick={() => updateStatus("accepted")} className="gap-2"><Play className="w-4 h-4" />Iniciar Preparo</Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && order.order_type === "delivery" && order.delivery_type === "delivery" && (
                <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2"><Play className="w-4 h-4" />Saiu para Entrega</Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && order.order_type === "delivery" && order.delivery_type === "pickup" && (
                <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2"><Play className="w-4 h-4" />Pronto para Retirada</Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && (order.order_type === "local" || (!order.order_type && order.table_id)) && (
                <Button onClick={() => updateStatus("delivered")} className="gap-2"><Play className="w-4 h-4" />Na Mesa</Button>
              )}
              {order.status === "delivered" && (order.order_type === "local" || (!order.order_type && order.table_id)) && (
                <Button 
                  onClick={() => {
                    if (!order.payment_type || order.payment_type === "pending") {
                      toast.error("Defina a forma de pagamento antes de finalizar");
                      setShowPaymentModal(true);
                      return;
                    }
                    // Mark as finalized - we keep status as delivered but with payment confirmed
                    toast.success("Pedido finalizado!");
                    onStatusUpdate();
                    onClose();
                  }} 
                  className="gap-2"
                  variant={(!order.payment_type || order.payment_type === "pending") ? "outline" : "default"}
                >
                  <Play className="w-4 h-4" />Finalizar
                </Button>
              )}
              {order.status === "out_for_delivery" && order.delivery_type === "delivery" && (
                <Button onClick={() => updateStatus("delivered")} className="gap-2"><Play className="w-4 h-4" />Confirmar Entrega</Button>
              )}
              {order.status === "out_for_delivery" && order.delivery_type === "pickup" && (
                <Button onClick={() => updateStatus("picked_up")} className="gap-2"><Play className="w-4 h-4" />Confirmar Retirada</Button>
              )}
              
              <Button variant="destructive" onClick={() => updateStatus("cancelled")} className="gap-2"><XCircle className="w-4 h-4" />Cancelar</Button>
              
              {canAddItems && (
                <Button variant="outline" className="gap-2" onClick={handleAddItems}><Plus className="w-4 h-4" />Adicionar Itens</Button>
              )}

              {order.table_id && (
                <Button variant="outline" onClick={handleGoToTable} className="gap-2"><Home className="w-4 h-4" />Mesa {order.tables?.table_number}</Button>
              )}
              
              <Button variant="outline" onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" />Imprimir</Button>
              
              {order.delivery_phone && (
                <Button variant="outline" onClick={handleWhatsApp} className="gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</Button>
              )}
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Itens do Pedido</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead>Complementos</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items.map((item) => {
                    const extrasTotal = item.order_item_extras.reduce((sum, extra) => sum + extra.price_at_order, 0);
                    const itemSubtotal = (item.price_at_order + extrasTotal) * item.quantity;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.products?.name || "Produto"}
                          {item.notes && <p className="text-xs text-muted-foreground mt-1">Obs: {item.notes}</p>}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">R$ {item.price_at_order.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.order_item_extras.length > 0 ? (
                            <div className="text-xs space-y-1">{item.order_item_extras.map((extra, idx) => (<div key={idx}>+ {extra.product_extras?.name} (R$ {extra.price_at_order.toFixed(2)})</div>))}</div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">R$ {itemSubtotal.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1 text-right">
                <p className="text-sm text-muted-foreground">Subtotal itens: R$ {calculateTotal().toFixed(2)}</p>
                {(order.delivery_fee ?? 0) > 0 && (
                  <p className="text-sm text-muted-foreground">Taxa de entrega: R$ {order.delivery_fee!.toFixed(2)}</p>
                )}
                {(order.coupon_discount ?? 0) > 0 && (
                  <p className="text-sm text-green-600">Desconto cupom: -R$ {order.coupon_discount!.toFixed(2)}</p>
                )}
                {(order.loyalty_points_used ?? 0) > 0 && (
                  <p className="text-sm text-green-600">Pontos fidelidade: -R$ {order.loyalty_points_used!.toFixed(2)}</p>
                )}
                <p className="text-2xl font-bold">
                  Total: R$ {(calculateTotal() + (order.delivery_fee ?? 0) - (order.coupon_discount ?? 0) - (order.loyalty_points_used ?? 0)).toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cliente e Detalhes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5" />Cliente</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div><p className="text-sm text-muted-foreground">Nome:</p><p className="font-medium">{order.customer_name}</p></div>
                {order.delivery_phone && (
                  <div><p className="text-sm text-muted-foreground">Telefone:</p><p className="font-medium flex items-center gap-2"><Phone className="w-4 h-4" />{order.delivery_phone}</p></div>
                )}
                {order.delivery_address && (
                  <div><p className="text-sm text-muted-foreground">Endereço:</p><p className="font-medium flex items-start gap-2"><MapPin className="w-4 h-4 mt-1" /><span>{order.delivery_address}</span></p></div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Detalhes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div><p className="text-sm text-muted-foreground">Data/Hora:</p><p className="font-medium">{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</p></div>
                <div><p className="text-sm text-muted-foreground">Origem:</p><p className="font-medium">{getOrderOrigin()}</p></div>
                {order.table_id && (<div><p className="text-sm text-muted-foreground">Mesa:</p><p className="font-medium">{order.tables?.table_number}</p></div>)}
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento:</p>
                  <div className="flex items-center gap-2">
                    {order.payment_type && order.payment_type !== "pending" ? (
                      <>
                        <p className="font-medium">{order.payment_type}</p>
                        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowChangePaymentModal(true)}>
                          <RefreshCw className="w-3 h-3" /> Alterar
                        </Button>
                      </>
                    ) : (
                      <Badge variant="destructive" className="text-xs">⚠ Falta pagamento</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pagamento */}
          {(!order.payment_type || order.payment_type === "pending") && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Pagamento</CardTitle></CardHeader>
              <CardContent>
                <Button onClick={() => setShowPaymentModal(true)} className="w-full">Confirmar Pagamento</Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {showPaymentModal && (
        <PaymentConfirmationModal
          order={order} restaurantId={restaurantId}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={() => { setShowPaymentModal(false); onStatusUpdate(); onClose(); }}
        />
      )}

      {showChangePaymentModal && (
        <PaymentConfirmationModal
          order={order} restaurantId={restaurantId}
          onClose={() => setShowChangePaymentModal(false)}
          onConfirm={handleChangePaymentConfirm}
        />
      )}

      <AddItemsToOrderDrawer
        open={showAddItems}
        onClose={() => setShowAddItems(false)}
        orderId={order.id}
        restaurantId={restaurantId}
        onItemsAdded={() => {
          setShowAddItems(false);
          onStatusUpdate();
        }}
      />
    </>
  );
};
