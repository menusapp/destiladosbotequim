import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, MapPin, UtensilsCrossed, Truck, Building2 } from "lucide-react";
import { format } from "date-fns";
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

interface PendingOrdersPanelProps {
  restaurantId: string;
  dateRange: { from: Date; to: Date };
  onEmitted: () => void;
  searchTerm?: string;
}

const PendingOrdersPanel = ({ restaurantId, dateRange, onEmitted, searchTerm = "" }: PendingOrdersPanelProps) => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState<Set<string>>(new Set());
  const [deliveryChecks, setDeliveryChecks] = useState<Record<string, boolean>>({});
  const [deliveryCpfs, setDeliveryCpfs] = useState<Record<string, string>>({});
  const [deliveryAddresses, setDeliveryAddresses] = useState<Record<string, string>>({});
  const [companyChecks, setCompanyChecks] = useState<Record<string, boolean>>({});
  const [companyCnpjs, setCompanyCnpjs] = useState<Record<string, string>>({});
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPendingOrders();
  }, [dateRange, restaurantId]);

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
    const isCompany = companyChecks[orderId];
    const cnpj = companyCnpjs[orderId]?.replace(/\D/g, "") || "";
    const companyName = companyNames[orderId] || "";

    if (isDelivery && (!cpf || cpf.length !== 11)) {
      toast.error("Para nota de entrega, o CPF do cliente é obrigatório e deve ter 11 dígitos.");
      return;
    }

    if (isCompany && (!cnpj || cnpj.length !== 14)) {
      toast.error("Para nota empresarial, o CNPJ deve ter 14 dígitos.");
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

      toast.info("Enviando nota para emissão...");
      const emitBody: any = {
        order_id: orderId,
        restaurant_id: restaurantId,
        fiscal_note_id: noteData.id,
      };
      if (isCompany && cnpj) {
        emitBody.customer_cnpj = cnpj;
        emitBody.customer_razao_social = companyName || "EMPRESA";
      }
      const { data: emitResult, error: emitError } = await supabase.functions.invoke("nuvem-fiscal-emit", {
        body: emitBody,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando pedidos...</span>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">Nenhum pedido pendente</p>
        <p className="text-xs">Todos os pedidos já possuem nota</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const isChecked = deliveryChecks[order.id] || false;
        return (
          <div key={order.id} className="border rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {getOriginBadge(order)}
                <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(order.created_at), "dd/MM HH:mm")}
                </span>
              </div>
              <span className="font-bold text-sm">R$ {calculateOrderTotal(order).toFixed(2)}</span>
            </div>
            <div className="text-sm text-muted-foreground">{order.customer_name || "—"}</div>

            {/* Delivery checkbox */}
            <div className="flex items-center gap-2 p-2 border rounded bg-muted/30">
              <Checkbox
                id={`del-${order.id}`}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  setDeliveryChecks(prev => ({ ...prev, [order.id]: !!checked }));
                }}
              />
              <Label htmlFor={`del-${order.id}`} className="text-xs flex items-center gap-1 cursor-pointer">
                <Truck className="w-3 h-3" />
                Entrega (CPF e endereço)
              </Label>
            </div>

            {isChecked && (
              <div className="grid grid-cols-1 gap-2 pl-4">
                <div className="space-y-1">
                  <Label className="text-xs">CPF *</Label>
                  <Input
                    value={deliveryCpfs[order.id] || ""}
                    onChange={(e) => setDeliveryCpfs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="000.000.000-00"
                    className="h-7 text-xs"
                  />
                  {(!deliveryCpfs[order.id] || deliveryCpfs[order.id].replace(/\D/g, "").length !== 11) && (
                    <p className="text-xs text-destructive">CPF obrigatório para entrega.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Endereço</Label>
                  <Input
                    value={deliveryAddresses[order.id] || ""}
                    onChange={(e) => setDeliveryAddresses(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Endereço de entrega"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Company checkbox */}
            <div className="flex items-center gap-2 p-2 border rounded bg-muted/30">
              <Checkbox
                id={`co-${order.id}`}
                checked={companyChecks[order.id] || false}
                onCheckedChange={(checked) => {
                  setCompanyChecks(prev => ({ ...prev, [order.id]: !!checked }));
                }}
              />
              <Label htmlFor={`co-${order.id}`} className="text-xs flex items-center gap-1 cursor-pointer">
                <Building2 className="w-3 h-3" />
                Empresa (CNPJ)
              </Label>
            </div>

            {companyChecks[order.id] && (
              <div className="grid grid-cols-1 gap-2 pl-4">
                <div className="space-y-1">
                  <Label className="text-xs">CNPJ *</Label>
                  <Input
                    value={companyCnpjs[order.id] || ""}
                    onChange={(e) => setCompanyCnpjs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="00.000.000/0000-00"
                    className="h-7 text-xs"
                  />
                  {(!companyCnpjs[order.id] || companyCnpjs[order.id].replace(/\D/g, "").length !== 14) && (
                    <p className="text-xs text-destructive">CNPJ deve ter 14 dígitos.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <Input
                    value={companyNames[order.id] || ""}
                    onChange={(e) => setCompanyNames(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Nome da empresa"
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleEmit(order.id)}
                disabled={emitting.has(order.id)}
                className="gap-1 h-7 text-xs"
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
  );
};

export default PendingOrdersPanel;
