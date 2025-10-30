import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Clock, Check, CreditCard, Smartphone, Banknote, Printer, Search, Trash2, Calendar, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { startOfDay, endOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface OrderItem {
  quantity: number;
  price_at_order: number;
  notes: string | null;
  products: { 
    name: string;
  } | null;
  order_item_extras: {
    price_at_order: number;
    product_extras: { name: string } | null;
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
  tables: {
    table_number: number;
  };
  orders: {
    customer_name: string;
    customer_cpf: string;
    notes: string | null;
    order_items: OrderItem[];
  }[];
}

const BillsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  
  // Manual bill states
  const [tables, setTables] = useState<any[]>([]);
  const [manualBill, setManualBill] = useState({
    tableId: '',
    customerName: '',
    totalAmount: '',
    paymentMethod: 'cash',
  });

  useEffect(() => {
    fetchBills();
    fetchTables();
    
    // Realtime subscription
    const channel = supabase
      .channel('bills-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bills',
        },
        () => fetchBills()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, startDate, endDate]);

  const fetchTables = async () => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('table_number');
    
    setTables(data || []);
  };

  const fetchBills = async () => {
    setLoading(true);
    
    const { data: billsData, error } = await supabase
      .from("bills")
      .select(`
        *,
        tables!inner(table_number, restaurant_id)
      `)
      .eq("tables.restaurant_id", restaurantId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar contas");
      console.error(error);
      setLoading(false);
      return;
    }

    // Buscar os pedidos completos de cada conta
    const billsWithOrders = await Promise.all(
      (billsData || []).map(async (bill: any) => {
          const { data: ordersData } = await supabase
          .from("orders")
          .select(`
            customer_name,
            customer_cpf,
            notes,
            order_items(
              quantity,
              price_at_order,
              notes,
              products(name),
              order_item_extras(
                price_at_order,
                product_extras(name)
              )
            )
          `)
          .eq("table_id", bill.table_id)
          .order("created_at", { ascending: false });

        return {
          ...bill,
          orders: ordersData || []
        };
      })
    );

    setBills(billsWithOrders);
    setLoading(false);
  };

  const handleMarkAsOnTheWay = async (billId: string) => {
    const { error } = await (supabase as any).rpc('admin_mark_bill_on_the_way', {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao atualizar status");
      console.error(error);
      return;
    }

    toast.success("Conta a caminho!");
    fetchBills();
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      const { error } = await (supabase as any).rpc('admin_mark_bill_paid', {
        p_bill_id: billId,
        p_restaurant_id: restaurantId,
      });

      if (error) {
        toast.error("Erro ao processar pagamento");
        console.error(error);
        return;
      }

      toast.success("Conta paga e registrada!" );
      fetchBills();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      toast.error("Erro ao processar pagamento");
    }
  };

  const deleteBill = async (billId: string) => {
    const { error } = await (supabase as any).rpc('admin_delete_bill_and_orders', {
      p_bill_id: billId,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao excluir conta");
      console.error(error);
      return;
    }

    toast.success("Conta e pedidos excluídos!");
    fetchBills();
  };

  const handleCreateManualBill = async () => {
    if (!manualBill.tableId || !manualBill.totalAmount) {
      toast.error('Preencha mesa e valor total');
      return;
    }

    try {
      const totalAmount = parseFloat(manualBill.totalAmount);
      
      // Create bill directly as paid
      const { error: billError } = await supabase
        .from('bills')
        .insert({
          table_id: manualBill.tableId,
          subtotal: totalAmount,
          service_fee: 0,
          total_amount: totalAmount,
          payment_method: manualBill.paymentMethod,
          status: 'paid',
          paid_at: new Date().toISOString()
        });

      if (billError) throw billError;

      // Create order for the bill
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          table_id: manualBill.tableId,
          customer_name: manualBill.customerName || 'Cliente Balcão',
          customer_cpf: '000.000.000-00',
          status: 'accepted',
          notes: 'Conta Manual'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      toast.success('Conta manual criada com sucesso!');
      setManualBill({
        tableId: '',
        customerName: '',
        totalAmount: '',
        paymentMethod: 'cash'
      });
      fetchBills();
    } catch (error) {
      console.error('Error creating manual bill:', error);
      toast.error('Erro ao criar conta manual');
    }
  };

  const printBill = (bill: Bill) => {
    const printWindow = window.open('', '', 'height=600,width=400');
    if (!printWindow) return;

    const ordersByCustomer = bill.orders.reduce((acc, order) => {
      const name = order.customer_name;
      if (!acc[name]) acc[name] = [];
      acc[name].push(order);
      return acc;
    }, {} as Record<string, typeof bill.orders>);

    const allItems = Object.entries(ordersByCustomer).map(([customerName, orders]) => {
      const items = orders.flatMap(order => 
        order.order_items.map(item => {
          const extrasTotal = item.order_item_extras?.reduce((sum, extra) => sum + extra.price_at_order, 0) || 0;
          const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
          const productName = item.products?.name || "Produto excluído";
          const extras = item.order_item_extras && item.order_item_extras.length > 0
            ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px;">+ ${item.order_item_extras.map(e => e.product_extras?.name || "Extra excluído").join(', ')}</div>`
            : '';
          const notes = item.notes
            ? `<div style="font-size: 11px; padding-left: 20px; margin-top: 2px; font-style: italic; color: #b45309;">Obs: ${item.notes}</div>`
            : '';
          
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
        }).join('')
      );

      return `
        <div style="margin: 12px 0; padding: 8px; background: #f9fafb; border-radius: 4px;">
          <div style="font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #1f2937;">${customerName}</div>
          ${items}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Conta Mesa ${bill.tables.table_number}</title>
          <style>
            @media print {
              @page { margin: 10mm; }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', monospace;
              max-width: 300px;
              margin: 0 auto;
              padding: 15px;
            }
          </style>
        </head>
        <body>
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <h2 style="margin: 5px 0;">CONTA</h2>
            <div style="font-size: 16px; font-weight: bold; margin-top: 8px;">MESA ${bill.tables.table_number}</div>
            <div style="font-size: 11px; color: #666; margin-top: 5px;">${new Date(bill.created_at).toLocaleString('pt-BR')}</div>
          </div>
          
          <div style="margin: 15px 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #000; padding-bottom: 5px;">ITENS</h3>
            ${allItems}
          </div>

          <div style="border-top: 2px solid #000; padding-top: 10px; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0;">
              <span>Subtotal</span>
              <span>R$ ${bill.subtotal.toFixed(2)}</span>
            </div>
            ${bill.service_fee > 0 ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0;">
                <span>Taxa de Serviço</span>
                <span>R$ ${bill.service_fee.toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #000;">
              <span>TOTAL</span>
              <span>R$ ${bill.total_amount.toFixed(2)}</span>
            </div>
          </div>

          <div style="margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 4px;">
            <div style="font-size: 12px; font-weight: bold;">Forma de Pagamento:</div>
            <div style="font-size: 13px; margin-top: 5px;">${getPaymentLabel(bill.payment_method)}</div>
            ${bill.payment_method === "cash" && bill.change_amount ? `
              <div style="font-size: 11px; color: #666; margin-top: 3px;">Troco para R$ ${bill.change_amount.toFixed(2)}</div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 2px solid #000; font-size: 11px;">
            <p style="margin: 5px 0;">Obrigado pela preferência!</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "card":
        return <CreditCard className="h-4 w-4" />;
      case "pix":
        return <Smartphone className="h-4 w-4" />;
      case "cash":
        return <Banknote className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "card":
        return "Cartão";
      case "pix":
        return "PIX";
      case "cash":
        return "Dinheiro";
      default:
        return method;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando contas...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Manual Bill Creation */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Criar Conta Manual
                </CardTitle>
                <ChevronDown className="h-5 w-5 transition-transform" />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Mesa</Label>
                  <Select value={manualBill.tableId} onValueChange={(value) => setManualBill({ ...manualBill, tableId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a mesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map(table => (
                        <SelectItem key={table.id} value={table.id}>
                          Mesa {table.table_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome do Cliente (Opcional)</Label>
                  <Input
                    placeholder="Nome do cliente"
                    value={manualBill.customerName}
                    onChange={(e) => setManualBill({ ...manualBill, customerName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={manualBill.totalAmount}
                    onChange={(e) => setManualBill({ ...manualBill, totalAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Método de Pagamento</Label>
                  <Select value={manualBill.paymentMethod} onValueChange={(value) => setManualBill({ ...manualBill, paymentMethod: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleCreateManualBill} className="w-full">
                Criar Conta Manual (Paga)
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Contas Solicitadas</h3>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                {format(startDate, "dd/MM/yy", { locale: pt })} - {format(endDate, "dd/MM/yy", { locale: pt })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-3 space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data inicial</label>
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(startOfDay(date))}
                    locale={pt}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data final</label>
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(endOfDay(date))}
                    locale={pt}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por mesa ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhuma conta neste período</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {bills
            .filter((bill) => {
              const searchLower = searchQuery.toLowerCase();
              return (
                bill.tables.table_number.toString().includes(searchLower) ||
                bill.orders.some(order => 
                  order.customer_name.toLowerCase().includes(searchLower)
                )
              );
            })
            .map((bill) => (
            <Card key={bill.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Mesa {bill.tables.table_number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {bill.orders[0]?.customer_name || "Cliente"}
                    </p>
                  </div>
                  <Badge variant={bill.status === "paid" ? "default" : bill.status === "on_the_way" ? "outline" : "secondary"}>
                    {bill.status === "paid" ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Paga
                      </>
                    ) : bill.status === "on_the_way" ? (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        A Caminho
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        Pendente
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>R$ {bill.subtotal.toFixed(2)}</span>
                  </div>
                  {bill.service_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Taxa de Serviço</span>
                      <span>R$ {bill.service_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">R$ {bill.total_amount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {getPaymentIcon(bill.payment_method)}
                  <span>{getPaymentLabel(bill.payment_method)}</span>
                  {bill.payment_method === "cash" && bill.change_amount && (
                    <span className="text-muted-foreground">
                      (Troco para R$ {bill.change_amount.toFixed(2)})
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => printBill(bill)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                  {bill.status === "requested" && (
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => handleMarkAsOnTheWay(bill.id)}
                    >
                      A Caminho
                    </Button>
                  )}
                  {bill.status === "on_the_way" && (
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => handleMarkAsPaid(bill.id)}
                    >
                      Conta Paga
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
                        <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteBill(bill.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillsTab;