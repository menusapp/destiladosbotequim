import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Check, CreditCard, Smartphone, Banknote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    // Primeiro, buscar a conta para pegar o table_id
    const { data: billData, error: fetchError } = await supabase
      .from("bills")
      .select("table_id")
      .eq("id", billId)
      .single();

    if (fetchError || !billData) {
      toast.error("Erro ao buscar conta");
      return;
    }

    // Deletar todos os pedidos da mesa (isso vai limpar a comanda)
    const { error: deleteOrdersError } = await supabase
      .from("orders")
      .delete()
      .eq("table_id", billData.table_id);

    if (deleteOrdersError) {
      console.error("Erro ao deletar pedidos:", deleteOrdersError);
      toast.error("Erro ao limpar comanda");
      return;
    }

    console.log("Pedidos deletados com sucesso para table_id:", billData.table_id);

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

    // Deletar a própria conta também
    const { error: deleteBillError } = await supabase
      .from("bills")
      .delete()
      .eq("id", billId);

    if (deleteBillError) {
      console.error("Erro ao deletar conta:", deleteBillError);
      // Não retornar erro pois já foi marcada como paga
    }

    toast.success("Conta marcada como paga!");
    fetchBills();
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

                {bill.status === "requested" && (
                  <Button
                    className="w-full"
                    onClick={() => handleMarkAsOnTheWay(bill.id)}
                  >
                    A Caminho
                  </Button>
                )}
                {bill.status === "on_the_way" && (
                  <Button
                    className="w-full"
                    onClick={() => handleMarkAsPaid(bill.id)}
                  >
                    Conta Paga
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillsTab;