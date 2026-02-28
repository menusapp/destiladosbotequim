import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Clock, 
  User, 
  Phone, 
  MapPin, 
  Printer, 
  MessageCircle, 
  XCircle, 
  Play,
  Plus,
  Home,
  Trash2,
  FileText,
  Download,
  FileCode
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PaymentConfirmationModal } from "./PaymentConfirmationModal";

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

interface OrderDetailModalProps {
  order: Order;
  restaurantId: string;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export const OrderDetailModal = ({
  order,
  restaurantId,
  onClose,
  onStatusUpdate,
}: OrderDetailModalProps) => {
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [fiscalNote, setFiscalNote] = useState<{ status: string; pdf_url?: string | null; xml_url?: string | null } | null>(null);
  const [emittingNote, setEmittingNote] = useState(false);

  // Check if fiscal note exists for this order
  useEffect(() => {
    const fetchFiscalNote = async () => {
      const { data } = await supabase
        .from("order_fiscal_notes")
        .select("status, pdf_url, xml_url")
        .eq("order_id", order.id)
        .maybeSingle();
      if (data) setFiscalNote(data);
    };
    fetchFiscalNote();
  }, [order.id]);

  const handleEmitNFCe = async () => {
    setEmittingNote(true);
    try {
      // Create pending fiscal note record (integration with API will come later)
      const { error } = await supabase
        .from("order_fiscal_notes")
        .insert({
          restaurant_id: restaurantId,
          order_id: order.id,
          status: "pending",
        });
      if (error) throw error;
      setFiscalNote({ status: "pending" });
      toast.success("Nota fiscal criada como pendente. A emissão será processada em breve.");
    } catch (err: any) {
      console.error("Erro ao criar nota fiscal:", err);
      toast.error("Erro ao criar nota fiscal");
    } finally {
      setEmittingNote(false);
    }
  };

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
      const extrasTotal = item.order_item_extras.reduce(
        (sum, extra) => sum + extra.price_at_order,
        0
      ) * item.quantity;
      return total + itemTotal + extrasTotal;
    }, 0);
  };

  // Função para enviar notificação WhatsApp automática
  const sendWhatsAppNotification = async (newStatus: string) => {
    try {
      // Só envia se tiver telefone do cliente
      if (!order.delivery_phone) {
        console.log('[WhatsApp][AUTO] Sem telefone para pedido', order.id);
        return;
      }

      // Buscar config do WhatsApp
      const { data: config, error: configError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (configError) {
        console.error('[WhatsApp][AUTO] Erro ao buscar config:', configError);
        return;
      }

      if (!config?.enabled) {
        console.log('[WhatsApp][AUTO] WhatsApp não habilitado para restaurante');
        return;
      }

      if (config?.instance_status !== 'connected') {
        console.log('[WhatsApp][AUTO] Instância não conectada:', config?.instance_status);
        return;
      }

      // Mapear status para template de mensagem
      // accepted/preparing -> message_accepted
      // out_for_delivery (delivery) -> message_out_for_delivery
      // out_for_delivery (pickup) / ready -> message_ready_for_pickup
      // delivered -> message_delivered
      // picked_up -> message_picked_up
      // cancelled -> message_cancelled
      let template: string | null = null;
      let messageType = '';

      if (newStatus === 'accepted' || newStatus === 'preparing') {
        template = config.message_accepted;
        messageType = 'accepted';
      } else if (newStatus === 'out_for_delivery') {
        // Se for pedido de retirada, usa o template de "pronto para retirada"
        if (order.delivery_type === 'pickup') {
          template = config.message_ready_for_pickup;
          messageType = 'ready_for_pickup';
        } else {
          template = config.message_out_for_delivery;
          messageType = 'out_for_delivery';
        }
      } else if (newStatus === 'ready') {
        template = config.message_ready_for_pickup;
        messageType = 'ready_for_pickup';
      } else if (newStatus === 'delivered') {
        template = config.message_delivered;
        messageType = 'delivered';
      } else if (newStatus === 'picked_up') {
        template = config.message_picked_up;
        messageType = 'picked_up';
      } else if (newStatus === 'cancelled') {
        template = config.message_cancelled;
        messageType = 'cancelled';
      }

      if (!template) {
        console.log('[WhatsApp][AUTO] Sem template para status:', newStatus);
        return;
      }

      // Buscar tempo estimado do restaurante
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('prep_time_minutes')
        .eq('id', restaurantId)
        .single();

      const tempoEstimado = restaurant?.prep_time_minutes?.toString() || '30';

      // Substituir variáveis do template
      const message = template
        .replace(/{nome}/g, order.customer_name || 'Cliente')
        .replace(/{pedido}/g, order.id.slice(0, 8))
        .replace(/{tempo}/g, tempoEstimado);

      console.log('[WhatsApp][AUTO] Enviando mensagem para pedido', order.id, 'status:', newStatus);
      console.log('[WhatsApp][AUTO] Telefone:', order.delivery_phone);
      console.log('[WhatsApp][AUTO] Mensagem:', message);

      // Chamar edge function
      const { data, error: sendError } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          restaurantId,
          phone: order.delivery_phone,
          message,
          orderId: order.id,
          messageType
        }
      });

      if (sendError) {
        console.error('[WhatsApp][AUTO] Erro ao enviar:', sendError);
      } else {
        console.log('[WhatsApp][AUTO] Mensagem enviada com sucesso!', data);
      }
    } catch (error) {
      console.error('[WhatsApp][AUTO] Erro geral:', error);
      // Não bloquear o fluxo se falhar o WhatsApp
    }
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.rpc("admin_update_order_status", {
        p_order_id: order.id,
        p_new_status: newStatus,
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      
      // Enviar notificação WhatsApp após sucesso (não bloqueia o fluxo)
      sendWhatsAppNotification(newStatus);
      
      // Disparar gatilho de marketing para campanhas automáticas
      if (newStatus === 'delivered' || newStatus === 'picked_up') {
        supabase.functions.invoke('marketing-trigger', {
          body: {
            orderId: order.id,
            restaurantId: restaurantId
          }
        }).then(({ error: triggerError }) => {
          if (triggerError) {
            console.error('[Marketing] Trigger error:', triggerError);
          } else {
            console.log('[Marketing] Trigger invoked for order', order.id);
          }
        });
      }
      
      toast.success("Status atualizado!");
      onStatusUpdate();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (order.delivery_phone) {
      const phone = order.delivery_phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    } else {
      toast.error("Telefone não informado");
    }
  };

  const handleGoToTable = () => {
    if (order.table_id) {
      navigate(`/admin/table/${order.table_id}`);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Aguardando confirmação",
      accepted: "Em preparo",
      preparing: "Preparando",
      ready: "Pronto para entrega",
      out_for_delivery: "Saiu para entrega",
      delivered: "Entregue",
      picked_up: "Retirado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getOrderOrigin = () => {
    if (order.order_type === "local") {
      return `Digital - Mesa ${order.tables?.table_number || "?"}`;
    }
    return order.delivery_type === "delivery" ? "Digital - Delivery" : "Digital - Retirada";
  };

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl">
                  Pedido #{order.id.slice(0, 8)}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={elapsedTime.color}>
                  <Clock className="w-3 h-3 mr-1" />
                  Tempo decorrido: {elapsedTime.text}
                </Badge>
                <Badge variant="secondary">{getStatusLabel(order.status)}</Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Ações do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {order.status === "pending" && (
                <Button onClick={() => updateStatus("accepted")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Iniciar Preparo
                </Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && 
                order.order_type === "delivery" && order.delivery_type === "delivery" && (
                <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Saiu para Entrega
                </Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && 
                order.order_type === "delivery" && order.delivery_type === "pickup" && (
                <Button onClick={() => updateStatus("out_for_delivery")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Pronto para Retirada
                </Button>
              )}
              {(order.status === "accepted" || order.status === "preparing") && 
                order.order_type === "local" && (
                <Button onClick={() => updateStatus("delivered")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Entregar na Mesa
                </Button>
              )}
              {order.status === "out_for_delivery" && order.delivery_type === "delivery" && (
                <Button onClick={() => updateStatus("delivered")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Confirmar Entrega
                </Button>
              )}
              {order.status === "out_for_delivery" && order.delivery_type === "pickup" && (
                <Button onClick={() => updateStatus("picked_up")} className="gap-2">
                  <Play className="w-4 h-4" />
                  Confirmar Retirada
                </Button>
              )}
              
              <Button variant="destructive" onClick={() => updateStatus("cancelled")} className="gap-2">
                <XCircle className="w-4 h-4" />
                Cancelar
              </Button>
              
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Itens
              </Button>

              {order.table_id && (
                <Button variant="outline" onClick={handleGoToTable} className="gap-2">
                  <Home className="w-4 h-4" />
                  Mesa {order.tables?.table_number}
                </Button>
              )}
              
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              
              {order.delivery_phone && (
                <Button variant="outline" onClick={handleWhatsApp} className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
              )}

              {/* NFC-e Buttons */}
              {["delivered", "picked_up"].includes(order.status) && !fiscalNote && (
                <Button variant="outline" onClick={handleEmitNFCe} disabled={emittingNote} className="gap-2">
                  <FileText className="w-4 h-4" />
                  {emittingNote ? "Emitindo..." : "Emitir NFC-e"}
                </Button>
              )}
              {fiscalNote && fiscalNote.status === "authorized" && fiscalNote.pdf_url && (
                <Button variant="outline" onClick={() => window.open(fiscalNote.pdf_url!, "_blank")} className="gap-2">
                  <Download className="w-4 h-4" />
                  Baixar Nota
                </Button>
              )}
              {fiscalNote && fiscalNote.status === "authorized" && fiscalNote.xml_url && (
                <Button variant="outline" onClick={() => window.open(fiscalNote.xml_url!, "_blank")} className="gap-2">
                  <FileCode className="w-4 h-4" />
                  Baixar XML
                </Button>
              )}
              {fiscalNote && fiscalNote.status === "pending" && (
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 self-center">
                  <Clock className="w-3 h-3 mr-1" /> NFC-e Pendente
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Itens do Pedido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Itens do Pedido</CardTitle>
            </CardHeader>
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
                    const extrasTotal = item.order_item_extras.reduce(
                      (sum, extra) => sum + extra.price_at_order,
                      0
                    );
                    const itemSubtotal = (item.price_at_order + extrasTotal) * item.quantity;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.products?.name || "Produto"}
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">Obs: {item.notes}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          R$ {item.price_at_order.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.order_item_extras.length > 0 ? (
                            <div className="text-xs space-y-1">
                              {item.order_item_extras.map((extra, idx) => (
                                <div key={idx}>
                                  + {extra.product_extras?.name} (R$ {extra.price_at_order.toFixed(2)})
                                </div>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {itemSubtotal.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-2 text-right">
                <p className="text-sm text-muted-foreground">
                  Total de itens: {order.order_items.reduce((sum, item) => sum + item.quantity, 0)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Subtotal: R$ {calculateTotal().toFixed(2)}
                </p>
                <p className="text-2xl font-bold text-red-600">
                  Total: R$ {calculateTotal().toFixed(2)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cliente e Detalhes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Nome:</p>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                {order.delivery_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone:</p>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {order.delivery_phone}
                    </p>
                  </div>
                )}
                {order.delivery_address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Endereço:</p>
                    <p className="font-medium flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-1" />
                      <span>{order.delivery_address}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora:</p>
                  <p className="font-medium">
                    {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Origem:</p>
                  <p className="font-medium">{getOrderOrigin()}</p>
                </div>
                {order.table_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Mesa:</p>
                    <p className="font-medium">{order.tables?.table_number}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Pagamento:</p>
                  <p className="font-medium">
                    {order.payment_type ? "Pago" : "Não informado"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pagamento */}
          {!order.payment_type && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowPaymentModal(true)} className="w-full">
                  Confirmar Pagamento
                </Button>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      {showPaymentModal && (
        <PaymentConfirmationModal
          order={order}
          restaurantId={restaurantId}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={() => {
            setShowPaymentModal(false);
            onStatusUpdate();
            onClose();
          }}
        />
      )}
    </>
  );
};
