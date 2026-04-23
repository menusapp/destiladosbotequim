import { useState, useEffect, useCallback } from "react";
import { formatPaymentForDisplay } from "@/lib/utils";
import { getOrderOriginLabel } from "@/lib/orderOrigin";
import { useOrderStatusAdvance } from "@/hooks/useOrderStatusAdvance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { 
  Clock, User, Phone, MapPin, Printer, MessageCircle, XCircle, Play, Plus, Home, Trash2, RefreshCw, Loader2, CalendarClock, ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { PaymentConfirmationModal } from "./PaymentConfirmationModal";
import { printOrder, printKitchenReceipt } from "@/lib/printOrder";
import { AddItemsToOrderDrawer } from "./AddItemsToOrderDrawer";
import { useStaffOrderPermissions } from "@/hooks/useStaffOrderPermissions";

interface OrderItemExtra {
  price_at_order: number;
  extra_name?: string | null;
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
  payment_brand?: string;
  table_id?: string;
  tables?: { table_number: number };
  order_items: OrderItem[];
  delivery_fee?: number;
  coupon_discount?: number;
  loyalty_points_used?: number;
  ifood_source?: boolean;
  ifood_order_id?: string;
  dd_source?: boolean;
  dd_order_id?: string;
  dd_scheduled_for?: string;
  cancellation_reason?: string;
}

interface OrderDetailModalProps {
  order: Order;
  restaurantId: string;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export const OrderDetailModal = ({ order: initialOrder, restaurantId, onClose, onStatusUpdate }: OrderDetailModalProps) => {
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showChangePaymentModal, setShowChangePaymentModal] = useState(false);
  const [showAddItems, setShowAddItems] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>(initialOrder);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const { advanceStatus } = useOrderStatusAdvance(restaurantId);

