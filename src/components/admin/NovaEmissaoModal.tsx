import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, FileText, Loader2, MapPin, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface PendingOrder {
  id: string;
  customer_name: string;
  created_at: string;
  order_type: string | null;
  delivery_type: string | null;
  table_id: string | null;
  tables: { table_number: number } | null;
  order_items: {
    price_at_order: number;
    quantity: number;
    order_item_extras: { price_at_order: number }[];
  }[];
}

interface NovaEmissaoModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  onEmitted: () => void;
}

const NovaEmissaoModal = ({ open, onClose, restaurantId, onEmitted }: NovaEmissaoModalProps) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  });

  useEffect(() => {
    if (open) fetchPendingOrders();
  }, [open, dateRange, restaurantId]);

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      // Get orders that are completed/paid and don't have an active fiscal note
      const { data: existingNotes } = await supabase
        .from("order_fiscal_notes")
        .select("order_id")
        .eq("restaurant_id", restaurantId)
        .in("status", ["authorized", "pending", "processing"]);

      const excludedOrderIds = (existingNotes || []).map(n => n.order_id);

      let query = supabase
        .from("orders")
        .select(`
          id, customer_name, created_at, order_type, delivery_type, table_id,
          tables (table_number),
          order_items (
            price_at_order, quantity,
            order_item_extras (price_at_order)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .in("status", ["delivered", "picked_up"])
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter out orders that already have fiscal notes
      const filtered = (data || []).filter(
        (o: any) => !excludedOrderIds.includes(o.id)
      );

      setOrders(filtered as any);
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const calculateOrderTotal = (order: PendingOrder) => {
    return order.order_items.reduce((total, item) => {
      const extrasTotal = item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0;
      return total + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0);
  };

  const getOriginBadge = (order: PendingOrder) => {
    if (order.order_type === "local" || order.table_id) {
      return (
        <Badge variant="secondary" className="gap-1">
          <UtensilsCrossed className="w-3 h-3" />
          Mesa {order.tables?.table_number || "?"}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <MapPin className="w-3 h-3" />
        {order.delivery_type === "pickup" ? "Retirada" : "Delivery"}
      </Badge>
    );
  };

  const handleEmit = async (orderId: string) => {
    setEmitting(prev => new Set(prev).add(orderId));
    try {
      const { error } = await supabase
        .from("order_fiscal_notes")
        .insert({
          restaurant_id: restaurantId,
          order_id: orderId,
          status: "pending",
        });
      if (error) throw error;
      toast.success("Nota fiscal criada como pendente.");
      setOrders(prev => prev.filter(o => o.id !== orderId));
      onEmitted();
    } catch (err) {
      console.error("Erro ao criar nota fiscal:", err);
      toast.error("Erro ao criar nota fiscal");
    } finally {
      setEmitting(prev => { const s = new Set(prev); s.delete(orderId); return s; });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Nova Emissão de NFC-e
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pedidos concluídos aguardando emissão de nota fiscal
          </p>
        </DialogHeader>

        {/* Date Filter */}
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
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
          <span className="text-sm text-muted-foreground">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} sem nota
          </span>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Carregando pedidos...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum pedido pendente de emissão</p>
            <p className="text-sm">Todos os pedidos concluídos já possuem nota fiscal</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{getOriginBadge(order)}</TableCell>
                  <TableCell className="font-mono text-sm">#{order.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">{order.customer_name || "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    R$ {calculateOrderTotal(order).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      onClick={() => handleEmit(order.id)}
                      disabled={emitting.has(order.id)}
                      className="gap-1"
                    >
                      {emitting.has(order.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      Emitir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NovaEmissaoModal;
