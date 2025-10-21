import { useEffect, useState, useMemo, useCallback } from "react";
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
import { Textarea } from "@/components/ui/textarea";

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
  notes?: string;
  products: {
    name: string;
  };
  order_item_extras: OrderItemExtra[];
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  notes?: string;
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
  notes?: string;
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
  const [hasAcceptedOrder, setHasAcceptedOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [changeAmount, setChangeAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercentage, setServiceFeePercentage] = useState(10);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(30);
  const [restaurantColor, setRestaurantColor] = useState("#FF6B35");
  const [orderNotes, setOrderNotes] = useState("");

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
              sessionStorage.removeItem(`cart_${tableNumber}`);
              setTimeout(() => {
                navigate(`/menu/${restaurantSlug}/${tableNumber}`);
              }, 2000);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'bills',
            filter: `table_id=eq.${tableData.id}`,
          },
          () => {
            // Conta removida (paga e encerrada) -> agradecer e sair
            toast.success("Conta paga! Obrigado pela preferência!");
            sessionStorage.removeItem(`customer_name_${tableNumber}`);
            sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
            sessionStorage.removeItem(`cart_${tableNumber}`);
            setTimeout(() => {
              navigate(`/menu/${restaurantSlug}/${tableNumber}`);
            }, 1500);
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
            if (updatedOrder.status === "accepted") {
              toast.success("Seu pedido foi aceito e está em preparo!");
            }
            // Atualiza dados para refletir status e iniciar timer via efeito
            fetchData();
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

  // Iniciar timer quando houver pedido aceito
  useEffect(() => {
    if (hasAcceptedOrder && prepTimerSeconds === 0 && prepTimeMinutes > 0) {
      setPrepTimerSeconds(prepTimeMinutes * 60);
    }
  }, [hasAcceptedOrder, prepTimeMinutes]);

  const fetchData = useCallback(async () => {
    if (!restaurantSlug || !tableNumber) return;
    
    try {
      // Buscar restaurante primeiro
      const rawCustomerCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
      const customerCPF = (rawCustomerCPF || '').replace(/\D/g, '');
      
      const restResult = await supabase
        .from("restaurants")
        .select("id, service_fee_enabled, service_fee_percentage, prep_time_minutes, primary_color")
        .eq("slug", restaurantSlug)
        .maybeSingle();

      if (restResult.error) throw restResult.error;
      const restData = restResult.data;
      
      if (!restData) {
        toast.error("Restaurante não encontrado");
        return;
      }
      
      setServiceFeeEnabled(restData.service_fee_enabled || false);
      setServiceFeePercentage(restData.service_fee_percentage || 10);
      setPrepTimeMinutes(restData.prep_time_minutes || 30);
      setRestaurantColor(restData.primary_color || "#FF6B35");

      // Buscar mesa DO RESTAURANTE ESPECÍFICO
      const tableResult = await supabase
        .from("tables")
        .select("id")
        .eq("table_number", parseInt(tableNumber))
        .eq("restaurant_id", restData.id)
        .limit(1)
        .maybeSingle();

      if (tableResult.error) throw tableResult.error;
      const tableData = tableResult.data;
      
      if (!tableData) {
        toast.error("Mesa não encontrada");
        return;
      }
      
      setTableId(tableData.id);

      // Buscar última conta paga para essa mesa e CPF
      const { data: lastPaidBill } = await supabase
        .from("bills")
        .select("paid_at")
        .eq("table_id", tableData.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Construir query de pedidos
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id, status, created_at, customer_name, notes,
          order_items(
            id, quantity, price_at_order, notes,
            products(name),
            order_item_extras(price_at_order, product_extras(name))
          )
        `)
        .eq("table_id", tableData.id)
        .eq("customer_cpf", customerCPF);

      // Se existe conta paga, buscar apenas pedidos criados após ela
      if (lastPaidBill?.paid_at) {
        ordersQuery = ordersQuery.gt("created_at", lastPaidBill.paid_at);
      }

      // Buscar pedidos e conta ativa em paralelo
      const [ordersResult, billResult] = await Promise.all([
        ordersQuery.order("created_at", { ascending: false }),
        
        supabase
          .from("bills")
          .select("status")
          .eq("table_id", tableData.id)
          .in("status", ["requested", "on_the_way"])
          .maybeSingle()
      ]);

      if (ordersResult.data) {
        setOrders(ordersResult.data);
        // Verificar se há algum pedido aceito para mostrar cronômetro
        const hasAccepted = ordersResult.data.some(order => order.status === "accepted");
        setHasAcceptedOrder(hasAccepted);
      }

      // Só mostrar status de bill se houver pedidos
      if (billResult.data && ordersResult.data && ordersResult.data.length > 0) {
        setBillRequested(true);
        if (billResult.data.status === "on_the_way") {
          setBillOnTheWay(true);
        }
      } else {
        // Limpar estados se não houver pedidos
        setBillRequested(false);
        setBillOnTheWay(false);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar comanda");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, tableNumber, prepTimeMinutes]);

  // Memoizar cálculo do total
  const totals = useMemo(() => {
    const ordersSubtotal = orders.reduce((sum, order) => {
      const orderSum = order.order_items.reduce((itemSum, item) => {
        const extrasSum = (item.order_item_extras || []).reduce((s, e) => s + e.price_at_order, 0);
        return itemSum + (item.price_at_order + extrasSum) * item.quantity;
      }, 0);
      return sum + orderSum;
    }, 0);

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
  }, [orders, cart, serviceFeeEnabled, serviceFeePercentage]);

  // Verificar se há pedidos pendentes (aguardando aceitação)
  const hasPendingOrders = useMemo(() => {
    return orders.some(order => order.status === "pending");
  }, [orders]);

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
    const rawCustomerCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
    const customerCPF = (rawCustomerCPF || '').replace(/\D/g, '');

    try {
      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          customer_name: customerName || "",
          customer_cpf: customerCPF || "",
          status: "pending",
          notes: orderNotes || null,
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
            notes: item.notes || null,
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

      // Limpar carrinho e observações
      setCart([]);
      setOrderNotes("");
      sessionStorage.removeItem(`cart_${tableNumber}`);
      
      toast.success("Pedido enviado! Aguarde a confirmação do restaurante");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao enviar pedido");
      console.error(error);
    }
  };

  const handleRequestBill = async () => {
    if (!tableId) return;

    // Validar troco em dinheiro
    if (paymentMethod === "cash" && changeAmount) {
      const changeValue = parseFloat(changeAmount);
      if (changeValue < totals.total) {
        toast.error(`O valor para troco deve ser maior ou igual ao total da conta (R$ ${totals.total.toFixed(2)})`);
        return;
      }
    }

    try {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Header */}
      <div 
        className="text-white p-6 shadow-lg"
        style={{ backgroundColor: restaurantColor }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/menu/${restaurantSlug}/${tableNumber}`)}
          className="mb-4 text-white hover:bg-white/20"
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
        {/* Status: Conta a caminho, Timer de preparo, Aguardando aceitação ou Conta solicitada */}
        {billOnTheWay && orders.length > 0 ? (
          <Card className="border" style={{ borderColor: restaurantColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Receipt className="h-5 w-5" style={{ color: restaurantColor }} />
                <div className="text-center">
                  <p className="text-lg font-semibold" style={{ color: restaurantColor }}>
                    🧾 A conta está a caminho!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    O garçom chegará em breve com sua conta
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : hasAcceptedOrder && !billRequested ? (
          <Card 
            className="border-2" 
            style={{ 
              borderColor: restaurantColor,
              backgroundColor: `${restaurantColor}15`
            }}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5" style={{ color: restaurantColor }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: restaurantColor }}>
                    👨‍🍳 Em Preparo
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: restaurantColor }}>
                    {formatTime(prepTimerSeconds)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: restaurantColor, opacity: 0.8 }}>
                    {prepTimerSeconds > 0 ? "Tempo estimado restante" : "Seu pedido deve estar pronto"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : hasPendingOrders && !billRequested ? (
          <Card className="border-blue-500 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-blue-800">
                    ⏳ Pedido realizado!
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    Aguardando aceitação da cozinha
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : billRequested && !billOnTheWay && orders.length > 0 ? (
          <Card className="border" style={{ borderColor: restaurantColor }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3">
                <Clock className="h-5 w-5" style={{ color: restaurantColor }} />
                <div className="text-center">
                  <p className="text-lg font-semibold" style={{ color: restaurantColor }}>
                    Conta solicitada!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Aguardando garçom
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                        {item.notes && (
                          <div className="text-xs text-muted-foreground mt-1 italic">
                            Obs: {item.notes}
                          </div>
                        )}
                      </div>
                      <p className="font-semibold" style={{ color: restaurantColor }}>
                        R$ {itemTotal.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="order-notes">Observações do Pedido (opcional)</Label>
                  <Textarea
                    id="order-notes"
                    placeholder="Ex: Pedido urgente, alergia a amendoim..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button 
                  className="w-full text-white" 
                  onClick={handleSendOrder}
                  style={{ backgroundColor: restaurantColor }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Enviar Pedido
                </Button>
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
                       <Badge variant="outline" className={order.status === "pending" ? "border-blue-500 text-blue-700" : ""}>
                          {order.status === "pending" && "⏳ Aguardando"}
                          {order.status === "accepted" && "👨‍🍳 Em Preparo"}
                          {order.status === "preparing" && "Em Preparo"}
                          {order.status === "ready" && "Pronto"}
                          {order.status === "delivered" && "Entregue"}
                       </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    {order.notes && (
                      <p className="text-sm text-muted-foreground italic">
                        Obs: {order.notes}
                      </p>
                    )}
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
                          {item.notes && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              Obs: {item.notes}
                            </div>
                          )}
                        </div>
                        <p className="font-semibold" style={{ color: restaurantColor }}>
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
              <span style={{ color: restaurantColor }}>R$ {totals.total.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Botão Pedir Conta */}
        {!billRequested && (orders.length > 0 || cart.length > 0) && cart.length === 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="w-full text-white hover:opacity-90"
                variant="ghost"
                size="lg"
                style={{ 
                  backgroundColor: restaurantColor,
                  borderColor: restaurantColor
                }}
              >
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

                <Button 
                  onClick={handleRequestBill} 
                  className="w-full text-white"
                  style={{ backgroundColor: restaurantColor }}
                >
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
