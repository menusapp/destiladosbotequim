import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, CreditCard, User, Package, FileText, Store, Truck, Monitor } from "lucide-react";
import { format } from "date-fns";
import { formatPaymentMethod } from "@/lib/utils";

interface CashMovement {
  id: string;
  movement_type: string;
  amount: number;
  description: string;
  category: string | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
  bill_id: string | null;
}

interface OrderDetail {
  id: string;
  customer_name: string;
  customer_cpf: string | null;
  order_type: string;
  delivery_type: string | null;
  delivery_address: string | null;
  payment_method: string | null;
  payment_type: string | null;
  payment_brand: string | null;
  notes: string | null;
  delivery_fee: number | null;
  coupon_discount: number | null;
  loyalty_points_used: number | null;
  created_at: string;
  table_id: string | null;
  status: string;
  order_items: {
    id: string;
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: { name: string } | null;
    order_item_extras: {
      extra_name: string | null;
      price_at_order: number;
      product_extras: { name: string; extra_categories: { name: string } | null } | null;
    }[];
  }[];
  tables?: { table_number: number; table_name: string | null } | null;
}

interface CounterOrderDetail {
  id: string;
  customer_name: string;
  customer_cpf: string | null;
  payment_method: string | null;
  notes: string | null;
  total_amount: number;
  subtotal: number;
  fee_amount: number | null;
  created_at: string;
  table_id: string;
  counter_order_items: {
    id: string;
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: { name: string } | null;
    counter_order_item_extras: {
      price_at_order: number;
      product_extras: { name: string; extra_categories: { name: string } | null } | null;
    }[];
  }[];
  tables?: { table_number: number; table_name: string | null } | null;
}

interface Props {
  movement: CashMovement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CashMovementDetailSheet({ movement, open, onOpenChange }: Props) {
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [counterDetail, setCounterDetail] = useState<CounterOrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !movement) {
      setOrderDetail(null);
      setCounterDetail(null);
      return;
    }

