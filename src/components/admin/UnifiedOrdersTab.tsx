import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarIcon, Search, Truck, ShoppingBag, UtensilsCrossed, Package,
  Clock, Printer, Check, XCircle, AlertTriangle, CreditCard, Banknote, Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDetailModal } from "./OrderDetailModal";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { printOrder } from "@/lib/printOrder";

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

interface UnifiedOrdersTabProps {
  restaurantId: string;
  pendingOrderToOpen: string | null;
  onOrderOpened: () => void;
}

const PAYMENT_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  "Dinheiro": { icon: <Banknote className="w-3 h-3" />, label: "Dinheiro" },
  "PIX": { icon: <Smartphone className="w-3 h-3" />, label: "PIX" },
  "Cartão de Crédito": { icon: <CreditCard className="w-3 h-3" />, label: "Crédito" },
  "Cartão de Débito": { icon: <CreditCard className="w-3 h-3" />, label: "Débito" },
  "credit": { icon: <CreditCard className="w-3 h-3" />, label: "Crédito" },
  "debit": { icon: <CreditCard className="w-3 h-3" />, label: "Débito" },
  "cash": { icon: <Banknote className="w-3 h-3" />, label: "Dinheiro" },
  "pix": { icon: <Smartphone className="w-3 h-3" />, label: "PIX" },
  "online": { icon: <Smartphone className="w-3 h-3" />, label: "Pago Online" },
};

