import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, Check, CreditCard, Smartphone, Banknote, Printer, Search, Trash2, Calendar, Plus, ChevronDown, FileText, CheckCircle2, Timer, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

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
  tables: { table_number: number };
  order_items: {
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: { name: string } | null;
    order_item_extras: OrderItemExtra[];
  }[];
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

const LocalOrdersTab = ({ restaurantId }: { restaurantId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [tables, setTables] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  // Manual order states
  const [manualOrder, setManualOrder] = useState({
    tableId: "",
    customerName: "",
    customerCpf: "",
    items: [] as { productId: string; quantity: number; price: number }[],
  });

  // Manual bill states
  const [manualBill, setManualBill] = useState({
    tableId: "",
    customerName: "",
    totalAmount: "",
    paymentMethod: "cash",
    selectedOrderId: null as string | null,
  });

  useEffect(() => {
    fetchOrders();
    fetchBills();
    fetchTables();
    fetchProducts();

    if (isSheetOpen) {
      fetchRecentOrders();
    }

    // Realtime subscriptions
    const ordersChannel = supabase
      .channel("orders-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();

    const billsChannel = supabase
      .channel("bills-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "bills" }, () => fetchBills())
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(billsChannel);
    };
  }, [restaurantId, startDate, endDate, isSheetOpen]);

  const fetchTables = async () => {
    const { data } = await supabase.from("tables").select("*").eq("restaurant_id", restaurantId).order("table_number");
    setTables(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*, categories!inner(restaurant_id)")
      .eq("categories.restaurant_id", restaurantId)
      .eq("available", true);
    setProducts(data || []);
  };

  const fetchRecentOrders = async () => {
    const today = startOfDay(new Date());
    const { data } = await supabase
      .from("orders")
      .select(`*, tables!inner(table_number, restaurant_id), order_items(quantity, price_at_order, products(name), order_item_extras(price_at_order))`)
      .eq("tables.restaurant_id", restaurantId)
      .eq("status", "accepted")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    setRecentOrders(data || []);
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`*, tables!inner(table_number, restaurant_id), order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("tables.restaurant_id", restaurantId)
      .or("order_type.is.null,order_type.eq.local")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos");
      setLoading(false);
      return;
    }

    setOrders(data || []);
    setLoading(false);
  };

  const fetchBills = async () => {
    const { data: billsData, error } = await supabase
      .from("bills")
      .select(`*, tables!inner(table_number, restaurant_id)`)
      .eq("tables.restaurant_id", restaurantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar comandas");
      return;
    }

    const billsWithOrders = await Promise.all(
      (billsData || []).map(async (bill: any) => {
        const { data: lastPaidBill } = await supabase
          .from("bills")
          .select("created_at")
          .eq("table_id", bill.table_id)
          .eq("status", "paid")
          .lt("created_at", bill.created_at)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const startDateFilter = lastPaidBill ? lastPaidBill.created_at : new Date(0).toISOString();
        const { data: ordersData } = await supabase
          .from("orders")
          .select(`customer_name, customer_cpf, notes, order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
          .eq("table_id", bill.table_id)
          .gte("created_at", startDateFilter)
          .lte("created_at", bill.created_at)
          .order("created_at", { ascending: false });

        return { ...bill, orders: ordersData || [] };
      })
    );

    setBills(billsWithOrders);
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

  const handleMarkBillAsOnTheWay = async (billId: string) => {
    const { error } = await supabase.rpc("admin_mark_bill_on_the_way", {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success('Status atualizado para "A caminho"!');
    fetchBills();
  };

  const handleMarkBillAsPaid = async (billId: string) => {
    const { error } = await supabase.rpc("admin_mark_bill_paid", {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao finalizar conta");
      return;
    }

    toast.success("Conta finalizada!");
    fetchBills();
  };

  const deleteBill = async (billId: string) => {
    const { error } = await supabase.rpc("admin_delete_bill", {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao excluir conta");
      return;
    }

    toast.success("Conta excluída!");
    fetchBills();
  };

  const handleCreateManualOrder = async () => {
    if (!manualOrder.tableId || !manualOrder.customerName || manualOrder.items.length === 0) {
      toast.error("Preencha todos os campos e adicione pelo menos um item");
      return;
    }

    try {
      const { data: cashSession } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .maybeSingle();

      if (!cashSession) {
        toast.error("Abra o caixa primeiro para registrar pedidos");
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: manualOrder.tableId,
          customer_name: manualOrder.customerName,
          customer_cpf: manualOrder.customerCpf || "000.000.000-00",
          status: "accepted",
          order_type: "local",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = manualOrder.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        price_at_order: item.price,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      toast.success("Pedido criado com sucesso!");
      setManualOrder({ tableId: "", customerName: "", customerCpf: "", items: [] });
      fetchOrders();
    } catch (error) {
      console.error("Error creating manual order:", error);
      toast.error("Erro ao criar pedido manual");
    }
  };

  const handleCreateManualBill = async () => {
    if (!manualBill.selectedOrderId) {
      toast.error("Selecione um pedido recente primeiro");
      return;
    }

    try {
      const { data: cashSession } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .maybeSingle();

      if (!cashSession) {
        toast.error("Abra o caixa primeiro para registrar contas");
        return;
      }

      const totalAmount = parseFloat(manualBill.totalAmount);

      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          table_id: manualBill.tableId,
          subtotal: totalAmount,
          service_fee: 0,
          total_amount: totalAmount,
          payment_method: manualBill.paymentMethod,
          status: "requested",
        })
        .select()
        .single();

      if (billError) throw billError;

      toast.success('Conta criada! Agora você pode marcá-la como "A caminho" ou "Paga".');
      setManualBill({ tableId: "", customerName: "", totalAmount: "", paymentMethod: "cash", selectedOrderId: null });
      fetchBills();
    } catch (error) {
      console.error("Error creating manual bill:", error);
      toast.error("Erro ao criar conta manual");
    }
  };

  const handleSelectOrder = (order: any) => {
    const total = order.order_items.reduce((sum: number, item: any) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras?.reduce((eSum: number, extra: any) => eSum + extra.price_at_order, 0) || 0;
      return sum + itemTotal + extrasTotal;
    }, 0);

    setManualBill({
      tableId: order.table_id,
      customerName: order.customer_name,
      totalAmount: total.toFixed(2),
      paymentMethod: "cash",
      selectedOrderId: order.id,
    });
    setIsSheetOpen(false);
    toast.success("Pedido carregado com sucesso!");
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

    const total = order.order_items.reduce((sum, item) => {
      const extrasTotal = item.order_item_extras?.reduce((eSum, extra) => eSum + extra.price_at_order, 0) || 0;
      return sum + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Pedido #${order.id.slice(0, 8)}</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">PEDIDO</h2>
            <p style="margin: 4px 0; font-size: 12px;">Mesa ${order.tables.table_number}</p>
            <p style="margin: 4px 0; font-size: 11px; color: #666;">${format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
          </div>
          <div style="margin: 12px 0; padding: 8px; background: #f9fafb; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px;"><strong>Cliente:</strong> ${order.customer_name}</p>
            <p style="margin: 4px 0; font-size: 12px; color: #666;">CPF: ${order.customer_cpf}</p>
          </div>
          <div style="border-top: 1px dashed #ddd; margin: 12px 0;"></div>
          ${itemsHtml}
          ${order.notes ? `<div style="margin: 12px 0; padding: 8px; background: #fef3c7; border-radius: 4px;"><p style="margin: 0; font-size: 12px;"><strong>Observação:</strong> ${order.notes}</p></div>` : ""}
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

  const printBill = (bill: Bill) => {
    const printWindow = window.open("", "", "height=600,width=400");
    if (!printWindow) return;

    const ordersByCustomer = bill.orders.reduce((acc, order) => {
      const name = order.customer_name;
      if (!acc[name]) acc[name] = [];
      acc[name].push(order);
      return acc;
    }, {} as Record<string, typeof bill.orders>);

    const allItems = Object.entries(ordersByCustomer)
      .map(([customerName, orders]) => {
        const items = orders.flatMap((order) =>
          order.order_items
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
            .join("")
        );

        return `
        <div style="margin: 12px 0; padding: 8px; background: #f9fafb; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #1f2937;">${customerName}</div>
          ${items}
        </div>
      `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Comanda Mesa ${bill.tables.table_number}</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 18px;">COMANDA</h2>
            <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">Mesa ${bill.tables.table_number}</p>
            <p style="margin: 4px 0; font-size: 11px; color: #666;">${format(new Date(bill.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
          </div>
          <div style="border-top: 1px dashed #ddd; margin: 12px 0;"></div>
          ${allItems}
          <div style="border-top: 2px solid #000; margin: 12px 0;"></div>
          <div style="font-size: 13px; margin: 6px 0;">
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal</span>
              <span>R$ ${bill.subtotal.toFixed(2)}</span>
            </div>
            ${bill.service_fee > 0 ? `<div style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Taxa de Serviço</span><span>R$ ${bill.service_fee.toFixed(2)}</span></div>` : ""}
          </div>
          <div style="border-top: 2px solid #000; margin: 12px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
            <span>TOTAL</span>
            <span>R$ ${bill.total_amount.toFixed(2)}</span>
          </div>
          ${
            bill.payment_method
              ? `
          <div style="margin-top: 16px; padding: 8px; background: #f0f9ff; border-radius: 4px;">
            <p style="margin: 0; font-size: 12px;"><strong>Forma de pagamento:</strong> ${bill.payment_method === "cash" ? "Dinheiro" : bill.payment_method === "debit" ? "Cartão de Débito" : bill.payment_method === "credit" ? "Cartão de Crédito" : "Pix"}</p>
            ${bill.change_amount ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Troco para:</strong> R$ ${bill.change_amount.toFixed(2)}</p>` : ""}
          </div>
          `
              : ""
          }
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
    order.tables.table_number.toString().includes(searchQuery)
  );

  const filteredBills = bills.filter((bill) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      bill.tables.table_number.toString().includes(searchQuery) ||
      bill.orders.some((order) => order.customer_name.toLowerCase().includes(searchLower) || order.customer_cpf.includes(searchQuery))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold">Pedidos Locais</h2>
          <p className="text-muted-foreground">Gerencie pedidos e comandas das mesas</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, CPF ou mesa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                  <Label>Data inicial</Label>
                  <CalendarComponent mode="single" selected={startDate} onSelect={(date) => date && setStartDate(startOfDay(date))} locale={pt} />
                </div>
                <div>
                  <Label>Data final</Label>
                  <CalendarComponent mode="single" selected={endDate} onSelect={(date) => date && setEndDate(endOfDay(date))} locale={pt} />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Grid com Pedidos e Comandas lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção de Pedidos */}
        <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pedidos
            </CardTitle>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Pedido Manual
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Mesa</Label>
                      <Select value={manualOrder.tableId} onValueChange={(value) => setManualOrder({ ...manualOrder, tableId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a mesa" />
                        </SelectTrigger>
                        <SelectContent>
                          {tables.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              Mesa {table.table_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Nome do Cliente</Label>
                      <Input value={manualOrder.customerName} onChange={(e) => setManualOrder({ ...manualOrder, customerName: e.target.value })} placeholder="Nome do cliente" />
                    </div>
                  </div>
                  <div>
                    <Label>CPF (opcional)</Label>
                    <Input value={manualOrder.customerCpf} onChange={(e) => setManualOrder({ ...manualOrder, customerCpf: e.target.value })} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <Label>Produtos</Label>
                    <Select
                      onValueChange={(productId) => {
                        const product = products.find((p) => p.id === productId);
                        if (product) {
                          setManualOrder({
                            ...manualOrder,
                            items: [...manualOrder.items, { productId: product.id, quantity: 1, price: product.price }],
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Adicionar produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - R$ {product.price.toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {manualOrder.items.length > 0 && (
                    <div className="space-y-2">
                      {manualOrder.items.map((item, index) => {
                        const product = products.find((p) => p.id === item.productId);
                        return (
                          <div key={index} className="flex items-center gap-2 p-2 border rounded">
                            <span className="flex-1">{product?.name}</span>
                            <Input type="number" min="1" value={item.quantity} onChange={(e) => {
                                const newItems = [...manualOrder.items];
                                newItems[index].quantity = parseInt(e.target.value) || 1;
                                setManualOrder({ ...manualOrder, items: newItems });
                              }}
                              className="w-20"
                            />
                            <Button variant="ghost" size="sm" onClick={() => {
                                const newItems = manualOrder.items.filter((_, i) => i !== index);
                                setManualOrder({ ...manualOrder, items: newItems });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button onClick={handleCreateManualOrder} className="w-full">
                    Criar Pedido
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando pedidos...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum pedido encontrado</p>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const total = order.order_items.reduce((sum, item) => {
                  const extrasTotal = item.order_item_extras?.reduce((eSum, extra) => eSum + extra.price_at_order, 0) || 0;
                  return sum + (item.price_at_order + extrasTotal) * item.quantity;
                }, 0);

                return (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Mesa {order.tables.table_number}</Badge>
                            {getStatusBadge(order.status)}
                          </div>
                          <div>
                            <p className="font-semibold">{order.customer_name}</p>
                            <p className="text-sm text-muted-foreground">CPF: {order.customer_cpf}</p>
                            <p className="text-sm text-muted-foreground">{format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
                          </div>
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
                          <p className="text-lg font-bold">Total: R$ {total.toFixed(2)}</p>
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

      {/* Seção de Comandas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Comandas
            </CardTitle>
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Comanda Manual
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Criar Comanda Manual</SheetTitle>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Buscar Pedido Recente</Label>
                    <Input value={orderSearchQuery} onChange={(e) => setOrderSearchQuery(e.target.value)} placeholder="Buscar por mesa ou cliente..." />
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {recentOrders
                      .filter(
                        (order) =>
                          order.tables.table_number.toString().includes(orderSearchQuery) || order.customer_name.toLowerCase().includes(orderSearchQuery.toLowerCase())
                      )
                      .map((order) => (
                        <Button key={order.id} variant="outline" className="w-full justify-start" onClick={() => handleSelectOrder(order)}>
                          <div className="text-left">
                            <p className="font-semibold">Mesa {order.tables.table_number} - {order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), "dd/MM HH:mm", { locale: pt })}</p>
                          </div>
                        </Button>
                      ))}
                  </div>
                  <Separator />
                  {manualBill.selectedOrderId && (
                    <>
                      <div>
                        <Label>Cliente</Label>
                        <Input value={manualBill.customerName} disabled />
                      </div>
                      <div>
                        <Label>Valor Total</Label>
                        <Input value={manualBill.totalAmount} onChange={(e) => setManualBill({ ...manualBill, totalAmount: e.target.value })} placeholder="0.00" type="number" step="0.01" />
                      </div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <Select value={manualBill.paymentMethod} onValueChange={(value) => setManualBill({ ...manualBill, paymentMethod: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Dinheiro</SelectItem>
                            <SelectItem value="debit">Cartão de Débito</SelectItem>
                            <SelectItem value="credit">Cartão de Crédito</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleCreateManualBill} className="w-full">
                        Criar Comanda
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBills.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma comanda encontrada</p>
          ) : (
            <div className="space-y-4">
              {filteredBills.map((bill) => {
                const statusConfig: Record<string, { icon: any; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                  requested: { icon: Clock, label: "Solicitada", variant: "outline" },
                  on_the_way: { icon: Timer, label: "A caminho", variant: "secondary" },
                  paid: { icon: Check, label: "Paga", variant: "default" },
                };
                const config = statusConfig[bill.status] || statusConfig.requested;
                const Icon = config.icon;

                return (
                  <Card key={bill.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Mesa {bill.tables.table_number}</Badge>
                            <Badge variant={config.variant} className="gap-1">
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{format(new Date(bill.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
                          <div className="space-y-1">
                            {bill.orders.map((order, idx) => (
                              <div key={idx} className="text-sm">
                                <p className="font-semibold">{order.customer_name}</p>
                                {order.order_items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="ml-2">
                                    <span className="font-medium">{item.quantity}x</span> {item.products?.name || "Produto excluído"}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 pt-2 border-t">
                            <div className="flex justify-between text-sm">
                              <span>Subtotal:</span>
                              <span>R$ {bill.subtotal.toFixed(2)}</span>
                            </div>
                            {bill.service_fee > 0 && (
                              <div className="flex justify-between text-sm">
                                <span>Taxa de Serviço:</span>
                                <span>R$ {bill.service_fee.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-lg font-bold">
                              <span>Total:</span>
                              <span>R$ {bill.total_amount.toFixed(2)}</span>
                            </div>
                          </div>
                          {bill.payment_method && (
                            <div className="text-sm">
                              <span className="font-semibold">Pagamento:</span>{" "}
                              {bill.payment_method === "cash"
                                ? "Dinheiro"
                                : bill.payment_method === "debit"
                                ? "Cartão de Débito"
                                : bill.payment_method === "credit"
                                ? "Cartão de Crédito"
                                : "Pix"}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" onClick={() => printBill(bill)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {bill.status === "requested" && (
                            <Button size="sm" onClick={() => handleMarkBillAsOnTheWay(bill.id)}>
                              <Timer className="h-4 w-4 mr-1" />
                              A caminho
                            </Button>
                          )}
                          {(bill.status === "requested" || bill.status === "on_the_way") && (
                            <Button size="sm" variant="default" onClick={() => handleMarkBillAsPaid(bill.id)}>
                              <Check className="h-4 w-4 mr-1" />
                              Finalizar
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
                                <AlertDialogTitle>Excluir comanda?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteBill(bill.id)}>Excluir</AlertDialogAction>
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
    </div>
  );
};

export default LocalOrdersTab;
