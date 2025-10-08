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
  bill_requested_at: string;
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
    
    const { data, error } = await supabase
      .from("bills")
      .select(`
        *,
        tables!inner(table_number, restaurant_id),
        orders!inner(customer_name, table_id)
      `)
      .eq("tables.restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar contas");
      console.error(error);
      setLoading(false);
      return;
    }

    // Agrupar orders por bill
    const billsMap = new Map();
    data?.forEach((row: any) => {
      if (!billsMap.has(row.id)) {
        billsMap.set(row.id, {
          ...row,
          orders: []
        });
      }
      if (row.orders) {
        billsMap.get(row.id).orders.push(row.orders);
      }
    });

    setBills(Array.from(billsMap.values()));
    setLoading(false);
  };

  const handleMarkAsPaid = async (billId: string) => {
    const { error } = await supabase
      .from("bills")
      .update({ 
        status: "paid",
        paid_at: new Date().toISOString()
      })
      .eq("id", billId);

    if (error) {
      toast.error("Erro ao marcar como paga");
      return;
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
                  <Badge variant={bill.status === "paid" ? "default" : "secondary"}>
                    {bill.status === "paid" ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Paga
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
                  <div className="flex justify-between text-sm">
                    <span>Taxa de Serviço (10%)</span>
                    <span>R$ {bill.service_fee.toFixed(2)}</span>
                  </div>
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

                {bill.status !== "paid" && (
                  <Button
                    className="w-full"
                    onClick={() => handleMarkAsPaid(bill.id)}
                  >
                    Marcar como Paga
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