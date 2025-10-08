import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, Clock, CreditCard, Banknote, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";

interface OrderItemExtra {
  price_at_order: number;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  products: {
    name: string;
  };
  order_item_extras: OrderItemExtra[];
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

const Comanda = () => {
  const { restaurantSlug, tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [billOnTheWay, setBillOnTheWay] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [changeAmount, setChangeAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
    
    // Configurar realtime para bills (fora do fetchData para evitar múltiplas subscrições)
    let billChannel: any = null;
    let ordersChannel: any = null;
    
    const setupRealtimeChannels = async () => {
      // Buscar table_id primeiro
      const { data: restData } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", restaurantSlug)
        .single();
      
      if (!restData) return;
      
      const { data: tableData } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restData.id)
        .eq("table_number", parseInt(tableNumber || "0"))
        .single();
      
      if (!tableData) return;
      
      console.log("Configurando realtime para table_id:", tableData.id);
      
      // Configurar realtime para atualizar status da conta
      billChannel = supabase
        .channel(`bill-status-${tableData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bills',
            filter: `table_id=eq.${tableData.id}`,
          },
          (payload) => {
            console.log("Bill atualizada:", payload);
            const updatedBill = payload.new as any;
            if (updatedBill.status === "on_the_way") {
              setBillOnTheWay(true);
              setTimerSeconds(0);
              toast.success("A conta está a caminho!");
            } else if (updatedBill.status === "paid") {
              console.log("Conta paga! Redirecionando...");
              toast.success("Conta paga! Obrigado pela preferência!");
              
              // Limpar dados da comanda do sessionStorage
              sessionStorage.removeItem(`customer_name_${tableNumber}`);
              sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
              
              setTimeout(() => {
                navigate(`/menu/${restaurantSlug}/${tableNumber}`);
              }, 2000);
            }
          }
        )
        .subscribe((status) => {
          console.log("Bill channel status:", status);
        });
      
      // Configurar realtime para pedidos aceitos
      ordersChannel = supabase
        .channel(`order-status-${tableData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `table_id=eq.${tableData.id}`,
          },
          (payload) => {
            console.log("Order atualizada:", payload);
            const updatedOrder = payload.new as any;
            if (updatedOrder.status === "accepted" && payload.old?.status === "pending") {
              toast.success("Seu pedido foi aceito!");
              fetchData();
            }
          }
        )
        .subscribe((status) => {
          console.log("Orders channel status:", status);
        });
    };
    
    setupRealtimeChannels();
    
    return () => {
      if (billChannel) {
        console.log("Removendo bill channel");
        supabase.removeChannel(billChannel);
      }
      if (ordersChannel) {
        console.log("Removendo orders channel");
        supabase.removeChannel(ordersChannel);
      }
    };
  }, [restaurantSlug, tableNumber]);