const UnifiedOrdersTab = ({ restaurantId, pendingOrderToOpen, onOrderOpened }: UnifiedOrdersTabProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [dateRange, setDateRange] = useState(() => ({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  }));

  useEffect(() => {
    fetchOrders();
    const cleanup = setupRealtime();
    return cleanup;
  }, [restaurantId, dateRange]);

  useEffect(() => {
    if (pendingOrderToOpen && orders.length > 0) {
      const o = orders.find(o => o.id === pendingOrderToOpen);
      if (o) {
        setSelectedOrder(o);
        onOrderOpened();
      }
    }
  }, [pendingOrderToOpen, orders]);

  useEffect(() => {
    supabase.from('printer_settings').select('auto_print_orders').eq('restaurant_id', restaurantId).maybeSingle()
      .then(({ data }) => { if (data) setAutoPrint(data.auto_print_orders); });
  }, [restaurantId]);

  const setupRealtime = () => {
    const ch = supabase.channel(`unified-orders-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`id, status, created_at, customer_name, customer_cpf, delivery_type, order_type, delivery_address, delivery_phone, notes, payment_type, table_id, tables(table_number), order_items(id, quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("restaurant_id", restaurantId)
      .neq("order_type", "local")
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .order("created_at", { ascending: false });
    if (!error) setOrders(data || []);
    setLoading(false);
  };

  const calculateTotal = (order: Order) => {
    return order.order_items.reduce((total, item) => {
      const extrasTotal = item.order_item_extras.reduce((s, e) => s + e.price_at_order, 0) * item.quantity;
      return total + item.price_at_order * item.quantity + extrasTotal;
    }, 0);
  };

  const getElapsedMinutes = (createdAt: string) => Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  const getElapsedColor = (m: number) => m < 5 ? "text-green-600 bg-green-50 border-green-200" : m < 15 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-red-600 bg-red-50 border-red-200";

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (activeTab === "delivery") {
      filtered = filtered.filter(o => o.order_type === "delivery" && o.delivery_type === "delivery");
    } else if (activeTab === "retirada") {
      filtered = filtered.filter(o => o.order_type === "delivery" && (o.delivery_type === "pickup" || o.delivery_type === "takeaway"));
    }
    // "todos" shows everything

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(o =>
        o.customer_name.toLowerCase().includes(q) ||
        o.customer_cpf.includes(q) ||
        o.delivery_phone?.includes(q) ||
        o.id.slice(0, 8).includes(q)
      );
    }

    return filtered;
  }, [orders, activeTab, searchQuery]);

  const groupedOrders = useMemo(() => {
    return {
      pending: filteredOrders.filter(o => o.status === "pending"),
      preparing: filteredOrders.filter(o => ["accepted", "preparing"].includes(o.status)),
      out: filteredOrders.filter(o => ["out_for_delivery", "ready"].includes(o.status)),
      delivered: filteredOrders.filter(o => ["delivered", "picked_up"].includes(o.status)),
      cancelled: filteredOrders.filter(o => o.status === "cancelled"),
    };
  }, [filteredOrders]);

  const getOrderTypeIcon = (order: Order) => {
    if (order.order_type === "local") return <UtensilsCrossed className="w-3.5 h-3.5" />;
    if (order.delivery_type === "delivery") return <Truck className="w-3.5 h-3.5" />;
    if (order.delivery_type === "takeaway") return <Package className="w-3.5 h-3.5" />;
    return <ShoppingBag className="w-3.5 h-3.5" />;
  };

  const getOrderTypeLabel = (order: Order) => {
    if (order.order_type === "local") return `Mesa ${order.tables?.table_number || "?"}`;
    if (order.delivery_type === "delivery") return "Entrega";
    if (order.delivery_type === "takeaway") return "Para Viagem";
    return "Retirada";
  };

  const getPaymentDisplay = (paymentType?: string) => {
    if (!paymentType || paymentType === "pending") {
      return { label: "Falta pagamento", className: "text-red-600 bg-red-50 dark:bg-red-950/30", icon: <AlertTriangle className="w-3 h-3" /> };
    }
    const info = PAYMENT_LABELS[paymentType];
    if (info) {
      return { label: info.label, className: "text-green-700 bg-green-50 dark:bg-green-950/30", icon: info.icon };
    }
    return { label: paymentType, className: "text-green-700 bg-green-50 dark:bg-green-950/30", icon: <CreditCard className="w-3 h-3" /> };
  };

  const kanbanColumns = [
    { key: "pending", title: "Aguardando", color: "bg-orange-400", count: groupedOrders.pending.length },
    { key: "preparing", title: "Preparando", color: "bg-orange-500", count: groupedOrders.preparing.length },
    { key: "out", title: "Saiu / Pronto", color: "bg-orange-600", count: groupedOrders.out.length },
    { key: "delivered", title: "Entregue / Retirado", color: "bg-orange-700", count: groupedOrders.delivered.length },
    { key: "cancelled", title: "Cancelado", color: "bg-orange-300", count: groupedOrders.cancelled.length },
  ];

  const renderOrderCard = (order: Order) => {
    const total = calculateTotal(order);
    const elapsed = getElapsedMinutes(order.created_at);
    const payment = getPaymentDisplay(order.payment_type);
    return (
      <Card
        key={order.id}
        className="cursor-pointer bg-card hover:shadow-md transition-all border border-border/50 hover:border-border"
        onClick={() => setSelectedOrder(order)}
      >
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${getElapsedColor(elapsed)}`}>
              {elapsed}min
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {getOrderTypeIcon(order)}
            <span className="text-xs font-medium">{getOrderTypeLabel(order)}</span>
          </div>
          <p className="text-sm font-semibold truncate">{order.customer_name}</p>
          <div className="text-xs text-muted-foreground">
            {order.order_items.slice(0, 2).map((item, i) => (
              <p key={i}>{item.quantity}x {item.products?.name || "Produto"}</p>
            ))}
            {order.order_items.length > 2 && <p>+{order.order_items.length - 2} itens</p>}
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${payment.className}`}>
            {payment.icon}
            <span>{payment.label}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.created_at), "HH:mm")}
            </span>
            <span className="font-bold text-sm">R$ {total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {kanbanColumns.map(({ key, title, color, count }) => {
        const colOrders = groupedOrders[key as keyof typeof groupedOrders] || [];
        return (
          <div key={key} className="min-w-[260px] flex-shrink-0 flex flex-col">
            <div className={`${color} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}>
              <span className="font-semibold text-sm">{title}</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">{count}</Badge>
            </div>
            <div className="bg-muted/30 border border-t-0 border-border/50 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[60vh] overflow-y-auto flex-1">
              {colOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum pedido</p>
              ) : (
                colOrders.map(renderOrderCard)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Carregando pedidos...</div>;
  }

  const totalPendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pedidos</h2>
          <p className="text-sm text-muted-foreground">{totalPendingCount} aguardando • {orders.length} no total</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="auto-print" className="text-xs">Impressão automática</Label>
            <Switch id="auto-print" checked={autoPrint} onCheckedChange={async (v) => {
              setAutoPrint(v);
              await supabase.from('printer_settings').upsert({ restaurant_id: restaurantId, auto_print_orders: v }, { onConflict: 'restaurant_id' });
            }} />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: startOfDay(range.from), to: endOfDay(range.to) });
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, CPF ou código..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="retirada">Retirada</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">{renderKanban()}</TabsContent>
        <TabsContent value="delivery">{renderKanban()}</TabsContent>
        <TabsContent value="retirada">{renderKanban()}</TabsContent>
      </Tabs>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          restaurantId={restaurantId}
          onClose={() => setSelectedOrder(null)}
          onStatusUpdate={fetchOrders}
        />
      )}
    </div>
  );
};

export default UnifiedOrdersTab;
