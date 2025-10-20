import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Check, CreditCard, Smartphone, Banknote, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  quantity: number;
  price_at_order: number;
  notes: string | null;
  products: { name: string } | null;
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

  useEffect(() => {
    fetchBills();
    
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
  }, [restaurantId]);

  const fetchBills = async () => {
    setLoading(true);
    
    const { data: billsData, error } = await supabase
      .from("bills")
      .select(`
        *,
        tables!inner(table_number, restaurant_id)
      `)
      .eq("tables.restaurant_id", restaurantId)
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
    const { error } = await supabase
      .from("bills")
      .update({ status: "on_the_way" })
      .eq("id", billId);

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
      // Buscar a conta completa com informações da mesa e restaurante
      const { data: billData, error: fetchError } = await supabase
        .from("bills")
        .select(`
          *,
          tables!inner(
            table_number,
            restaurant_id
          )
        `)
        .eq("id", billId)
        .maybeSingle();

      if (fetchError || !billData) {
        toast.error("Erro ao buscar conta");
        return;
      }

      // Buscar sessão de caixa aberta
      const { data: cashSession, error: sessionError } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", billData.tables.restaurant_id)
        .eq("status", "open")
        .maybeSingle();

      // Deletar todos os pedidos da mesa
      const { error: deleteOrdersError } = await supabase
        .from("orders")
        .delete()
        .eq("table_id", billData.table_id);

      if (deleteOrdersError) {
        console.error("Erro ao deletar pedidos:", deleteOrdersError);
        toast.error("Erro ao limpar comanda");
        return;
      }

      // Atualizar status da conta para paga
      const { error: updateError } = await supabase
        .from("bills")
        .update({ 
          status: "paid",
          paid_at: new Date().toISOString()
        })
        .eq("id", billId);

      if (updateError) {
        toast.error("Erro ao marcar como paga");
        console.error(updateError);
        return;
      }

      // Registrar movimento de caixa se houver sessão aberta
      if (cashSession) {
        const { error: movementError } = await supabase
          .from("cash_movements")
          .insert({
            cash_session_id: cashSession.id,
            restaurant_id: billData.tables.restaurant_id,
            movement_type: "entrada",
            amount: billData.total_amount,
            description: `Venda - Mesa ${billData.tables.table_number}`,
            category: "venda",
            payment_method: billData.payment_method,
            bill_id: billData.id,
            created_by: "Sistema",
          });

        if (movementError) {
          console.error("Erro ao registrar movimento de caixa:", movementError);
          toast.error("Conta paga, mas erro ao registrar no caixa");
        }
      }

      // Deletar a conta
      const { error: deleteBillError } = await supabase
        .from("bills")
        .delete()
        .eq("id", billId);

      if (deleteBillError) {
        console.error("Erro ao deletar conta:", deleteBillError);
      }

      toast.success("Conta paga e registrada no caixa!");
      fetchBills();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      toast.error("Erro ao processar pagamento");
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contas Solicitadas</h3>
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

      {bills.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhuma conta solicitada</p>
        </div>
      ) : (
        <div className="grid gap-4">
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