    if (movement.bill_id) {
      fetchBillDetails(movement.bill_id);
    }
  }, [open, movement]);

  const fetchBillDetails = async (billId: string) => {
    setLoading(true);
    try {
      // Try to find an order linked via the bill's comanda or table
      const { data: bill } = await supabase
        .from("bills")
        .select("*, tables(table_number, table_name), comanda_id")
        .eq("id", billId)
        .single();

      if (!bill) { setLoading(false); return; }

      // Try finding orders for this table that are linked to the bill's comanda
      if (bill.comanda_id) {
        const { data: orders } = await supabase
          .from("orders")
          .select(`*, order_items(*, products(name), order_item_extras(extra_name, price_at_order, product_extras(name, extra_categories(name)))), tables(table_number, table_name)`)
          .eq("comanda_id", bill.comanda_id)
          .limit(1)
          .maybeSingle();

        if (orders) {
          setOrderDetail(orders as any);
          setLoading(false);
          return;
        }
      }

      // Try finding counter_orders for this table around the bill's creation time
      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select(`*, counter_order_items(*, products(name), counter_order_item_extras(*, product_extras(name))), tables(table_number, table_name)`)
        .eq("table_id", bill.table_id)
        .eq("status", "paid")
        .order("finalized_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (counterOrders) {
        setCounterDetail(counterOrders as any);
        setLoading(false);
        return;
      }

      // Fallback: try orders by table_id
      const { data: tableOrders } = await supabase
        .from("orders")
        .select(`*, order_items(*, products(name), order_item_extras(extra_name, price_at_order, product_extras(name))), tables(table_number, table_name)`)
        .eq("table_id", bill.table_id)
        .in("status", ["delivered", "picked_up", "accepted", "preparing", "ready"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tableOrders) {
        setOrderDetail(tableOrders as any);
      }
    } catch (err) {
      console.error("Error fetching bill details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getOriginLabel = (order: OrderDetail) => {
    if (order.order_type === "delivery") {
      return order.delivery_type === "pickup" ? "Retirada no Local" : "Delivery";
    }
    const tableName = order.tables?.table_name || `Mesa ${order.tables?.table_number || "?"}`;
    return `${tableName} via QR Code`;
  };

  const getOriginIcon = (order: OrderDetail) => {
    if (order.order_type === "delivery") return <Truck className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const renderOrderItems = (items: OrderDetail["order_items"]) => (
    <div className="space-y-2">
      {items.map((item) => {
        const itemTotal = item.price_at_order * item.quantity;
        const extras = item.order_item_extras || [];
        const extrasTotal = extras.reduce((s, e) => s + e.price_at_order, 0) * item.quantity;
        return (
          <div key={item.id} className="p-2.5 rounded-lg bg-muted/30 border">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.quantity}x {item.products?.name || "Produto"}</span>
              <span className="font-medium">R$ {(itemTotal + extrasTotal).toFixed(2)}</span>
            </div>
            {extras.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {extras.map((e, i) => (
                   <p key={i} className="text-xs text-muted-foreground pl-4">
                    + {e.extra_name || e.product_extras?.name || "Extra"} (R$ {e.price_at_order.toFixed(2)})
                  </p>
                ))}
              </div>
            )}
            {item.notes && <p className="text-xs text-muted-foreground mt-1 italic pl-4">Obs: {item.notes}</p>}
          </div>
        );
      })}
    </div>
  );

  const renderCounterItems = (items: CounterOrderDetail["counter_order_items"]) => (
    <div className="space-y-2">
      {items.map((item) => {
        const itemTotal = item.price_at_order * item.quantity;
        const extras = item.counter_order_item_extras || [];
        const extrasTotal = extras.reduce((s, e) => s + e.price_at_order, 0) * item.quantity;
        return (
          <div key={item.id} className="p-2.5 rounded-lg bg-muted/30 border">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{item.quantity}x {item.products?.name || "Produto"}</span>
              <span className="font-medium">R$ {(itemTotal + extrasTotal).toFixed(2)}</span>
            </div>
            {extras.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {extras.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-4">
                    + {e.product_extras?.name || "Extra"} (R$ {e.price_at_order.toFixed(2)})
                  </p>
                ))}
              </div>
            )}
            {item.notes && <p className="text-xs text-muted-foreground mt-1 italic pl-4">Obs: {item.notes}</p>}
          </div>
        );
      })}
    </div>
  );

  const renderManualMovement = () => {
    if (!movement) return null;
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Responsavel:</span>
            <span className="font-medium">{movement.created_by}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Descricao:</span>
            <span className="font-medium">{movement.description}</span>
          </div>
          {movement.category && (
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Categoria:</span>
              <span className="font-medium">{movement.category}</span>
            </div>
          )}
          {movement.payment_method && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pagamento:</span>
              <span className="font-medium">{formatPaymentMethod(movement.payment_method)}</span>
            </div>
          )}
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Valor</span>
          <span className={`text-xl font-bold ${movement.movement_type === "entrada" ? "text-emerald-600" : "text-destructive"}`}>
            {movement.movement_type === "entrada" ? "+" : "-"}R$ {movement.amount.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  const renderOrderDetail = () => {
    if (!orderDetail) return null;
    const subtotal = orderDetail.order_items.reduce((s, item) => {
      const extras = (item.order_item_extras || []).reduce((es, e) => es + e.price_at_order, 0);
      return s + (item.price_at_order + extras) * item.quantity;
    }, 0);
    const deliveryFee = orderDetail.delivery_fee || 0;
    const discount = (orderDetail.coupon_discount || 0) + (orderDetail.loyalty_points_used || 0);
    const total = subtotal + deliveryFee - discount;

    return (
      <div className="space-y-4 pt-2">
        {/* Cliente */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{orderDetail.customer_name}</span>
            {orderDetail.customer_cpf && <span className="text-xs text-muted-foreground">({orderDetail.customer_cpf})</span>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {getOriginIcon(orderDetail)}
            <Badge variant="secondary" className="text-xs">{getOriginLabel(orderDetail)}</Badge>
          </div>
          {orderDetail.delivery_address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-muted-foreground">{orderDetail.delivery_address}</span>
            </div>
          )}
          {(orderDetail.payment_method || orderDetail.payment_type) && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {formatPaymentMethod(orderDetail.payment_method || orderDetail.payment_type)}
                {orderDetail.payment_brand && ` - ${orderDetail.payment_brand}`}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Items */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" /> Produtos
          </h4>
          {renderOrderItems(orderDetail.order_items)}
        </div>

        {orderDetail.notes && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="text-muted-foreground font-medium mb-1">Observacoes:</p>
              <p className="italic">{orderDetail.notes}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {subtotal.toFixed(2)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa de entrega</span><span>R$ {deliveryFee.toFixed(2)}</span></div>}
          {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Desconto</span><span>-R$ {discount.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-1 border-t">
            <span>Total</span><span>R$ {total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCounterDetail = () => {
    if (!counterDetail) return null;
    const tableName = counterDetail.tables?.table_name || `Mesa ${counterDetail.tables?.table_number || "?"}`;

    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{counterDetail.customer_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4 text-muted-foreground" />
            <Badge variant="secondary" className="text-xs">Balcao PDV - {tableName}</Badge>
          </div>
          {counterDetail.payment_method && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{formatPaymentMethod(counterDetail.payment_method)}</span>
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Package className="h-4 w-4" /> Produtos
          </h4>
          {renderCounterItems(counterDetail.counter_order_items)}
        </div>

        {counterDetail.notes && (
          <>
            <Separator />
            <div className="text-sm">
              <p className="text-muted-foreground font-medium mb-1">Observacoes:</p>
              <p className="italic">{counterDetail.notes}</p>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R$ {counterDetail.subtotal.toFixed(2)}</span></div>
          {(counterDetail.fee_amount || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa</span><span>R$ {(counterDetail.fee_amount || 0).toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-base pt-1 border-t">
            <span>Total</span><span>R$ {counterDetail.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  const hasBillDetail = movement?.bill_id;
  const title = hasBillDetail
    ? (orderDetail ? "Espelho do Pedido" : counterDetail ? "Espelho do Pedido (PDV)" : "Detalhes da Movimentacao")
    : "Detalhes da Movimentacao";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {movement && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(movement.created_at), "dd/MM/yyyy 'as' HH:mm")}
            </p>
          )}
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : hasBillDetail ? (
            orderDetail ? renderOrderDetail() : counterDetail ? renderCounterDetail() : renderManualMovement()
          ) : (
            renderManualMovement()
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