  useEffect(() => {
    if (billRequested && !billOnTheWay && timerSeconds > 0) {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            toast.info("Tempo esgotado! Taxa de serviço removida");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [billRequested, billOnTheWay, timerSeconds]);

  const fetchData = async () => {
    try {
      // Buscar restaurante
      const { data: restData, error: restError } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", restaurantSlug)
        .single();

      if (restError) throw restError;

      // Buscar mesa
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restData.id)
        .eq("table_number", parseInt(tableNumber || "0"))
        .single();

      if (tableError) throw tableError;
      setTableId(tableData.id);

      // Buscar CPF do cliente do sessionStorage
      const customerCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);

      // Buscar apenas pedidos do CPF específico na mesa
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            *,
            products(name),
            order_item_extras(price_at_order)
          )
        `)
        .eq("table_id", tableData.id)
        .eq("customer_cpf", customerCPF || "")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Verificar se já foi solicitada a conta
      const { data: billData } = await supabase
        .from("bills")
        .select("*")
        .eq("table_id", tableData.id)
        .in("status", ["requested", "on_the_way"])
        .single();

      if (billData) {
        setBillRequested(true);
        
        if (billData.status === "on_the_way") {
          setBillOnTheWay(true);
          setTimerSeconds(0);
        } else {
          const elapsed = Math.floor(
            (Date.now() - new Date(billData.bill_requested_at).getTime()) / 1000
          );
          const remaining = Math.max(0, 300 - elapsed); // 5 minutos = 300 segundos
          setTimerSeconds(remaining);
        }
      }
      
    } catch (error: any) {
      toast.error("Erro ao carregar comanda");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = orders.reduce((sum, order) => {
      const orderSum = order.order_items.reduce((itemSum, item) => {
        const extrasSum = (item.order_item_extras || []).reduce((s, e) => s + e.price_at_order, 0);
        return itemSum + (item.price_at_order + extrasSum) * item.quantity;
      }, 0);
      return sum + orderSum;
    }, 0);

    const serviceFee = subtotal * 0.1;
    const serviceFeeApplied = timerSeconds > 0 || !billRequested;
    
    return {
      subtotal,
      serviceFee,
      serviceFeeApplied,
      total: serviceFeeApplied ? subtotal + serviceFee : subtotal,
    };
  };

  const handleRequestBill = async () => {
    if (!tableId) return;

    try {
      const totals = calculateTotal();

      const { data: billData, error } = await supabase
        .from("bills")
        .insert({
          table_id: tableId,
          subtotal: totals.subtotal,
          service_fee: totals.serviceFee,
          service_fee_removed: false,
          total_amount: totals.total,
          status: "requested",
          bill_requested_at: new Date().toISOString(),
          payment_method: paymentMethod,
          change_amount: paymentMethod === "cash" ? parseFloat(changeAmount || "0") : null,
        })
        .select()
        .single();

      if (error) throw error;

      setBillRequested(true);
      setTimerSeconds(300); // 5 minutos
      setDialogOpen(false);
      toast.success("Conta solicitada! O garçom chegará em breve");
    } catch (error: any) {
      toast.error("Erro ao solicitar conta");
      console.error(error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando comanda...</p>
      </div>
    );
  }

  const totals = calculateTotal();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/menu/${restaurantSlug}/${tableNumber}`)}
          className="mb-4 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Cardápio
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Comanda - Mesa {tableNumber}
        </h1>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Timer ou Mensagem A Caminho */}
        {billRequested && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div className="text-center">
                  {billOnTheWay ? (
                    <>
                      <p className="text-lg font-semibold text-primary">
                        A conta está a caminho!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        O garçom chegará em breve com sua conta
                      </p>
                    </>
                  ) : timerSeconds > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Aguardando garçom
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {formatTime(timerSeconds)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aguardando garçom
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Itens Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum pedido realizado ainda
              </p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div key={order.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {order.status === "pending" && "Pendente"}
                        {order.status === "accepted" && "Aceito"}
                        {order.status === "preparing" && "Preparando"}
                        {order.status === "ready" && "Pronto"}
                        {order.status === "delivered" && "Entregue"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {order.order_items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{item.products.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Qtd: {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          R$ {((item.price_at_order + (item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0)) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totais */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold">R$ {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                Taxa de Serviço (10%)
                {!totals.serviceFeeApplied && (
                  <Badge variant="secondary" className="ml-2">
                    Removida
                  </Badge>
                )}
              </span>
              <span
                className={`font-semibold ${
                  !totals.serviceFeeApplied ? "line-through text-muted-foreground" : ""
                }`}
              >
                R$ {totals.serviceFee.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-3 border-t">
              <span>Total</span>
              <span className="text-primary">R$ {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botão Pedir Conta */}
        {!billRequested && orders.length > 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full" size="lg">
                <Receipt className="h-5 w-5 mr-2" />
                Pedir a Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Forma de Pagamento</DialogTitle>
                <DialogDescription>
                  Selecione como deseja pagar a conta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pix" id="pix" />
                    <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                      <Smartphone className="h-4 w-4" />
                      PIX
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="card" id="card" />
                    <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="h-4 w-4" />
                      Cartão
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer">
                      <Banknote className="h-4 w-4" />
                      Dinheiro
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === "cash" && (
                  <div className="space-y-2">
                    <Label htmlFor="change">Troco para quanto? (Opcional)</Label>
                    <Input
                      id="change"
                      type="number"
                      step="0.01"
                      value={changeAmount}
                      onChange={(e) => setChangeAmount(e.target.value)}
                      placeholder="Ex: 100.00"
                    />
                  </div>
                )}

                <Button onClick={handleRequestBill} className="w-full">
                  Confirmar e Pedir Conta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default Comanda;
