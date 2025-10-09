import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, Clock, CreditCard, Banknote, Smartphone, ShoppingCart } from "lucide-react";
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
  product_extras: {
    name: string;
  };
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

interface CartItemExtra {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string;
  product: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
  extras: CartItemExtra[];
}

const Comanda = () => {
  const { restaurantSlug, tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [billOnTheWay, setBillOnTheWay] = useState(false);
  const [prepTimerSeconds, setPrepTimerSeconds] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [changeAmount, setChangeAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercentage, setServiceFeePercentage] = useState(10);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(30);

  useEffect(() => {
    fetchData();
    
    // Carregar carrinho do sessionStorage
    const loadCart = () => {
      const savedCart = sessionStorage.getItem(`cart_${tableNumber}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    };
    loadCart();
    
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
    // Cronômetro de preparo
    if (prepTimerSeconds > 0) {
      const interval = setInterval(() => {
        setPrepTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [prepTimerSeconds]);

  const fetchData = async () => {
    try {
      // Buscar restaurante e configurações
      const { data: restData, error: restError } = await supabase
        .from("restaurants")
        .select("id, service_fee_enabled, service_fee_percentage, prep_time_minutes")
        .eq("slug", restaurantSlug)
        .single();

      if (restError) throw restError;
      
      setServiceFeeEnabled(restData.service_fee_enabled || false);
      setServiceFeePercentage(restData.service_fee_percentage || 10);
      setPrepTimeMinutes(restData.prep_time_minutes || 30);

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
            order_item_extras(
              price_at_order,
              product_extras(name)
            )
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
    // Calcular subtotal dos pedidos já enviados
    const ordersSubtotal = orders.reduce((sum, order) => {
      const orderSum = order.order_items.reduce((itemSum, item) => {
        const extrasSum = (item.order_item_extras || []).reduce((s, e) => s + e.price_at_order, 0);
        return itemSum + (item.price_at_order + extrasSum) * item.quantity;
      }, 0);
      return sum + orderSum;
    }, 0);

    // Calcular subtotal do carrinho (ainda não enviado)
    const cartSubtotal = cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.product.price + extrasTotal) * item.quantity;
    }, 0);

    const subtotal = ordersSubtotal + cartSubtotal;

    const serviceFee = serviceFeeEnabled ? subtotal * (serviceFeePercentage / 100) : 0;
    
    return {
      subtotal,
      serviceFee,
      total: subtotal + serviceFee,
    };
  };

  const handleSendOrder = async () => {
    if (cart.length === 0) {
      toast.error("Carrinho vazio");
      return;
    }

    if (!tableId) {
      toast.error("Mesa não encontrada");
      return;
    }

    const customerName = sessionStorage.getItem(`customer_name_${tableNumber}`);
    const customerCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);

    try {
      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          customer_name: customerName || "",
          customer_cpf: customerCPF || "",
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens do pedido
      for (const item of cart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_order: item.product.price,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // Inserir extras do item
        if (item.extras.length > 0) {
          const orderItemExtras = item.extras.map((extra) => ({
            order_item_id: orderItem.id,
            product_extra_id: extra.id,
            price_at_order: extra.price,
          }));

          const { error: extrasError } = await supabase
            .from("order_item_extras")
            .insert(orderItemExtras);

          if (extrasError) throw extrasError;
        }
      }

      // Limpar carrinho
      setCart([]);
      sessionStorage.removeItem(`cart_${tableNumber}`);
      
      // Iniciar cronômetro de preparo
      setPrepTimerSeconds(prepTimeMinutes * 60);
      
      toast.success("Pedido enviado! Aguarde o atendimento");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao enviar pedido");
      console.error(error);
    }
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
          total_amount: totals.total,
          status: "requested",
          payment_method: paymentMethod,
          change_amount: paymentMethod === "cash" ? parseFloat(changeAmount || "0") : null,
        })
        .select()
        .single();

      if (error) throw error;

      setBillRequested(true);
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
        {/* Cronômetro de Preparo */}
        {prepTimerSeconds > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Seu pedido está em preparo
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {formatTime(prepTimerSeconds)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo estimado restante
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensagem conta solicitada */}
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
                  ) : (
                    <>
                      <p className="text-lg font-semibold text-primary">
                        Conta solicitada!
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aguardando garçom
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Carrinho (Itens não enviados) */}
        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Carrinho (Não enviado)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cart.map((item) => {
                  const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
                  const itemTotal = (item.product.price + extrasTotal) * item.quantity;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex justify-between items-start py-2 border-b last:border-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {item.quantity}
                        </p>
                        {item.extras.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            + {item.extras.map(e => e.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold text-primary">
                        R$ {itemTotal.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <Button className="w-full mt-4" onClick={handleSendOrder}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Enviar Pedido
              </Button>
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
                        className="flex justify-between items-start py-2 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.products.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Qtd: {item.quantity}
                          </p>
                          {item.order_item_extras && item.order_item_extras.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              + {item.order_item_extras.map(e => e.product_extras.name).join(', ')}
                            </div>
                          )}
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
            {serviceFeeEnabled && totals.serviceFee > 0 && (
              <div className="flex justify-between">
                <span>Taxa de Serviço ({serviceFeePercentage}%)</span>
                <span className="font-semibold">R$ {totals.serviceFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold pt-3 border-t">
              <span>Total</span>
              <span className="text-primary">R$ {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botão Pedir Conta */}
        {!billRequested && (orders.length > 0 || cart.length > 0) && cart.length === 0 && (
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
