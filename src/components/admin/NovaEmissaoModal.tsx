import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, FileText, Loader2, MapPin, UtensilsCrossed, Truck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/sonner";

interface PendingOrder {
  id: string;
  customer_name: string;
  customer_cpf: string;
  created_at: string;
  order_type: string | null;
  delivery_type: string | null;
  delivery_address: string | null;
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
  // Delivery info state per order
  const [deliveryChecks, setDeliveryChecks] = useState<Record<string, boolean>>({});
  const [deliveryCpfs, setDeliveryCpfs] = useState<Record<string, string>>({});
  const [deliveryAddresses, setDeliveryAddresses] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
    };
  });
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    if (open) fetchPendingOrders();
  }, [open, dateRange, restaurantId]);

  const fetchPendingOrders = async () => {
    setLoading(true);
    try {
      const { data: existingNotes } = await supabase
        .from("order_fiscal_notes")
        .select("order_id")
        .eq("restaurant_id", restaurantId)
        .in("status", ["authorized", "pending", "processing"]);

      const excludedOrderIds = (existingNotes || []).map(n => n.order_id);

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, customer_name, customer_cpf, created_at, order_type, delivery_type, delivery_address, table_id,
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

      if (error) throw error;

      const filtered = (data || []).filter(
        (o: any) => !excludedOrderIds.includes(o.id)
      );

      setOrders(filtered as any);

      // Auto-check delivery orders
      const checks: Record<string, boolean> = {};
      const cpfs: Record<string, string> = {};
      const addrs: Record<string, string> = {};
      for (const o of filtered as any[]) {
        const isDelivery = o.delivery_type === "delivery";
        checks[o.id] = isDelivery;
        cpfs[o.id] = o.customer_cpf || "";
        addrs[o.id] = o.delivery_address || "";
      }
      setDeliveryChecks(checks);
      setDeliveryCpfs(cpfs);
      setDeliveryAddresses(addrs);
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
    const isDelivery = deliveryChecks[orderId];
    const cpf = deliveryCpfs[orderId]?.replace(/\D/g, "") || "";
    const address = deliveryAddresses[orderId] || "";

    // If marked as delivery, CPF is mandatory
    if (isDelivery && (!cpf || cpf.length !== 11)) {
      toast.error("Para nota de entrega, o CPF do cliente é obrigatório e deve ter 11 dígitos.");
      return;
    }

    setEmitting(prev => new Set(prev).add(orderId));
    try {
      const insertData: any = {
        restaurant_id: restaurantId,
        order_id: orderId,
        status: "pending",
      };

      const { data: noteData, error } = await supabase
        .from("order_fiscal_notes")
        .insert(insertData)
        .select("id")
        .single();
      if (error) throw error;

      // Call nuvem-fiscal-emit edge function
      toast.info("Enviando nota para emissão...");
      const { data: emitResult, error: emitError } = await supabase.functions.invoke("nuvem-fiscal-emit", {
        body: {
          order_id: orderId,
          restaurant_id: restaurantId,
          fiscal_note_id: noteData.id,
        },
      });

      if (emitError) {
        console.error("Erro na edge function:", emitError);
        toast.error("Nota criada mas houve erro na emissão. Tente retentar na lista.");
      } else if (emitResult?.error) {
        toast.error(`Erro na emissão: ${emitResult.error}`);
      } else {
        toast.success("Nota fiscal enviada para emissão com sucesso!");
      }

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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
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
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
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
                    setDatePopoverOpen(false);
                  }
                }}
                locale={ptBR}
                className="pointer-events-auto"
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
          <div className="space-y-3">
            {orders.map((order) => {
              const isDeliveryOrder = order.delivery_type === "delivery";
              const isChecked = deliveryChecks[order.id] || false;
              return (
                <div key={order.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getOriginBadge(order)}
                      <span className="font-mono text-sm">#{order.id.slice(0, 8)}</span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <span className="font-bold">R$ {calculateOrderTotal(order).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{order.customer_name || "—"}</span>
                  </div>

                  {/* Delivery checkbox */}
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <Checkbox
                      id={`delivery-${order.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setDeliveryChecks(prev => ({ ...prev, [order.id]: !!checked }));
                      }}
                    />
                    <Label htmlFor={`delivery-${order.id}`} className="text-sm flex items-center gap-1.5 cursor-pointer">
                      <Truck className="w-3.5 h-3.5" />
                      Este pedido é de entrega (CPF e endereço obrigatórios)
                    </Label>
                  </div>

                  {isChecked && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs">CPF do Cliente *</Label>
                        <Input
                          value={deliveryCpfs[order.id] || ""}
                          onChange={(e) => setDeliveryCpfs(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="000.000.000-00"
                          className="h-8 text-sm"
                        />
                        {(!deliveryCpfs[order.id] || deliveryCpfs[order.id].replace(/\D/g, "").length !== 11) && (
                          <p className="text-xs text-destructive">CPF é obrigatório para entrega. Desmarque se não tiver.</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Endereço</Label>
                        <Input
                          value={deliveryAddresses[order.id] || ""}
                          onChange={(e) => setDeliveryAddresses(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Endereço de entrega"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NovaEmissaoModal;