  // Collapsible state
  const [itemsOpen, setItemsOpen] = useState(true);
  const [clienteOpen, setClienteOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [pagamentoOpen, setPagamentoOpen] = useState(false);

  // Realtime: refresh order data when order_items or orders change
  const refreshOrder = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`id, status, created_at, customer_name, customer_cpf, delivery_type, order_type, delivery_address, delivery_phone, notes, payment_type, payment_brand, delivery_fee, coupon_discount, loyalty_points_used, ifood_source, ifood_order_id, dd_source, dd_order_id, dd_scheduled_for, cancellation_reason, table_id, tables(table_number), order_items(id, quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, extra_name, product_extras(name)))`)
      .eq("id", order.id)
      .single();
    if (!error && data) {
      setOrder(data as unknown as Order);
    }
  }, [order.id]);

  useEffect(() => {
    const ch = supabase.channel(`order-detail-${order.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${order.id}` }, () => {
        refreshOrder();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${order.id}` }, () => {
        refreshOrder();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [order.id, refreshOrder]);

  const getElapsedTime = () => {
    const elapsed = Date.now() - new Date(order.created_at).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 5) return { text: `${minutes} min`, color: "text-green-600" };
    if (minutes < 15) return { text: `${minutes} min`, color: "text-yellow-600" };
    return { text: `${minutes} min`, color: "text-red-600" };
  };

  const elapsedTime = getElapsedTime();

  const calculateTotal = () => {
    return (order.order_items || []).reduce((total, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = (item.order_item_extras || []).reduce((sum, extra) => sum + extra.price_at_order, 0) * item.quantity;
      return total + itemTotal + extrasTotal;
    }, 0);
  };

  const requiresPaymentForFinalization = (newStatus: string) => {
    if (order.ifood_source && order.payment_type === "Pago pelo iFood") return false;
    if (order.dd_source && order.payment_type === "Pago Delivery Direto") return false;
    const isLocal = order.order_type === "local" || (!order.order_type && order.table_id);
    if (isLocal) return false;
    return ["delivered", "picked_up"].includes(newStatus);
  };

  const isTakeaway = order.order_type === "delivery" && order.delivery_type === "takeaway";
  const isBalcao = order.order_type === "balcao";

  const updateStatus = async (newStatus: string, reason?: string) => {
    if (requiresPaymentForFinalization(newStatus) && (!order.payment_type || order.payment_type === "pending")) {
      toast.error("Defina a forma de pagamento antes de finalizar o pedido");
      setShowPaymentModal(true);
      return;
    }

    const previousStatus = order.status;
    setOrder(prev => ({ ...prev, status: newStatus, ...(newStatus === "cancelled" && reason ? { cancellation_reason: reason } : {}) }));

    const success = await advanceStatus(order, newStatus, reason);
    if (success) {
      onStatusUpdate();
      onClose();
    } else {
      setOrder(prev => ({ ...prev, status: previousStatus }));
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    setCancelling(true);
    await updateStatus("cancelled", cancelReason.trim());
    setCancelling(false);
    setShowCancelDialog(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if ((order.order_items || []).length <= 1) {
      toast.error("Não é possível remover o último item. Cancele o pedido se necessário.");
      return;
    }
    setRemovingItemId(itemId);
    try {
      const { error } = await supabase.rpc("restore_stock_for_order_item", { p_order_item_id: itemId, p_restaurant_id: restaurantId });
      if (error) throw error;
      toast.success("Item removido e estoque restaurado!");
      await refreshOrder();
      onStatusUpdate();
    } catch (error: any) {
      console.error("Erro ao remover item:", error);
      toast.error("Erro ao remover item do pedido");
    } finally {
      setRemovingItemId(null);
    }
  };

  const { canManageOrders } = useStaffOrderPermissions();

  const handlePrint = async () => {
    try { await printOrder(order, restaurantId); } catch (error: any) { toast.error(error.message || "Erro ao imprimir"); }
  };

  const handlePrintKitchen = async () => {
    try { await printKitchenReceipt(order, restaurantId); } catch (error: any) { toast.error(error.message || "Erro ao imprimir via da cozinha"); }
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

  const getOrderOrigin = () => getOrderOriginLabel(order as any);

  const isFinalized = ["delivered", "picked_up", "completed"].includes(order.status);
  const canAddItems = !isFinalized && order.status !== "cancelled";
  const canRemoveItems = ["pending", "accepted", "preparing", "ready", "out_for_delivery"].includes(order.status);

  const handleAddItems = () => { setShowAddItems(true); };

  const handleChangePaymentConfirm = async () => {
    setShowChangePaymentModal(false);
    await refreshOrder();
    onStatusUpdate();
    toast.success("Forma de pagamento atualizada!");
  };

  const grandTotal = calculateTotal() + (order.delivery_fee ?? 0) - (order.coupon_discount ?? 0) - (order.loyalty_points_used ?? 0);
  const needsPayment = (!order.payment_type || order.payment_type === "pending") && !(order.ifood_source && order.payment_type === "Pago pelo iFood");

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogDescription className="sr-only">Detalhes do pedido</DialogDescription>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl">Pedido #{order.id.slice(0, 8)}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`border-transparent ${elapsedTime.color} bg-primary-foreground`}><Clock className="w-3 h-3 mr-1" />Tempo: {elapsedTime.text}</Badge>
                <Badge variant="secondary">{getStatusLabel(order.status)}</Badge>
                {order.dd_source && <Badge className="bg-[#0066CC] text-primary-foreground border-0">Delivery Direto</Badge>}
                {order.dd_scheduled_for && (
                  <Badge className="bg-amber-500 text-primary-foreground border-0 gap-1">
                    <CalendarClock className="w-3 h-3" />
                    Agendado {format(new Date(order.dd_scheduled_for), "dd/MM HH:mm")}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Resumo compacto — sempre visível */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>Origem: <strong className="text-foreground">{getOrderOrigin()}</strong></span>
            <span>Total: <strong className="text-foreground text-base">R$ {grandTotal.toFixed(2)}</strong></span>
            {order.payment_type && order.payment_type !== "pending" && (
              <span>Pgto: <strong className="text-foreground">{formatPaymentForDisplay(order.payment_type, order.payment_brand)}</strong></span>
            )}
            {needsPayment && <Badge variant="destructive" className="text-xs">Falta pagamento</Badge>}
          </div>

          <Separator />

          {/* Ações do Pedido — sempre visível */}
          <div className="flex flex-wrap gap-2">
            {order.status === "pending" && canManageOrders && (
              <Button onClick={() => updateStatus("accepted")} className="gap-2"><Play className="w-4 h-4" />Iniciar Preparo</Button>
            )}
            {(order.status === "accepted" || order.status === "preparing") && order.order_type === "delivery" && order.delivery_type === "delivery" && (
              <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2"><Play className="w-4 h-4" />Saiu para Entrega</Button>
            )}
            {(order.status === "accepted" || order.status === "preparing") && order.order_type === "delivery" && order.delivery_type === "pickup" && (
              <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2"><Play className="w-4 h-4" />Pronto para Retirada</Button>
            )}
            {(order.status === "accepted" || order.status === "preparing") && isBalcao && (
              <Button onClick={() => updateStatus("ready")} className="gap-2"><Play className="w-4 h-4" />Pronto para Retirada</Button>
            )}
            {(order.status === "ready") && isBalcao && (
              <Button onClick={() => updateStatus("picked_up")} className="gap-2"><Play className="w-4 h-4" />Retirado</Button>
            )}
            {(order.status === "accepted" || order.status === "preparing") && isTakeaway && (
              <Button onClick={() => updateStatus("picked_up")} className="gap-2"><Play className="w-4 h-4" />Finalizar (Retirado)</Button>
            )}
            {(order.status === "accepted" || order.status === "preparing") && (order.order_type === "local" || (!order.order_type && order.table_id)) && (
              <Button onClick={() => updateStatus("delivered")} className="gap-2"><Play className="w-4 h-4" />Na Mesa</Button>
            )}
            {order.status === "delivered" && (order.order_type === "local" || (!order.order_type && order.table_id)) && (
              <Button 
                onClick={() => {
                  const isIfoodPaid = order.ifood_source && order.payment_type === "Pago pelo iFood";
                  if (!isIfoodPaid && (!order.payment_type || order.payment_type === "pending")) {
                    toast.error("Defina a forma de pagamento antes de finalizar");
                    setShowPaymentModal(true);
                    return;
                  }
                  toast.success("Pedido finalizado!");
                  onStatusUpdate();
                  onClose();
                }} 
                className="gap-2"
                variant={(!order.payment_type || order.payment_type === "pending") && !(order.ifood_source && order.payment_type === "Pago pelo iFood") ? "outline" : "default"}
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
            
            {!isFinalized && order.status !== "cancelled" && canManageOrders && (
              <Button variant="destructive" onClick={() => setShowCancelDialog(true)} className="gap-2"><XCircle className="w-4 h-4" />Cancelar</Button>
            )}
            
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
          </div>

          <Separator />

          {/* Itens do Pedido — colapsável, aberta por padrão */}
          <Collapsible open={itemsOpen} onOpenChange={setItemsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
              <span className="font-semibold text-base">Itens do Pedido ({order.order_items.length})</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${itemsOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead>Complementos</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      {canRemoveItems && <TableHead></TableHead>}
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
                              <div className="text-xs space-y-1">{item.order_item_extras.map((extra, idx) => (<div key={idx}>+ {extra.extra_name || extra.product_extras?.name || "Extra"} (R$ {extra.price_at_order.toFixed(2)})</div>))}</div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">R$ {itemSubtotal.toFixed(2)}</TableCell>
                          {canRemoveItems && (
                            <TableCell>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveItem(item.id)} disabled={removingItemId === item.id || order.order_items.length <= 1}>
                                {removingItemId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-4 space-y-1 text-right">
                  <p className="text-sm text-muted-foreground">Subtotal itens: R$ {calculateTotal().toFixed(2)}</p>
                  {order.delivery_type === "delivery" && (
                    <p className="text-sm text-muted-foreground">
                      Taxa de entrega: {(order.delivery_fee ?? 0) > 0 ? `R$ ${(order.delivery_fee ?? 0).toFixed(2)}` : "Grátis"}
                    </p>
                  )}
                  {order.delivery_type !== "delivery" && (order.delivery_fee ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground">Taxa de entrega: R$ {order.delivery_fee!.toFixed(2)}</p>
                  )}
                  {(order.coupon_discount ?? 0) > 0 && (
                    <p className="text-sm text-green-600">Desconto cupom: -R$ {order.coupon_discount!.toFixed(2)}</p>
                  )}
                  {(order.loyalty_points_used ?? 0) > 0 && (
                    <p className="text-sm text-green-600">Pontos fidelidade: -R$ {order.loyalty_points_used!.toFixed(2)}</p>
                  )}
                  <p className="text-xl font-bold">Total: R$ {grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Cliente — colapsável, fechada por padrão */}
          <Collapsible open={clienteOpen} onOpenChange={setClienteOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
              <span className="font-semibold text-base flex items-center gap-2"><User className="w-4 h-4" />Cliente</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${clienteOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 px-2">
                <div><p className="text-sm text-muted-foreground">Nome:</p><p className="font-medium">{order.customer_name}</p></div>
                {order.customer_cpf && <div><p className="text-sm text-muted-foreground">CPF:</p><p className="font-medium">{order.customer_cpf}</p></div>}
                {order.delivery_phone && (
                  <div><p className="text-sm text-muted-foreground">Telefone:</p><p className="font-medium flex items-center gap-2"><Phone className="w-4 h-4" />{order.delivery_phone}</p></div>
                )}
                {order.delivery_address && (
                  <div><p className="text-sm text-muted-foreground">Endereço:</p><p className="font-medium flex items-start gap-2"><MapPin className="w-4 h-4 mt-1" /><span>{order.delivery_address}</span></p></div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Detalhes — colapsável, fechada por padrão */}
          <Collapsible open={detalhesOpen} onOpenChange={setDetalhesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
              <span className="font-semibold text-base">Detalhes</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${detalhesOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 px-2">
                <div><p className="text-sm text-muted-foreground">Data/Hora:</p><p className="font-medium">{format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}</p></div>
                <div><p className="text-sm text-muted-foreground">Origem:</p><p className="font-medium">{getOrderOrigin()}</p></div>
                {order.dd_scheduled_for && (
                  <div>
                    <p className="text-sm text-muted-foreground">Agendado para:</p>
                    <p className="font-medium text-amber-600 flex items-center gap-1">
                      <CalendarClock className="w-4 h-4" />
                      {format(new Date(order.dd_scheduled_for), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                )}
                {order.table_id && (<div><p className="text-sm text-muted-foreground">Mesa:</p><p className="font-medium">{order.tables?.table_number}</p></div>)}
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento:</p>
                  <div className="flex items-center gap-2">
                    {order.payment_type && order.payment_type !== "pending" ? (
                      <>
                        <p className="font-medium">{formatPaymentForDisplay(order.payment_type, order.payment_brand)}</p>
                        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowChangePaymentModal(true)}>
                          <RefreshCw className="w-3 h-3" /> Alterar
                        </Button>
                      </>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Falta pagamento</Badge>
                    )}
                  </div>
                </div>
                {order.cancellation_reason && (
                  <div>
                    <p className="text-sm text-muted-foreground">Motivo cancelamento:</p>
                    <p className="font-medium text-destructive">{order.cancellation_reason}</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Pagamento pendente — colapsável, fechada por padrão */}
          {needsPayment && (
            <>
              <Separator />
              <Collapsible open={pagamentoOpen} onOpenChange={setPagamentoOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 transition-colors">
                  <span className="font-semibold text-base text-destructive">Pagamento Pendente</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${pagamentoOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 px-2">
                    <Button onClick={() => setShowPaymentModal(true)} className="w-full">Forma de Pagamento</Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Reason Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Pedido</DialogTitle>
            <DialogDescription>Informe o motivo do cancelamento. Este campo é obrigatório.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo do cancelamento..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelReason(""); }}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancelOrder} disabled={cancelling || !cancelReason.trim()}>
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showPaymentModal && (
        <PaymentConfirmationModal order={order} restaurantId={restaurantId} onClose={() => setShowPaymentModal(false)} onConfirm={() => { setShowPaymentModal(false); onStatusUpdate(); onClose(); }} />
      )}

      {showChangePaymentModal && (
        <PaymentConfirmationModal order={order} restaurantId={restaurantId} onClose={() => setShowChangePaymentModal(false)} onConfirm={handleChangePaymentConfirm} />
      )}

      <AddItemsToOrderDrawer
        open={showAddItems}
        onClose={() => setShowAddItems(false)}
        orderId={order.id}
        restaurantId={restaurantId}
        onItemsAdded={() => { setShowAddItems(false); refreshOrder(); onStatusUpdate(); }}
      />
    </>
  );
};
