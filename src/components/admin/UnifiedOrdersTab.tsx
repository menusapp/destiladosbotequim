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
  CalendarIcon, Search, Plus, Truck, ShoppingBag, UtensilsCrossed,
  Clock, Printer, Users, Check, XCircle, AlertTriangle, CreditCard, Banknote, Smartphone
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDetailModal } from "./OrderDetailModal";
import { CreateOrderDrawer } from "./CreateOrderDrawer";
import { TableOrdersDrawer } from "./TableOrdersDrawer";
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
}

interface Bill {
  id: string;
  status: string;
  subtotal: number;
  service_fee: number;
  total_amount: number;
  payment_method: string;
  change_amount: number | null;
  created_at: string;
  comanda_id: string | null;
  tables: { table_number: number };
  orders: {
    customer_name: string;
    customer_cpf: string;
    notes: string | null;
    order_items: {
      quantity: number;
      price_at_order: number;
      notes: string | null;
      products: { name: string } | null;
      order_item_extras: OrderItemExtra[];
    }[];
  }[];
}

interface TableData {
  id: string;
  table_number: number;
  table_name: string | null;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
  min_capacity: number;
  max_capacity: number;
  comandas?: { id: string; customer_name: string; customer_cpf: string }[];
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
  const [bills, setBills] = useState<Bill[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedTableForDrawer, setSelectedTableForDrawer] = useState<TableData | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [dateRange, setDateRange] = useState(() => ({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  }));
  const [billRequestEnabled, setBillRequestEnabled] = useState(true);

  useEffect(() => {
    fetchAll();
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
    supabase.from('restaurants').select('bill_request_enabled').eq('id', restaurantId).single()
      .then(({ data }) => { if (data) setBillRequestEnabled(data.bill_request_enabled ?? true); });
  }, [restaurantId]);

