import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Receipt, Clock, CreditCard, Banknote, Smartphone, ShoppingCart, Utensils, ChevronDown, ChevronUp } from "lucide-react";
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

// Ícones por tipo de método
const METHOD_ICONS: Record<string, any> = {
  cash: Banknote,
  debit: CreditCard,
  credit: CreditCard,
  pix: Smartphone,
  meal_voucher: Utensils,
};

// Bandeiras de cartão
const CARD_BRANDS = [
  { code: "visa", name: "Visa", logo: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" },
  { code: "mastercard", name: "Mastercard", logo: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" },
  { code: "elo", name: "Elo", logo: "https://upload.wikimedia.org/wikipedia/commons/d/d0/Bandeira_elo_cartance.png" },
  { code: "amex", name: "American Express", logo: "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg" },
  { code: "hipercard", name: "Hipercard", logo: "https://upload.wikimedia.org/wikipedia/commons/8/89/Hipercard_logo.svg" },
];

// Bandeiras de vale refeição
const MEAL_VOUCHER_BRANDS = [
  { code: "alelo", name: "Alelo", logo: "https://www.alelo.com.br/assets/img/logo-alelo.svg" },
  { code: "sodexo", name: "Sodexo", logo: "https://upload.wikimedia.org/wikipedia/commons/3/37/Sodexo_2008_%28Green%29.svg" },
  { code: "vr", name: "VR", logo: "https://www.vr.com.br/assets/img/logo-vr.svg" },
  { code: "ticket", name: "Ticket", logo: "https://www.ticket.com.br/portal-parceiros/assets/images/logo-ticket-red.svg" },
  { code: "ben", name: "Ben Visa Vale", logo: "https://www.ben.com.br/assets/images/logo-ben.svg" },
  { code: "flash", name: "Flash", logo: "https://flash.com.br/images/logo.svg" },
];

// Função para obter informação de uma bandeira
const getBrandInfo = (brandCode: string) => {
  return CARD_BRANDS.find(b => b.code === brandCode) || 
         MEAL_VOUCHER_BRANDS.find(b => b.code === brandCode);
};

interface PaymentMethod {
  id: string;
  name: string;
  method_type: string;
  is_active: boolean;
  accepted_brands: string[] | null;
}

interface OrderItemExtra {
  price_at_order: number;
  product_extras: {
    name: string;
  } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  notes?: string;
  products: {
    name: string;
  } | null;
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
    promotional_price?: number | null;
  };
  quantity: number;
  extras: CartItemExtra[];
  notes?: string;
}

const Comanda = () => {
  const { slug: restaurantSlug, tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [billOnTheWay, setBillOnTheWay] = useState(false);
  const [prepTimerSeconds, setPrepTimerSeconds] = useState(0);
  const [hasAcceptedOrder, setHasAcceptedOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] = useState<string>("");
  const [changeAmount, setChangeAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceFeeEnabled, setServiceFeeEnabled] = useState(false);
  const [serviceFeePercentage, setServiceFeePercentage] = useState(10);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState(30);
  const [restaurantColor, setRestaurantColor] = useState("#FF6B35");
  const [orderNotes, setOrderNotes] = useState("");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

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
      // Buscar table_id e comanda_id primeiro
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
      
      // 🔑 CRÍTICO: Buscar comanda_id do cliente atual
      // Se não existir no sessionStorage, tentar encontrar comanda ativa pelo CPF
      let comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
      
      if (!comandaId) {
        const customerCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
        if (customerCPF) {
          // Buscar comanda ativa deste cliente nesta mesa
          const { data: activeComanda } = await supabase
            .from("comandas")
            .select("id")
            .eq("table_id", tableData.id)
            .eq("customer_cpf", customerCPF.replace(/\D/g, ''))
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (activeComanda) {
            comandaId = activeComanda.id;
            sessionStorage.setItem(`comanda_id_${tableNumber}`, comandaId);
            console.log("🔑 Comanda encontrada e salva no sessionStorage:", comandaId);
          }
        }
      }
      
      // 🚨 Se não encontrou comanda_id, NÃO configurar realtime (evita fallback por table_id)
      if (!comandaId) {
        console.log("⚠️ Sem comanda_id - realtime não configurado (cliente precisa fazer login)");
        return;
      }
      
      console.log("🔔 Configurando realtime para Comanda - table_id:", tableData.id, "comanda_id:", comandaId);
      
      // Função para processar pagamento (seja UPDATE ou INSERT de bill paga)
      const handleBillPaid = (bill: any) => {
        console.log("✅ Conta foi paga! Redirecionando...");
        toast.success("Conta paga! Obrigado pela preferência!");
        
        // Fechar comanda ativa
        if (comandaId) {
          supabase.from("comandas").update({
            status: "closed",
            closed_at: new Date().toISOString()
          }).eq("id", comandaId);
          console.log("📋 Comanda fechada:", comandaId);
        }
        
        // Salvar informações para abrir modal de avaliação
        sessionStorage.setItem('shouldShowReview', 'true');
        if (bill?.id) {
          sessionStorage.setItem('reviewBillId', bill.id);
        }
        
        // Limpar TODOS os dados do cliente da sessão
        sessionStorage.removeItem(`customer_name_${tableNumber}`);
        sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
        sessionStorage.removeItem(`cart_${tableNumber}`);
        sessionStorage.removeItem(`comanda_id_${tableNumber}`);
        sessionStorage.removeItem("customerInfo");
        
        setTimeout(() => {
          navigate(`/${restaurantSlug}/mesa/${tableNumber}`);
        }, 2000);
      };

      // Configurar realtime para atualizar status da conta - SEMPRE por comanda_id
      // (comandaId é garantido existir neste ponto do código)
      const billFilter = `comanda_id=eq.${comandaId}`;
      
      billChannel = supabase
        .channel(`bill-status-${comandaId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bills',
            filter: billFilter,
          },
          (payload) => {
            console.log("🔔 Conta ATUALIZADA em tempo real na Comanda:", payload);
            const bill = payload.new as any;
            
            if (bill?.status === "on_the_way") {
              console.log("💳 Conta a caminho!");
              setBillOnTheWay(true);
              toast.success("A conta está a caminho! 💳");
            }
            
            if (bill?.status === "paid") {
              handleBillPaid(bill);
            }
            
            // Recarregar dados de qualquer forma
            console.log("🔄 Recarregando dados da comanda...");
            fetchData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bills',
            filter: billFilter,
          },
          (payload) => {
            console.log("🔔 Nova conta CRIADA em tempo real na Comanda:", payload);
            const bill = payload.new as any;
            
            // Bill criada já como paga (pelo PDV sem cliente ter solicitado)
            if (bill?.status === "paid") {
              handleBillPaid(bill);
            } else {
              // Bill criada com outro status - atualizar estado
              setBillRequested(true);
              if (bill?.status === "on_the_way") {
                setBillOnTheWay(true);
              }
              fetchData();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'bills',
            filter: billFilter,
          },
          (payload) => {
            // Conta removida (paga e encerrada) -> agradecer e sair
            const deletedBill = payload.old as any;
            toast.success("Conta paga! Obrigado pela preferência!");
            
            // Fechar comanda ativa
            if (comandaId) {
              supabase.from("comandas").update({
                status: "closed",
                closed_at: new Date().toISOString()
              }).eq("id", comandaId);
            }
            
            // Salvar informações para abrir modal de avaliação
            sessionStorage.setItem('shouldShowReview', 'true');
            if (deletedBill?.id) {
              sessionStorage.setItem('reviewBillId', deletedBill.id);
            }
            
            // Limpar TODOS os dados do cliente da sessão
            sessionStorage.removeItem(`customer_name_${tableNumber}`);
            sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
            sessionStorage.removeItem(`cart_${tableNumber}`);
            sessionStorage.removeItem(`comanda_id_${tableNumber}`);
            sessionStorage.removeItem("customerInfo");
            
            setTimeout(() => {
              navigate(`/menu/${restaurantSlug}/${tableNumber}`);
            }, 1500);
          }
        )
        .subscribe((status) => {
          console.log('📡 Status da subscrição Comanda (Bills):', status);
        });
      
      // Configurar realtime para pedidos aceitos - SEMPRE por comanda_id
      // (comandaId é garantido existir neste ponto do código)
      const ordersFilter = `comanda_id=eq.${comandaId}`;
      
      ordersChannel = supabase
        .channel(`order-status-${comandaId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: ordersFilter,
          },
          (payload) => {
            console.log("Order atualizada em tempo real:", payload);
            const updatedOrder = payload.new as any;
            
            if (updatedOrder?.status === "accepted") {
              setHasAcceptedOrder(true);
              const prepTimeMs = (prepTimeMinutes || 30) * 60 * 1000;
              setPrepTimerSeconds(Math.floor(prepTimeMs / 1000));
              toast.success("Pedido aceito! Preparação iniciada.");
            }
            
            // Atualiza dados para refletir status
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
      setRestaurantId(restData.id);

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

      // Buscar comanda_id do cliente atual
      const comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
      
      // Buscar última conta paga DESTA COMANDA específica (não da mesa toda)
      // Isso evita que pagar uma comanda afete a visualização de outras comandas na mesma mesa
      const lastPaidBillQuery = comandaId
        ? supabase
            .from("bills")
            .select("paid_at")
            .eq("comanda_id", comandaId)
            .eq("status", "paid")
            .order("paid_at", { ascending: false })
            .limit(1)
        : supabase
            .from("bills")
            .select("paid_at")
            .eq("table_id", tableData.id)
            .eq("status", "paid")
            .order("paid_at", { ascending: false })
            .limit(1);

      const { data: lastPaidBill } = await lastPaidBillQuery.maybeSingle();

      // 🔑 CRÍTICO: Construir query de pedidos SEMPRE por comanda_id (não por CPF!)
      // Isso evita mostrar pedidos de comandas antigas/fechadas
      let ordersQuery;
      
      if (comandaId) {
        // ✅ Busca APENAS pedidos desta comanda específica
        ordersQuery = supabase
          .from("orders")
          .select(`
            id, status, created_at, customer_name, notes,
            order_items(
              id, quantity, price_at_order, notes,
              products(name),
              order_item_extras(price_at_order, product_extras(name))
            )
          `)
          .eq("comanda_id", comandaId);
      } else {
        // Fallback: sem comanda_id, buscar por mesa+CPF mas apenas pedidos NÃO entregues
        // (isso evita mostrar histórico de comandas fechadas)
        ordersQuery = supabase
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
          .eq("customer_cpf", customerCPF)
          .in("status", ["pending", "accepted", "preparing", "ready"]);
        
        // Se existe conta paga recente, buscar apenas pedidos criados após ela
        if (lastPaidBill?.paid_at) {
          ordersQuery = ordersQuery.gt("created_at", lastPaidBill.paid_at);
        }
      }

      // Buscar pedidos e conta ativa em paralelo - bills filtrado por comanda_id (já declarado acima)
      
      // Buscar pedidos e conta ativa em paralelo - bills filtrado por comanda_id
      const billQuery = comandaId
        ? supabase
            .from("bills")
            .select("id, status")
            .eq("comanda_id", comandaId)
            .in("status", ["requested", "on_the_way"])
            .order("created_at", { ascending: false })
            .limit(1)
        : supabase
            .from("bills")
            .select("id, status")
            .eq("table_id", tableData.id)
            .in("status", ["requested", "on_the_way"])
            .order("created_at", { ascending: false })
            .limit(1);
      
      const [ordersResult, billResult] = await Promise.all([
        ordersQuery.order("created_at", { ascending: false }),
        billQuery
      ]);

      if (ordersResult.data) {
        setOrders(ordersResult.data);
        // Verificar se há algum pedido aceito para mostrar cronômetro
        const hasAccepted = ordersResult.data.some(order => order.status === "accepted");
        setHasAcceptedOrder(hasAccepted);
      }

      // Só mostrar status de bill se houver pedidos
      const activeBill = billResult.data?.[0];
      if (activeBill && ordersResult.data && ordersResult.data.length > 0) {
        setBillRequested(true);
        if (activeBill.status === "on_the_way") {
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

  // Buscar formas de pagamento quando restaurantId estiver disponível
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!restaurantId) return;
      
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);
      
      if (!error && data && data.length > 0) {
        setPaymentMethods(data);
        // Setar primeiro método como default
        setPaymentMethod(data[0].name);
        setSelectedPaymentMethodType(data[0].method_type);
      }
    };
    
    fetchPaymentMethods();
  }, [restaurantId]);

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
      const effectivePrice = item.product.promotional_price ?? item.product.price;
      return sum + (effectivePrice + extrasTotal) * item.quantity;
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
      // Get restaurant_id from the table
      const { data: tableData } = await supabase
        .from("tables")
        .select("restaurant_id")
        .eq("id", tableId)
        .single();

      if (!tableData) {
        throw new Error("Mesa não encontrada");
      }

      // Buscar comanda_id do sessionStorage ou criar uma nova (fallback)
      let comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
      
      // Se não existe comanda_id, criar uma nova (fallback para quando Menu.tsx não criou)
      if (!comandaId && customerName && customerCPF) {
        const cleanCpf = customerCPF.replace(/\D/g, '');
        
        // Verificar se já existe uma comanda ativa para este cliente
        const { data: existingComanda } = await supabase
          .from("comandas")
          .select("id")
          .eq("table_id", tableId)
          .eq("customer_cpf", cleanCpf)
          .eq("status", "active")
          .maybeSingle();
        
        if (existingComanda) {
          comandaId = existingComanda.id;
          console.log('📋 Comanda existente encontrada (fallback):', comandaId);
        } else {
          // Criar nova comanda
          const { data: newComanda, error: comandaError } = await supabase
            .from("comandas")
            .insert({
              restaurant_id: tableData.restaurant_id,
              table_id: tableId,
              customer_name: customerName,
              customer_cpf: cleanCpf,
              status: "active"
            })
            .select("id")
            .single();
          
          if (!comandaError && newComanda) {
            comandaId = newComanda.id;
            console.log('📋 Nova comanda criada (fallback):', comandaId);
          }
        }
        
        // Salvar no sessionStorage para uso futuro
        if (comandaId) {
          sessionStorage.setItem(`comanda_id_${tableNumber}`, comandaId);
        }
      }

      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          restaurant_id: tableData.restaurant_id,
          customer_name: customerName || "",
          customer_cpf: customerCPF || "",
          comanda_id: comandaId || null,
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
            price_at_order: item.product.promotional_price ?? item.product.price,
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

    // Buscar comanda_id do cliente atual
    const comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
    
    if (!comandaId) {
      toast.error("Comanda não encontrada. Por favor, faça login novamente.");
      return;
    }

    // Verificar se já existe bill ativa para ESTA COMANDA (não para a mesa toda)
    const { data: existingBill } = await supabase
      .from("bills")
      .select("id, status")
      .eq("comanda_id", comandaId)
      .in("status", ["requested", "on_the_way"])
      .limit(1);

    if (existingBill && existingBill.length > 0) {
      // Já existe bill para esta comanda - apenas atualizar estado local
      setBillRequested(true);
      if (existingBill[0].status === "on_the_way") {
        setBillOnTheWay(true);
      }
      setDialogOpen(false);
      toast.info("A conta já foi solicitada!");
      return;
    }

    // Validar troco em dinheiro - usar method_type para comparar
    const isCash = selectedPaymentMethodType === "cash";
    if (isCash && changeAmount) {
      const changeValue = parseFloat(changeAmount);
      if (changeValue < totals.total) {
        toast.error(`O valor para troco deve ser maior ou igual ao total da conta (R$ ${totals.total.toFixed(2)})`);
        return;
      }
    }

    try {
      // Usar method_type diretamente (cash, credit, debit, pix, meal_voucher)
      const normalizedPaymentMethod = selectedPaymentMethodType || "cash";

      const { data: billData, error } = await supabase
        .from("bills")
        .insert({
          table_id: tableId,
          comanda_id: comandaId, // ← INCLUIR comanda_id
          subtotal: totals.subtotal,
          service_fee: totals.serviceFee,
          total_amount: totals.total,
          status: "requested",
          payment_method: normalizedPaymentMethod,
          change_amount: isCash ? parseFloat(changeAmount || "0") : null,
        })
        .select()
        .single();

      if (error) throw error;

      setBillRequested(true);
      setDialogOpen(false);
      toast.success("Conta solicitada! O garçom chegará em breve");
    } catch (error: any) {
      toast.error(`Erro ao solicitar conta: ${error.message || "tente novamente"}`);
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
                  const effectivePrice = item.product.promotional_price ?? item.product.price;
                  const itemTotal = (effectivePrice + extrasTotal) * item.quantity;
                  
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
                          <p className="font-medium">{item.products?.name || "Produto removido"}</p>
                          <p className="text-sm text-muted-foreground">
                            Qtd: {item.quantity}
                          </p>
                          {item.order_item_extras && item.order_item_extras.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              + {item.order_item_extras
                                  .filter(e => e.product_extras?.name)
                                  .map(e => e.product_extras.name)
                                  .join(', ')}
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
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <RadioGroup value={paymentMethod} onValueChange={(value) => {
                  setPaymentMethod(value);
                  const selected = paymentMethods.find(m => m.name === value);
                  if (selected) setSelectedPaymentMethodType(selected.method_type);
                }}>
                  {paymentMethods.length > 0 ? (
                    paymentMethods.map((method) => {
                      const Icon = METHOD_ICONS[method.method_type] || CreditCard;
                      const brands = method.accepted_brands || [];
                      const isSelected = paymentMethod === method.name;
                      const maxPreviewBrands = 3;
                      
                      return (
                        <div 
                          key={method.id} 
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          }`}
                          onClick={() => {
                            setPaymentMethod(method.name);
                            setSelectedPaymentMethodType(method.method_type);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            {/* Lado esquerdo: Radio + Icon + Nome */}
                            <div className="flex items-center space-x-2 min-w-0">
                              <RadioGroupItem value={method.name} id={method.id} />
                              <Label htmlFor={method.id} className="flex items-center gap-2 cursor-pointer">
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="truncate">{method.name}</span>
                              </Label>
                            </div>
                            
                            {/* Lado direito: Preview das bandeiras (P&B) quando NÃO selecionado */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!isSelected && brands.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {brands.slice(0, maxPreviewBrands).map((brandCode: string) => {
                                    const brand = getBrandInfo(brandCode);
                                    if (!brand) return null;
                                    return (
                                      <img 
                                        key={brandCode}
                                        src={brand.logo} 
                                        alt={brand.name}
                                        className="h-3 w-auto object-contain grayscale opacity-50"
                                        title={brand.name}
                                      />
                                    );
                                  })}
                                  {brands.length > maxPreviewBrands && (
                                    <span className="text-[10px] text-muted-foreground">+{brands.length - maxPreviewBrands}</span>
                                  )}
                                </div>
                              )}
                              {brands.length > 0 && (
                                isSelected ? (
                                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Gavetinha expandida: Bandeiras coloridas quando SELECIONADO */}
                          {isSelected && brands.length > 0 && (
                            <div className="mt-3 pt-3 border-t animate-in fade-in slide-in-from-top-1 duration-200">
                              <p className="text-xs text-muted-foreground mb-2">Bandeiras aceitas:</p>
                              <div className="flex flex-wrap gap-2">
                                {brands.map((brandCode: string) => {
                                  const brand = getBrandInfo(brandCode);
                                  if (!brand) return null;
                                  return (
                                    <div 
                                      key={brandCode} 
                                      className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md"
                                    >
                                      <img 
                                        src={brand.logo} 
                                        alt={brand.name}
                                        className="h-4 w-auto object-contain"
                                      />
                                      <span className="text-xs font-medium">{brand.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // Fallback para caso não haja métodos cadastrados
                    <>
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${paymentMethod === "PIX" ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                        onClick={() => { setPaymentMethod("PIX"); setSelectedPaymentMethodType("pix"); }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="PIX" id="pix" />
                          <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                            <Smartphone className="h-4 w-4" />
                            PIX
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${paymentMethod === "Cartão" ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                        onClick={() => { setPaymentMethod("Cartão"); setSelectedPaymentMethodType("credit"); }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Cartão" id="card" />
                          <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                            <CreditCard className="h-4 w-4" />
                            Cartão
                          </Label>
                        </div>
                      </div>
                      <div 
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${paymentMethod === "Dinheiro" ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                        onClick={() => { setPaymentMethod("Dinheiro"); setSelectedPaymentMethodType("cash"); }}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Dinheiro" id="cash" />
                          <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer">
                            <Banknote className="h-4 w-4" />
                            Dinheiro
                          </Label>
                        </div>
                      </div>
                    </>
                  )}
                </RadioGroup>

                {/* Mostrar campo de troco apenas para métodos do tipo cash */}
                {selectedPaymentMethodType === "cash" && (
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
