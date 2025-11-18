import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, Check, CreditCard, Smartphone, Banknote, Printer, Search, Trash2, Calendar, FileText, CheckCircle2, Timer, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    fetchOrders();
    fetchBills();

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
  }, [restaurantId, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`*, tables!inner(table_number, restaurant_id), order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name)))`)
      .eq("tables.restaurant_id", restaurantId)
      .in("order_type", ["local", ""])
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Erro ao buscar pedidos");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const fetchBills = async () => {
    const { data, error } = await supabase
      .from("bills")
      .select(`
        *,
        tables!inner(table_number, restaurant_id),
        orders(customer_name, customer_cpf, notes, order_items(quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, product_extras(name))))
      `)
      .eq("tables.restaurant_id", restaurantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching bills:", error);
      toast.error("Erro ao buscar contas");
    } else {
      setBills(data || []);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.rpc("admin_update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error("Error updating order status:", error);
      toast.error("Erro ao atualizar status do pedido");
      return;
    }

    toast.success("Status do pedido atualizado!");
    fetchOrders();
  };

  const deleteOrder = async (orderId: string) => {
    const { error } = await supabase.rpc("admin_delete_order", {
      p_order_id: orderId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error("Error deleting order:", error);
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
      console.error("Error marking bill as on the way:", error);
      toast.error("Erro ao marcar conta como a caminho");
      return;
    }

    toast.success("Conta marcada como a caminho!");
    fetchBills();
  };

  const handleMarkBillAsPaid = async (billId: string) => {
    const { error } = await supabase.rpc("admin_mark_bill_paid", {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      console.error("Error marking bill as paid:", error);
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
      console.error("Error deleting bill:", error);
      toast.error("Erro ao excluir conta");
      return;
    }

    toast.success("Conta excluída!");
    fetchBills();
  };

  const printOrder = (order: Order) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const orderTotal = order.order_items.reduce((total, item) => {
      const itemTotal = item.price_at_order * item.quantity;
      const extrasTotal = item.order_item_extras.reduce((sum, extra) => sum + extra.price_at_order, 0);
      return total + itemTotal + extrasTotal;
    }, 0);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pedido #${order.id.slice(0, 8)}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; }
          h2 { text-align: center; margin: 10px 0; }
          .item { margin: 10px 0; border-bottom: 1px dashed #000; padding-bottom: 5px; }
          .total { font-weight: bold; margin-top: 10px; text-align: right; }
        </style>
      </head>
      <body>
        <h2>PEDIDO #${order.id.slice(0, 8)}</h2>
        <p><strong>Mesa:</strong> ${order.tables.table_number}</p>
        <p><strong>Cliente:</strong> ${order.customer_name}</p>
        <p><strong>Data:</strong> ${format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</p>
        <hr />
        ${order.order_items.map(item => `
          <div class="item">
            <p><strong>${item.quantity}x ${item.products?.name || "Item removido"}</strong> - R$ ${(item.price_at_order * item.quantity).toFixed(2)}</p>
            ${item.order_item_extras.length > 0 ? `
              <p style="margin-left: 20px; font-size: 12px;">
                ${item.order_item_extras.map(extra => `+ ${extra.product_extras?.name || "Extra removido"} (R$ ${extra.price_at_order.toFixed(2)})`).join('<br>')}
              </p>
            ` : ''}
            ${item.notes ? `<p style="margin-left: 20px; font-size: 12px;"><em>Obs: ${item.notes}</em></p>` : ''}
          </div>
        `).join('')}
        <p class="total">TOTAL: R$ ${orderTotal.toFixed(2)}</p>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const printBill = (bill: Bill) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conta - Mesa ${bill.tables.table_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; }
          h2 { text-align: center; margin: 10px 0; }
          .order { margin: 15px 0; border-bottom: 1px solid #000; padding-bottom: 10px; }
          .item { margin: 5px 0 5px 20px; }
          .total { font-weight: bold; margin-top: 10px; text-align: right; }
        </style>
      </head>
      <body>
        <h2>CONTA - MESA ${bill.tables.table_number}</h2>
        <p><strong>Data:</strong> ${format(new Date(bill.created_at), "dd/MM/yyyy HH:mm")}</p>
        <hr />
        ${bill.orders.map(order => `
          <div class="order">
            <p><strong>Cliente:</strong> ${order.customer_name}</p>
            ${order.order_items.map(item => `
              <div class="item">
                <p>${item.quantity}x ${item.products?.name || "Item removido"} - R$ ${(item.price_at_order * item.quantity).toFixed(2)}</p>
                ${item.order_item_extras.length > 0 ? `
                  <p style="margin-left: 20px; font-size: 12px;">
                    ${item.order_item_extras.map(extra => `+ ${extra.product_extras?.name || "Extra removido"} (R$ ${extra.price_at_order.toFixed(2)})`).join('<br>')}
                  </p>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
        <hr />
        <p class="total">SUBTOTAL: R$ ${bill.subtotal.toFixed(2)}</p>
        <p class="total">TAXA DE SERVIÇO: R$ ${bill.service_fee.toFixed(2)}</p>
        <p class="total">TOTAL: R$ ${bill.total_amount.toFixed(2)}</p>
        ${bill.change_amount ? `<p class="total">TROCO: R$ ${bill.change_amount.toFixed(2)}</p>` : ''}
        <p style="text-align: center; margin-top: 20px;">Obrigado pela preferência!</p>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any, label: string }> = {
      pending: { variant: "outline", icon: Clock, label: "Pendente" },
      accepted: { variant: "default", icon: Check, label: "Aceito" },
      preparing: { variant: "secondary", icon: Timer, label: "Preparando" },
      ready: { variant: "default", icon: Utensils, label: "Pronto" },
      delivered: { variant: "default", icon: CheckCircle2, label: "Entregue" },
      on_the_way: { variant: "secondary", icon: Clock, label: "A Caminho" },
      paid: { variant: "default", icon: CheckCircle2, label: "Pago" },
    };

    const config = badges[status] || badges.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter((order) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.customer_name.toLowerCase().includes(searchLower) ||
      order.customer_cpf.includes(searchLower) ||
      order.tables.table_number.toString().includes(searchLower)
    );
  });

  const filteredBills = bills.filter((bill) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      bill.tables.table_number.toString().includes(searchLower) ||
      bill.orders.some((order) => order.customer_name.toLowerCase().includes(searchLower) || order.customer_cpf.includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Pedidos Locais</h2>
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, CPF ou mesa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
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
                  <Label>Data Inicial</Label>
                  <CalendarComponent mode="single" selected={startDate} onSelect={(date) => date && setStartDate(startOfDay(date))} locale={pt} />
                </div>
                <div>
                  <Label>Data Final</Label>
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Carregando pedidos...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum pedido encontrado no período</p>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Mesa {order.tables.table_number}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.customer_name} • {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {order.order_items.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        <div className="flex justify-between">
                          <span>
                            {item.quantity}x {item.products?.name || "Item removido"}
                          </span>
                          <span>R$ {(item.price_at_order * item.quantity).toFixed(2)}</span>
                        </div>
                        {item.order_item_extras.length > 0 && (
                          <div className="ml-4 text-xs text-muted-foreground space-y-1">
                            {item.order_item_extras.map((extra, extraIdx) => (
                              <div key={extraIdx} className="flex justify-between">
                                <span>+ {extra.product_extras?.name || "Extra removido"}</span>
                                <span>R$ {extra.price_at_order.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {item.notes && <p className="text-xs text-muted-foreground ml-4 mt-1">Obs: {item.notes}</p>}
                      </div>
                    ))}

                    <div className="flex gap-2 pt-3 border-t flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => printOrder(order)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir
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
                            <Trash2 className="h-4 w-4 mr-1" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteOrder(order.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
          </div>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma comanda encontrada no período</p>
          ) : (
            <div className="space-y-4">
              {filteredBills.map((bill) => (
                <Card key={bill.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Mesa {bill.tables.table_number}</span>
                          {getStatusBadge(bill.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">{format(new Date(bill.created_at), "dd/MM/yyyy HH:mm")}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bill.orders.map((order, orderIdx) => (
                      <div key={orderIdx} className="border-b pb-2 last:border-0">
                        <p className="text-sm font-medium mb-1">{order.customer_name}</p>
                        {order.order_items.map((item, itemIdx) => (
                          <div key={itemIdx} className="text-sm text-muted-foreground ml-2">
                            <div className="flex justify-between">
                              <span>
                                {item.quantity}x {item.products?.name || "Item removido"}
                              </span>
                              <span>R$ {(item.price_at_order * item.quantity).toFixed(2)}</span>
                            </div>
                            {item.order_item_extras.length > 0 && (
                              <div className="ml-4 text-xs space-y-1">
                                {item.order_item_extras.map((extra, extraIdx) => (
                                  <div key={extraIdx} className="flex justify-between">
                                    <span>+ {extra.product_extras?.name || "Extra removido"}</span>
                                    <span>R$ {extra.price_at_order.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    <div className="pt-2 space-y-1 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>R$ {bill.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Taxa de serviço:</span>
                        <span>R$ {bill.service_fee.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span>Total:</span>
                        <span>R$ {bill.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>Pagamento:</span>
                        {bill.payment_method === "cash" && <Banknote className="h-4 w-4" />}
                        {bill.payment_method === "debit" && <CreditCard className="h-4 w-4" />}
                        {bill.payment_method === "credit" && <CreditCard className="h-4 w-4" />}
                        {bill.payment_method === "pix" && <Smartphone className="h-4 w-4" />}
                        <span className="capitalize">{bill.payment_method === "cash" ? "Dinheiro" : bill.payment_method === "debit" ? "Débito" : bill.payment_method === "credit" ? "Crédito" : "PIX"}</span>
                      </div>
                      {bill.change_amount !== null && bill.change_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span>Troco:</span>
                          <span>R$ {bill.change_amount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => printBill(bill)}>
                        <Printer className="h-4 w-4 mr-1" />
                        Imprimir
                      </Button>
                      {bill.status === "pending" && (
                        <Button size="sm" onClick={() => handleMarkBillAsOnTheWay(bill.id)}>
                          <Clock className="h-4 w-4 mr-1" />
                          A Caminho
                        </Button>
                      )}
                      {(bill.status === "pending" || bill.status === "on_the_way") && (
                        <Button size="sm" variant="default" onClick={() => handleMarkBillAsPaid(bill.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Finalizar
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteBill(bill.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default LocalOrdersTab;