  const setupRealtime = () => {
    const ch1 = supabase.channel(`unified-orders-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOrders())
      .subscribe();
    const ch2 = supabase.channel(`unified-bills-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => fetchBills())
      .subscribe();
    const ch3 = supabase.channel(`unified-tables-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); };
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchOrders(), fetchBills(), fetchTables()]);
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`id, status, created_at, customer_name, customer_cpf, delivery_type, order_type, delivery_address, delivery_phone, notes, payment_type, table_id, tables(table_number), order_items(id, quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("restaurant_id", restaurantId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .order("created_at", { ascending: false });
    if (!error) setOrders(data || []);
  };

  const fetchBills = async () => {
    const { data: billsData } = await supabase
      .from("bills")
      .select(`*, tables!inner(table_number, restaurant_id)`)
      .eq("tables.restaurant_id", restaurantId)
      .gte("created_at", dateRange.from.toISOString())
      .lte("created_at", dateRange.to.toISOString())
      .order("created_at", { ascending: false });

    const withOrders = await Promise.all(
      (billsData || []).map(async (bill: any) => {
        let ordersData;
        if (bill.comanda_id) {
          const { data } = await supabase.from("orders")
            .select(`customer_name, customer_cpf, notes, order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
            .eq("comanda_id", bill.comanda_id);
          ordersData = data;
        } else {
          ordersData = [];
        }
        return { ...bill, orders: ordersData || [] };
      })
    );
    setBills(withOrders);
  };

  const fetchTables = async () => {
    const { data: tablesData } = await supabase
      .from("tables").select("*").eq("restaurant_id", restaurantId)
      .neq("table_number", 9999).order("display_order").order("table_number");

    const tableIds = (tablesData || []).map(t => t.id);
    let comandasData: any[] = [];
    if (tableIds.length > 0) {
      const { data } = await supabase.from("comandas")
        .select("id, table_id, customer_name, customer_cpf")
        .in("table_id", tableIds).eq("status", "active");
      comandasData = data || [];
    }

    setTables((tablesData || []).map(t => ({
      ...t,
      comandas: comandasData.filter(c => c.table_id === t.id),
    })));
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
      // Delivery tab includes delivery + pickup (retirada)
      filtered = filtered.filter(o => o.order_type === "delivery");
    } else if (activeTab === "local") {
      filtered = filtered.filter(o => o.order_type === "local" || !o.order_type);
    }

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

  const filteredBills = useMemo(() => {
    const activeBills = bills.filter(b => b.status === "requested" || b.status === "on_the_way");
    if (!searchQuery) return activeBills;
    const q = searchQuery.toLowerCase();
    return activeBills.filter(b =>
      b.tables.table_number.toString().includes(searchQuery) ||
      b.orders.some(o => o.customer_name.toLowerCase().includes(q))
    );
  }, [bills, searchQuery]);

  const groupedOrders = useMemo(() => {
    const isLocal = activeTab === "local";
    if (isLocal) {
      // Local: Aguardando, Preparando, Na Mesa (delivered without finalization distinction visually), Finalizado (delivered+payment), Cancelado
      const deliveredLocal = filteredOrders.filter(o => ["delivered", "picked_up"].includes(o.status));
      return {
        pending: filteredOrders.filter(o => o.status === "pending"),
        preparing: filteredOrders.filter(o => ["accepted", "preparing"].includes(o.status)),
        at_table: deliveredLocal.filter(o => !o.payment_type || o.payment_type === "pending"),
        finished: deliveredLocal.filter(o => o.payment_type && o.payment_type !== "pending"),
        cancelled: filteredOrders.filter(o => o.status === "cancelled"),
      };
    }
    // Delivery: Aguardando, Preparando, Saiu/Pronto, Entregue/Retirado, Cancelado
    return {
      pending: filteredOrders.filter(o => o.status === "pending"),
      preparing: filteredOrders.filter(o => ["accepted", "preparing"].includes(o.status)),
      out: filteredOrders.filter(o => ["out_for_delivery", "ready"].includes(o.status)),
      delivered: filteredOrders.filter(o => ["delivered", "picked_up"].includes(o.status)),
      cancelled: filteredOrders.filter(o => o.status === "cancelled"),
    };
  }, [filteredOrders, activeTab]);

  const getOrderTypeIcon = (order: Order) => {
    if (order.order_type === "local") return <UtensilsCrossed className="w-3.5 h-3.5" />;
    if (order.delivery_type === "delivery") return <Truck className="w-3.5 h-3.5" />;
    return <ShoppingBag className="w-3.5 h-3.5" />;
  };

  const getOrderTypeLabel = (order: Order) => {
    if (order.order_type === "local") return `Mesa ${order.tables?.table_number || "?"}`;
    if (order.delivery_type === "delivery") return "Entrega";
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

  const kanbanColumns = useMemo(() => {
    const isLocal = activeTab === "local";
    if (isLocal) {
      return [
        { key: "pending", title: "Aguardando", color: "bg-orange-400", count: groupedOrders.pending?.length || 0 },
        { key: "preparing", title: "Preparando", color: "bg-orange-500", count: groupedOrders.preparing?.length || 0 },
        { key: "at_table", title: "Na Mesa", color: "bg-orange-600", count: groupedOrders.at_table?.length || 0 },
        { key: "finished", title: "Finalizado", color: "bg-orange-700", count: groupedOrders.finished?.length || 0 },
        { key: "cancelled", title: "Cancelado", color: "bg-orange-300", count: groupedOrders.cancelled?.length || 0 },
      ];
    }
    return [
      { key: "pending", title: "Aguardando", color: "bg-orange-400", count: groupedOrders.pending?.length || 0 },
      { key: "preparing", title: "Preparando", color: "bg-orange-500", count: groupedOrders.preparing?.length || 0 },
      { key: "out", title: "Saiu / Pronto", color: "bg-orange-600", count: groupedOrders.out?.length || 0 },
      { key: "delivered", title: "Entregue / Retirado", color: "bg-orange-700", count: groupedOrders.delivered?.length || 0 },
      { key: "cancelled", title: "Cancelado", color: "bg-orange-300", count: groupedOrders.cancelled?.length || 0 },
    ];
  }, [activeTab, groupedOrders]);

  const handleToggleBillRequest = async (enabled: boolean) => {
    const { error } = await supabase.from("restaurants").update({ bill_request_enabled: enabled }).eq("id", restaurantId);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setBillRequestEnabled(enabled);
    toast.success(enabled ? "Conta pelo cardápio ativada" : "Conta pelo cardápio desativada");
  };

  const handleBillStatusChange = async (billId: string, newStatus: string) => {
    const { error } = await supabase.from("bills").update({ status: newStatus }).eq("id", billId);
    if (error) { toast.error("Erro ao atualizar conta"); return; }
    toast.success(newStatus === "on_the_way" ? "Conta a caminho!" : "Status atualizado");
    fetchBills();
  };

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
          {/* Payment method display */}
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

  const renderBillCard = (bill: Bill) => {
    const customerName = bill.orders?.[0]?.customer_name || "Cliente";
    return (
      <Card key={bill.id} className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">Mesa {bill.tables.table_number}</Badge>
            <Badge variant={bill.status === "requested" ? "destructive" : "secondary"} className="text-[10px]">
              {bill.status === "requested" ? "Solicitada" : "A caminho"}
            </Badge>
          </div>
          <p className="text-sm font-semibold truncate">{customerName}</p>
          <p className="font-bold text-sm">R$ {bill.total_amount.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{format(new Date(bill.created_at), "HH:mm")}</p>
          <div className="flex gap-1 pt-1">
            {bill.status === "requested" && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={(e) => { e.stopPropagation(); handleBillStatusChange(bill.id, "on_the_way"); }}>
                A caminho
              </Button>
            )}
            <p className="text-[9px] text-muted-foreground italic self-center">Pagar via PDV ou Mesas</p>
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
      {/* Bills column for Local tab */}
      {activeTab === "local" && billRequestEnabled && (
        <div className="min-w-[260px] flex-shrink-0 flex flex-col">
          <div className="bg-amber-500 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
            <span className="font-semibold text-sm">📋 Contas</span>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">{filteredBills.length}</Badge>
          </div>
          <div className="bg-amber-50/30 dark:bg-amber-950/10 border border-t-0 border-amber-200 dark:border-amber-800 rounded-b-lg p-2 space-y-2 min-h-[200px] max-h-[60vh] overflow-y-auto flex-1">
            {filteredBills.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conta solicitada</p>
            ) : (
              filteredBills.map(renderBillCard)
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderTablesGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {tables.map(table => {
        const isOccupied = table.is_occupied;
        const comandaCount = table.comandas?.length || 0;
        return (
          <Card
            key={table.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isOccupied ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border"
            }`}
            onClick={() => setSelectedTableForDrawer(table)}
          >
            <CardContent className="p-4 text-center space-y-1">
              <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center text-white text-sm font-bold ${
                isOccupied ? "bg-green-500" : "bg-muted-foreground/40"
              }`}>
                {table.table_number}
              </div>
              <p className="text-xs font-medium">{table.table_name || `Mesa ${table.table_number}`}</p>
              <Badge variant={isOccupied ? "default" : "secondary"} className="text-[10px]">
                {isOccupied ? `${comandaCount} comanda${comandaCount !== 1 ? "s" : ""}` : "Livre"}
              </Badge>
            </CardContent>
          </Card>
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
          <Button size="sm" onClick={() => setIsCreateDrawerOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Criar Pedido
          </Button>
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
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="retirada">Retirada</TabsTrigger>
          <TabsTrigger value="local">Local</TabsTrigger>
        </TabsList>

        <TabsContent value="todos">{renderKanban()}</TabsContent>
        <TabsContent value="delivery">{renderKanban()}</TabsContent>
        <TabsContent value="retirada">{renderKanban()}</TabsContent>
        <TabsContent value="local">
          {/* Toggle pedir conta - always visible in local tab */}
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg border border-border/50 bg-muted/20 w-fit">
            <Label htmlFor="bill-request-local" className="text-xs text-muted-foreground">Pedir conta pelo cardápio</Label>
            <Switch id="bill-request-local" checked={billRequestEnabled} onCheckedChange={handleToggleBillRequest} />
          </div>
          {renderKanban()}
        </TabsContent>
        <TabsContent value="mesas">{renderTablesGrid()}</TabsContent>
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

      {/* Create Order Drawer */}
      <CreateOrderDrawer
        restaurantId={restaurantId}
        open={isCreateDrawerOpen}
        onOpenChange={setIsCreateDrawerOpen}
        onOrderCreated={fetchAll}
      />

      {/* Table Orders Drawer */}
      {selectedTableForDrawer && (
        <TableOrdersDrawer
          restaurantId={restaurantId}
          table={selectedTableForDrawer}
          open={!!selectedTableForDrawer}
          onOpenChange={(open) => { if (!open) setSelectedTableForDrawer(null); }}
          onViewOrder={(order) => { setSelectedTableForDrawer(null); setSelectedOrder(order); }}
        />
      )}
    </div>
  );
};

export default UnifiedOrdersTab;
