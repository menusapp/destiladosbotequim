import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { usePaymentFormat } from "@/hooks/usePaymentFormat";
import { useStatusBadge } from "@/hooks/useStatusBadge";
import { Printer } from "lucide-react";

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
  }[];
}

const BillsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const { getPaymentIcon, getPaymentLabel } = usePaymentFormat();
  const { getBillStatusBadge } = useStatusBadge();

  const fetchBills = useCallback(async () => {
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

    // Buscar os nomes dos clientes através dos pedidos de cada mesa
    const billsWithCustomerNames = await Promise.all(
      (billsData || []).map(async (bill: any) => {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("customer_name")
          .eq("table_id", bill.table_id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          ...bill,
          orders: ordersData || []
        };
      })
    );

    setBills(billsWithCustomerNames);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  useRealtimeSubscription({
    table: 'bills',
    callback: fetchBills,
  });

  const handleMarkAsOnTheWay = async (billId: string) => {
    try {
      const { error } = await supabase.rpc('admin_mark_bill_on_the_way', {
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
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      const { error } = await supabase.rpc('admin_mark_bill_paid', {
        p_bill_id: billId,
        p_restaurant_id: restaurantId,
      });

      if (error) {
        toast.error("Erro ao marcar como paga");
        console.error(error);
        return;
      }

      toast.success("Conta paga! Mesa liberada");
      fetchBills();
    } catch (error) {
      console.error("Erro ao processar pagamento:", error);
      toast.error("Erro ao processar pagamento");
    }
  };

  const handlePrintBill = (bill: Bill) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const customerName = bill.orders[0]?.customer_name || "Cliente";
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conta - Mesa ${bill.tables.table_number}</title>
        <style>
          body { font-family: monospace; padding: 20px; }
          h1 { text-align: center; border-bottom: 2px solid #000; }
          .info { margin: 10px 0; }
          .total { font-size: 1.2em; font-weight: bold; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; }
          table { width: 100%; margin: 10px 0; }
          td { padding: 5px 0; }
          .right { text-align: right; }
        </style>
      </head>
      <body>
        <h1>CONTA</h1>
        <div class="info">Mesa: ${bill.tables.table_number}</div>
        <div class="info">Cliente: ${customerName}</div>
        <div class="info">Data: ${new Date(bill.created_at).toLocaleString('pt-BR')}</div>
        <table>
          <tr>
            <td>Subtotal</td>
            <td class="right">R$ ${bill.subtotal.toFixed(2)}</td>
          </tr>
          ${bill.service_fee > 0 ? `
          <tr>
            <td>Taxa de Serviço</td>
            <td class="right">R$ ${bill.service_fee.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr class="total">
            <td>TOTAL</td>
            <td class="right">R$ ${bill.total_amount.toFixed(2)}</td>
          </tr>
        </table>
        <div class="info">Pagamento: ${getPaymentLabel(bill.payment_method)}</div>
        ${bill.payment_method === 'cash' && bill.change_amount ? `<div class="info">Troco para: R$ ${bill.change_amount.toFixed(2)}</div>` : ''}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
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
      <h3 className="text-lg font-semibold">Contas Solicitadas</h3>

      {bills.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhuma conta solicitada</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bills.map((bill) => (
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
                  {getBillStatusBadge(bill.status)}
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
                  {(() => {
                    const Icon = getPaymentIcon(bill.payment_method);
                    return Icon ? <Icon className="h-4 w-4" /> : null;
                  })()}
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
                    onClick={() => handlePrintBill(bill)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  {bill.status === "requested" && (
                    <Button
                      className="flex-1"
                      onClick={() => handleMarkAsOnTheWay(bill.id)}
                    >
                      A Caminho
                    </Button>
                  )}
                  {bill.status === "on_the_way" && (
                    <Button
                      className="flex-1"
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