import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMenuInactivityLogout } from "@/hooks/useMenuInactivityLogout";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { RestaurantInfoCard } from "@/components/menu/RestaurantInfoCard";
import { FeaturedProducts } from "@/components/menu/FeaturedProducts";
import { CategoryProducts } from "@/components/menu/CategoryProducts";
import { CategoryNav } from "@/components/menu/CategoryNav";

import { ComandaBottomBar } from "@/components/menu/ComandaBottomBar";
import { CartDrawer } from "@/components/menu/CartDrawer";
import { ProductDetailDrawer } from "@/components/menu/ProductDetailDrawer";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import { Clock } from "lucide-react";
import { ReviewModal } from "@/components/menu/ReviewModal";
import { Product, ProductExtra, Category, Restaurant, CartItem } from "@/types/menu";
import { isFeaturedVisible } from "@/lib/featuredUtils";

const Menu = () => {
  const { slug: restaurantSlug, tableNumber } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | undefined>();
  const [reviewCounterOrderId, setReviewCounterOrderId] = useState<string | undefined>();
  const [reviewBillId, setReviewBillId] = useState<string | undefined>();
  const [blockLoginForReview, setBlockLoginForReview] = useState(false);
  const [hasOpenComanda, setHasOpenComanda] = useState(false);
  const [comandaTotal, setComandaTotal] = useState(0);
  const [comandaStatus, setComandaStatus] = useState<string>("");
  const [showComandaBar, setShowComandaBar] = useState(true);
  
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [featuredSectionTitle, setFeaturedSectionTitle] = useState("Destaques");

  // ⚡ Refs para manter valores atualizados nos listeners de realtime (evita stale closures)
  const tableIdRef = useRef<string | null>(null);
  const customerInfoRef = useRef<{name: string, cpf: string} | null>(null);
  const restaurantRef = useRef<Restaurant | null>(null);

  // Manter refs sincronizadas com estado
  useEffect(() => {
    tableIdRef.current = tableId;
  }, [tableId]);

  useEffect(() => {
    if (customerName && customerCPF) {
      customerInfoRef.current = { name: customerName, cpf: customerCPF };
    } else {
      customerInfoRef.current = null;
    }
  }, [customerName, customerCPF]);

  useEffect(() => {
    restaurantRef.current = restaurant;
  }, [restaurant]);

  useMenuInactivityLogout(tableId, tableNumber || "", restaurantSlug || "");

  // Verificar se deve abrir modal de avaliação ao carregar
  useEffect(() => {
    const shouldShowReview = sessionStorage.getItem('shouldShowReview');
    
    if (shouldShowReview === 'true') {
      // BLOQUEAR dialog de login ANTES de tudo
      setBlockLoginForReview(true);
      
      const billId = sessionStorage.getItem('reviewBillId');
      const counterOrderId = sessionStorage.getItem('reviewCounterOrderId');
      
      
      // Limpar flags do sessionStorage
      sessionStorage.removeItem('shouldShowReview');
      sessionStorage.removeItem('reviewBillId');
      sessionStorage.removeItem('reviewCounterOrderId');
      
      // Abrir modal IMEDIATAMENTE
      if (billId) setReviewBillId(billId);
      if (counterOrderId) setReviewCounterOrderId(counterOrderId);
      setReviewModalOpen(true);
      
    }
  }, []); // Executar apenas UMA VEZ ao montar

  const fetchData = useCallback(async () => {
    if (!restaurantSlug || !tableNumber) return;
    try {
      // ⚡ Query única otimizada com TODOS os dados relacionados
      const { data: restaurantData, error: restError } = await supabase
        .from("restaurants")
        .select(`
          id, name, slug, is_open, logo_url, banner_url, primary_color, 
          prep_time_minutes, service_fee_enabled, service_fee_percentage,
          featured_section_enabled, featured_section_title,
          login_require_name, login_require_phone,
          categories (
            id, name, display_order,
            products (
              id, name, description, price, promotional_price, available, image_url, 
              is_featured, prep_time_minutes, featured_display_order, featured_active, featured_schedule,
              product_extras (id, name, price)
            )
          )
        `)
        .eq("slug", restaurantSlug)
        .order("display_order", { foreignTable: "categories" })
        .single();
      
      if (restError) throw restError;
      setRestaurant(restaurantData);
      
      // Configurar título da seção de destaques
      if (restaurantData.featured_section_title) {
        setFeaturedSectionTitle(restaurantData.featured_section_title);
      }

      // ⚡ Buscar tableId - suporta AMBOS: table_number (int) OU id (UUID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableNumber);
      
      let tableData;
      let tableError;
      
      if (isUUID) {
        // tableNumber é um UUID - buscar pelo id
        const result = await supabase
          .from("tables").select("id, table_number")
          .eq("restaurant_id", restaurantData.id)
          .eq("id", tableNumber)
          .single();
        tableData = result.data;
        tableError = result.error;
      } else {
        // tableNumber é um número - buscar pelo table_number
        const result = await supabase
          .from("tables").select("id, table_number")
          .eq("restaurant_id", restaurantData.id)
          .eq("table_number", parseInt(tableNumber))
          .single();
        tableData = result.data;
        tableError = result.error;
      }
      
      if (tableError) {
        console.error('❌ Erro ao buscar mesa:', tableError);
        throw tableError;
      }
      
      setTableId(tableData.id);

      // ⚡ Processar categorias dos dados JÁ CARREGADOS (sem query adicional!)
      // Filtrar produtos em destaque para não aparecerem duplicados nas categorias
      const sortedCategories = (restaurantData.categories || [])
        .filter((cat: any) => cat.is_active !== false)
        .map((cat: any) => ({ 
          ...cat, 
          products: (cat.products || [])
            .filter((p: Product) => {
              if (!p.available || p.is_featured) return false;
              const channels = (p as any).visibility_channels || ['all'];
              return channels.includes('all') || channels.includes('mesa');
            })
            .sort((a: Product, b: Product) => a.name.localeCompare(b.name)) 
        }))
        .filter((cat: Category) => cat.products.length > 0);
      setCategories(sortedCategories);

      // ⚡ Extrair produtos em destaque dos dados JÁ CARREGADOS (sem query adicional!)
      if (restaurantData.featured_section_enabled) {
        const allProducts = restaurantData.categories?.flatMap((cat: any) => cat.products) || [];
        const featured = allProducts
          .filter((p: any) => {
            if (!p.is_featured || !p.available) return false;
            if (!isFeaturedVisible(p)) return false;
            const channels = p.visibility_channels || ['all'];
            return channels.includes('all') || channels.includes('mesa');
          })
          .sort((a: any, b: any) => (a.featured_display_order || 0) - (b.featured_display_order || 0));
        setFeaturedProducts(featured);
      } else {
        setFeaturedProducts([]);
      }

      // ⚡ Não chamar checkOpenComanda aqui - useEffect cuida disso
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, tableNumber]);

  const checkOpenComanda = useCallback(async (currentTableId: string, currentCart: CartItem[]) => {
    try {
      // Calcular total do carrinho SEMPRE (mesmo sem customer info)
      const cartTotal = currentCart.reduce((sum, item) => {
        const extrasSum = item.extras?.reduce((extraSum, extra) => extraSum + extra.price, 0) || 0;
        const effectivePrice = item.product.promotional_price ?? item.product.price;
        return sum + (effectivePrice + extrasSum) * item.quantity;
      }, 0);

      // Obter informações do cliente da sessão atual
      const savedCustomerInfo = sessionStorage.getItem("customerInfo");
      if (!savedCustomerInfo) {
        setHasOpenComanda(false);
        setComandaTotal(cartTotal); // Mostrar total do carrinho mesmo sem customer info
        setComandaStatus("");
        return;
      }

      const currentCustomer = JSON.parse(savedCustomerInfo);
      
      // 🔑 CRÍTICO: Obter comanda_id da sessão (isolamento por CPF)
      const comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);

      // Verificar se a COMANDA ESPECÍFICA DO CLIENTE foi fechada (não da mesa toda!)
      // Isso evita que pagar uma comanda afete outras comandas na mesma mesa
      if (comandaId) {
        // Verificar se a comanda do cliente está fechada
        const { data: clientComanda } = await supabase
          .from("comandas")
          .select("status")
          .eq("id", comandaId)
          .maybeSingle();
        
        if (clientComanda?.status === "closed") {
          setHasOpenComanda(false);
          setComandaTotal(cartTotal);
          setComandaStatus("");
          return;
        }
        
        // Verificar se existe bill paga DESTA COMANDA específica
        const { data: clientPaidBill } = await supabase
          .from("bills")
          .select("id")
          .eq("comanda_id", comandaId)
          .eq("status", "paid")
          .limit(1);
        
        if (clientPaidBill && clientPaidBill.length > 0) {
          setHasOpenComanda(false);
          setComandaTotal(cartTotal);
          setComandaStatus("");
          return;
        }
      }

      // Buscar apenas pedidos do cliente atual (sessão atual) usando comanda_id se disponível
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id,
          status,
          customer_name,
          customer_cpf,
          order_items (
            quantity,
            price_at_order,
            order_item_extras (
              price_at_order
            )
          )
        `)
        .eq("table_id", currentTableId)
        .in("status", ["pending", "accepted", "preparing", "ready"]);
      
      // Filtrar por comanda_id se disponível (mais preciso), senão por CPF
      if (comandaId) {
        ordersQuery = ordersQuery.eq("comanda_id", comandaId);
      } else {
        ordersQuery = ordersQuery
          .eq("customer_name", currentCustomer.name)
          .eq("customer_cpf", currentCustomer.cpf);
      }
      
      const { data: orders, error } = await ordersQuery;

      if (error) throw error;

      // Calcular total dos pedidos já enviados
      let ordersTotal = 0;
      if (orders && orders.length > 0) {
        setHasOpenComanda(true);
        
        orders.forEach((order: any) => {
          order.order_items?.forEach((item: any) => {
            const extrasSum = item.order_item_extras?.reduce((sum: number, extra: any) => sum + extra.price_at_order, 0) || 0;
            const itemTotal = (item.price_at_order + extrasSum) * item.quantity;
            ordersTotal += itemTotal;
          });
        });
        
        // Pegar status do pedido mais recente
        const latestOrder = orders[orders.length - 1];
        setComandaStatus(latestOrder.status);
      } else {
        setHasOpenComanda(false);
        setComandaStatus("");
      }

      // Total da comanda = pedidos enviados + carrinho
      setComandaTotal(ordersTotal + cartTotal);
    } catch (error) {
      console.error("Erro ao verificar comanda:", error);
    }
  }, [tableNumber]);

  // Bottom bar always visible - no scroll hiding
  useEffect(() => {
    setShowComandaBar(true);
  }, []);

  // Atualizar total da comanda sempre que o cart ou tableId mudar
  useEffect(() => {
    if (tableId && customerName) {
      checkOpenComanda(tableId, cart);
    }
  }, [cart, tableId, customerName, checkOpenComanda]);

  // Realtime subscription para pedidos da mesa e status do restaurante
  useEffect(() => {
    if (!restaurant?.id) return;
    const channel = supabase
      .channel('menu-restaurant-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'restaurants',
        filter: `id=eq.${restaurant.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        setRestaurant((prev: any) => prev ? { ...prev, ...updated } : null);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurant?.id]);


  // ⚡ Mostrar dialog de login APENAS quando dados estiverem carregados E não tiver avaliação pendente
  useEffect(() => {
    // NÃO mostrar login se estiver mostrando avaliação
    if (blockLoginForReview || reviewModalOpen) {
      return;
    }
    
    if (!loading && restaurant && !customerName && !showCustomerDialog) {
      const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
      if (!savedName) {
        setShowCustomerDialog(true);
      }
    }
  }, [loading, restaurant, customerName, tableNumber, showCustomerDialog, blockLoginForReview, reviewModalOpen]);

  useEffect(() => {
    
    // 🚨 PRIMEIRA PRIORIDADE: Verificar se é um logout forçado
    const forceLogout = sessionStorage.getItem('forceLogout');
    
    if (forceLogout === 'true') {
      
      // Remover flag
      sessionStorage.removeItem('forceLogout');
      
      // Limpar TUDO relacionado à sessão
      sessionStorage.removeItem(`customer_name_${tableNumber}`);
      sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
      sessionStorage.removeItem(`cart_${tableNumber}`);
      sessionStorage.removeItem(`table_id_${tableNumber}`);
      sessionStorage.removeItem('customerInfo');
      
      // Resetar TODOS os estados para garantir
      setCustomerName("");
      setCustomerCPF("");
      setTableId(null);
      setCart([]);
      setHasOpenComanda(false);
      setComandaTotal(0);
      
      // ⚡ NÃO mostrar dialog aqui - esperar fetchData terminar
      
      // Buscar dados do restaurante
      fetchData();
      
    }
    
    // Tentar restaurar sessão apenas se NÃO foi logout forçado
    if (!forceLogout || forceLogout !== 'true') {
      const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
      const savedCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
      const savedTableId = sessionStorage.getItem(`table_id_${tableNumber}`);
      
      if (savedName && savedCPF) {
        const savedCart = sessionStorage.getItem(`cart_${tableNumber}`);
        if (savedCart) setCart(JSON.parse(savedCart));
        setCustomerName(savedName);
        setCustomerCPF(savedCPF);
        if (savedTableId) setTableId(savedTableId);
        fetchData();
      } else {
        sessionStorage.removeItem(`cart_${tableNumber}`);
        sessionStorage.removeItem(`table_id_${tableNumber}`);
        setCart([]);
        // ⚡ NÃO mostrar dialog aqui - esperar fetchData terminar
        fetchData();
      }
    }
    
    // Configurar realtime (sempre, independente de logout)
    const savedCustomerInfo = sessionStorage.getItem("customerInfo");
    const currentCustomer = savedCustomerInfo ? JSON.parse(savedCustomerInfo) : null;
    
    const channel = supabase.channel('menu-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'products'
      }, () => {
        if (restaurantRef.current?.id) {
          fetchData();
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'restaurants',
        filter: `slug=eq.${restaurantSlug}`
      }, (payload) => {
        const updatedRestaurant = payload.new as any;
        
        setRestaurant((prev: any) => ({...prev, ...updatedRestaurant}));
        
        // Silenciado para não atrapalhar cliente
      })
      // 🔔 Listener de pedidos com notificações de status (usando refs para evitar stale closures)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders'
      }, (payload) => {
        const order = payload.new as any;
        const oldOrder = payload.old as any;
        
        // Usar refs para obter valores atualizados
        const currentTableId = tableIdRef.current;
        const currentCustomer = customerInfoRef.current;
        
        
        // Verificar se é pedido deste cliente nesta mesa
        if (currentTableId && order.table_id === currentTableId && currentCustomer) {
          const cleanCPF = currentCustomer.cpf?.replace(/\D/g, '');
          
          if (order.customer_cpf === cleanCPF || order.customer_cpf === currentCustomer.cpf) {
            // Notificar mudança de status apenas se mudou
            // Silenciado - notificações de status removidas do cardápio do cliente
          }
        }
        
        // Atualizar dados da comanda usando ref
        if (currentTableId) checkOpenComanda(currentTableId, cart);
      })
      // 🔔 Listener de INSERT em pedidos (usando ref)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders'
      }, () => {
        const currentTableId = tableIdRef.current;
        if (currentTableId) checkOpenComanda(currentTableId, cart);
      })
      // 💳 Listener de contas (bills) UPDATE para detectar pagamento (usando ref)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'bills'
      }, (payload) => {
        const bill = payload.new as any;
        const oldBill = payload.old as any;
        
        const currentTableId = tableIdRef.current;
        
        // Verificar se a conta foi paga e pertence à mesa atual E à comanda do cliente
        if (currentTableId && bill.table_id === currentTableId) {
          // Filtrar por comanda_id para isolamento entre clientes na mesma mesa
          const myComandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
          const billBelongsToMe = !myComandaId || bill.comanda_id === myComandaId;
          
          if (billBelongsToMe && bill.status === 'paid' && oldBill?.status !== 'paid') {
            
            setReviewBillId(bill.id);
            setReviewModalOpen(true);
          }
        }
      })
      // 💳 Listener de contas (bills) INSERT para detectar pagamento direto pelo PDV (usando ref)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bills'
      }, (payload) => {
        const bill = payload.new as any;
        
        const currentTableId = tableIdRef.current;
        
        // Quando garçom paga pelo PDV sem cliente pedir conta, INSERT já vem com status='paid'
        if (currentTableId && bill.table_id === currentTableId && bill.status === 'paid') {
          // Filtrar por comanda_id para isolamento entre clientes na mesma mesa
          const myComandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
          const billBelongsToMe = !myComandaId || bill.comanda_id === myComandaId;
          
          if (billBelongsToMe) {
            
            setReviewBillId(bill.id);
            setReviewModalOpen(true);
          }
        }
      })
      // 🚪 Listener de mesa para detectar esvaziamento forçado (admin)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'tables'
      }, (payload) => {
        const table = payload.new as any;
        const oldTable = payload.old as any;
        
        const currentTableId = tableIdRef.current;
        const currentCustomer = customerInfoRef.current;
        
        // Se a mesa atual foi esvaziada (estava ocupada e agora está livre)
        if (currentTableId && table.id === currentTableId && currentCustomer) {
          if (oldTable?.is_occupied === true && table.is_occupied === false) {
            
            // Silenciado para cliente
            
            // Limpar sessão do cliente
            sessionStorage.removeItem("customerInfo");
            sessionStorage.removeItem(`comanda_id_${tableNumber}`);
            sessionStorage.removeItem(`cart_${tableNumber}`);
            
            // Resetar estados
            setCustomerName("");
            setCustomerCPF("");
            setCart([]);
            setHasOpenComanda(false);
            setComandaTotal(0);
            
            // Mostrar dialog de login novamente
            setShowCustomerDialog(true);
          }
        }
      })
      .subscribe((status) => {
      });
      
    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [fetchData, restaurantSlug, tableNumber]);

  // 🔒 Revalidar sessão ao voltar do background (visibilitychange + focus)
  useEffect(() => {
    const revalidateSession = async () => {
      const comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
      const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
      
      if (!comandaId || !savedName) return;
      
      try {
        const { data: comanda } = await supabase
          .from("comandas")
          .select("status")
          .eq("id", comandaId)
          .maybeSingle();
        
        if (!comanda || comanda.status === "closed") {
          
          const { data: paidBill } = await supabase
            .from("bills")
            .select("id")
            .eq("comanda_id", comandaId)
            .eq("status", "paid")
            .limit(1)
            .maybeSingle();
          
          if (paidBill) {
            sessionStorage.setItem('shouldShowReview', 'true');
            sessionStorage.setItem('reviewBillId', paidBill.id);
          }
          
          sessionStorage.removeItem(`customer_name_${tableNumber}`);
          sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
          sessionStorage.removeItem(`cart_${tableNumber}`);
          sessionStorage.removeItem(`comanda_id_${tableNumber}`);
          sessionStorage.removeItem(`table_id_${tableNumber}`);
          sessionStorage.removeItem("customerInfo");
          
          window.location.reload();
          return;
        }
        
        const savedTableId = sessionStorage.getItem(`table_id_${tableNumber}`);
        if (savedTableId) {
          const { data: table } = await supabase
            .from("tables")
            .select("is_occupied")
            .eq("id", savedTableId)
            .maybeSingle();
          
          if (table && !table.is_occupied) {
            
            sessionStorage.removeItem(`customer_name_${tableNumber}`);
            sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
            sessionStorage.removeItem(`cart_${tableNumber}`);
            sessionStorage.removeItem(`comanda_id_${tableNumber}`);
            sessionStorage.removeItem(`table_id_${tableNumber}`);
            sessionStorage.removeItem("customerInfo");
            
            window.location.reload();
            return;
          }
        }
      } catch (err) {
        console.error('Erro ao revalidar sessão:', err);
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateSession();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', revalidateSession);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', revalidateSession);
    };
  }, [tableNumber]);

  useEffect(() => {
    // ✅ Só salvar se temos dados válidos (não strings vazias)
    if (customerName && customerName.trim() !== "" && 
        customerCPF && customerCPF.trim() !== "") {
      sessionStorage.setItem(`cart_${tableNumber}`, JSON.stringify(cart));
    }
  }, [cart, tableNumber, customerName, customerCPF]);

  // ⚡ Listener de beforeunload para limpar mesa
  // IMPORTANTE: Só libera mesa se NÃO houver comandas ativas, pedidos ativos OU bills não pagas
  useEffect(() => {
    const checkAndReleaseTa = async (currentTableId: string) => {
      // Verificar se há bills não pagas (requested, on_the_way, pending)
      const { data: hasUnpaidBills } = await supabase
        .from("bills")
        .select("id")
        .eq("table_id", currentTableId)
        .in("status", ["requested", "on_the_way", "pending"])
        .limit(1);

      // Verificar se há comandas ativas
      const { data: hasActiveComandas } = await supabase
        .from("comandas")
        .select("id")
        .eq("table_id", currentTableId)
        .eq("status", "active")
        .limit(1);

      // Verificar se há pedidos ativos
      const { data: hasActiveOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", currentTableId)
        .in("status", ["pending", "accepted", "preparing", "ready"])
        .limit(1);

      // Só liberar mesa se NÃO houver nenhuma condição ativa
      const shouldKeepOccupied = 
        (hasUnpaidBills && hasUnpaidBills.length > 0) ||
        (hasActiveComandas && hasActiveComandas.length > 0) ||
        (hasActiveOrders && hasActiveOrders.length > 0);

      if (!shouldKeepOccupied) {
        await supabase.from("tables").update({
          is_occupied: false,
          occupied_at: null,
          occupied_by: null
        }).eq("id", currentTableId);
      }
    };

    const handleBeforeUnload = () => {
      if (tableId) {
        // Não podemos usar async/await aqui, então usamos navigator.sendBeacon ou ignoramos
        // O cleanup no return vai cuidar disso
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (tableId) {
        checkAndReleaseTa(tableId);
      }
    };
  }, [tableId, customerName, customerCPF]);

  const handleCompleteLogout = useCallback(async () => {
    
    // IMPORTANTE: Fechar a comanda no banco ANTES de limpar a sessão
    const comandaId = sessionStorage.getItem(`comanda_id_${tableNumber}`);
    if (comandaId) {
      try {
        const { error } = await supabase
          .from("comandas")
          .update({
            status: "closed",
            closed_at: new Date().toISOString()
          })
          .eq("id", comandaId);
        
        if (error) {
          console.error("Erro ao fechar comanda:", error);
        } else {
        }
      } catch (err) {
        console.error("Erro ao fechar comanda:", err);
      }
    }
    
    // Limpar TODOS os estados
    setCustomerName("");
    setCustomerCPF("");
    setTableId(null);
    setCart([]);
    setHasOpenComanda(false);
    setComandaTotal(0);
    setReviewModalOpen(false);
    setReviewBillId(undefined);
    setReviewOrderId(undefined);
    setReviewCounterOrderId(undefined);
    
    // Limpar sessionStorage
    sessionStorage.removeItem(`customer_name_${tableNumber}`);
    sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
    sessionStorage.removeItem(`cart_${tableNumber}`);
    sessionStorage.removeItem(`table_id_${tableNumber}`);
    sessionStorage.removeItem(`comanda_id_${tableNumber}`);
    sessionStorage.removeItem('customerInfo');
    sessionStorage.removeItem('shouldShowReview');
    sessionStorage.removeItem('reviewBillId');
    sessionStorage.removeItem('reviewCounterOrderId');
    sessionStorage.removeItem('forceLogout');
    
    // Forçar dialog de login
    setShowCustomerDialog(true);
    
    // Silenciado
  }, [tableNumber]);

  const handleCustomerInfoSubmit = async (name: string, cpf: string, phone?: string) => {
    
    // Validação de CPF
    if (!cpf || cpf.trim() === '') {
      console.error('❌ CPF não recebido ou vazio!');
      toast.error("CPF é obrigatório");
      return;
    }
    
    if (!restaurant || !tableNumber) {
      console.error('❌ Dados não carregados:', { restaurant: !!restaurant, tableNumber });
      toast.error("Aguarde o carregamento dos dados...");
      return;
    }

    // Limpar CPF uma vez no início
    const cleanCpf = cpf.replace(/\D/g, '');

    try {
      // Check if customer exists in database - use saved name, ignore typed name
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("restaurant_id", restaurant.id)
        .eq("cpf", cleanCpf)
        .maybeSingle();
      
      const finalName = existingCustomer ? existingCustomer.name : name;
      const finalPhone = existingCustomer?.phone || phone;
      
      // Update phone if new one provided and customer exists but has no phone
      if (existingCustomer && phone && !existingCustomer.phone) {
        await supabase
          .from("customers")
          .update({ phone })
          .eq("restaurant_id", restaurant.id)
          .eq("cpf", cleanCpf);
      }
      

      // ⚡ Suportar AMBOS: table_number (int) OU id (UUID)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableNumber);
      
      let tableData;
      let tableError;
      
      if (isUUID) {
        const result = await supabase
          .from("tables")
          .select("id, is_occupied, occupied_by, table_number")
          .eq("restaurant_id", restaurant.id)
          .eq("id", tableNumber)
          .single();
        tableData = result.data;
        tableError = result.error;
      } else {
        const result = await supabase
          .from("tables")
          .select("id, is_occupied, occupied_by, table_number")
          .eq("restaurant_id", restaurant.id)
          .eq("table_number", parseInt(tableNumber))
          .single();
        tableData = result.data;
        tableError = result.error;
      }

      if (tableError || !tableData) {
        console.error('❌ Mesa não encontrada:', tableError);
        toast.error("Mesa não encontrada");
        return;
      }
      

      // Verificar se este cliente já tem comanda ativa nesta mesa
      const { data: existingComanda } = await supabase
        .from("comandas")
        .select("id")
        .eq("table_id", tableData.id)
        .eq("customer_cpf", cleanCpf)
        .eq("status", "active")
        .maybeSingle();

      let comandaId: string | undefined;

      if (existingComanda) {
        // Cliente já tem comanda ativa - usar a existente
        comandaId = existingComanda.id;
      } else {
        // Criar nova comanda para este cliente (NÃO fechar as outras)
        const { data: newComanda, error: comandaError } = await supabase
          .from("comandas")
          .insert({
            restaurant_id: restaurant.id,
            table_id: tableData.id,
            customer_name: finalName,
            customer_cpf: cleanCpf,
            status: "active"
          })
          .select("id")
          .single();

        if (comandaError) {
          console.error("Erro ao criar comanda:", comandaError);
        } else {
          comandaId = newComanda.id;
        }
      }

      // Contar comandas ativas na mesa para atualizar occupied_by
      const { count: activeCount } = await supabase
        .from("comandas")
        .select("*", { count: "exact", head: true })
        .eq("table_id", tableData.id)
        .eq("status", "active");

      const clientCount = activeCount || 1;
      const occupiedByText = clientCount === 1 
        ? `${finalName}` 
        : `${clientCount} clientes`;

      // Atualizar mesa como ocupada
      const { error: updateError } = await supabase
        .from("tables")
        .update({
          is_occupied: true,
          occupied_at: tableData.is_occupied ? tableData.occupied_at : new Date().toISOString(),
          occupied_by: occupiedByText,
        })
        .eq("id", tableData.id);

      if (updateError) throw updateError;

      // Salvar dados no sessionStorage
      sessionStorage.setItem(`customer_name_${tableNumber}`, finalName);
      sessionStorage.setItem(`customer_cpf_${tableNumber}`, cleanCpf);
      sessionStorage.setItem(`table_id_${tableNumber}`, tableData.id);
      sessionStorage.setItem("customerInfo", JSON.stringify({ name: finalName, cpf: cleanCpf }));
      if (comandaId) {
        sessionStorage.setItem(`comanda_id_${tableNumber}`, comandaId);
      }
      
      // Atualizar estados
      setCustomerName(finalName);
      setCustomerCPF(cleanCpf);
      setTableId(tableData.id);
      setShowCustomerDialog(false);
      
      // Silenciado - sem toast de boas-vindas
      
      // Carregar dados
      fetchData();
    } catch (error) {
      console.error("Erro ao registrar cliente:", error);
      toast.error("Erro ao fazer login");
    }
  };

  const handleProductClick = useCallback(async (product: Product) => {
    if (!customerName || !customerCPF) {
      // Não abrir novamente se já está aberto
      if (!showCustomerDialog) {
        setShowCustomerDialog(true);
      }
      return;
    }
    // Buscar extras diretos do produto
    const { data: extrasData } = await supabase.from("product_extras")
      .select("id, name, description, price, is_required, min_selection, max_selection, extra_category_id, extra_categories(name)")
      .eq("product_id", product.id);

    // Map extra_category_name from joined data
    const extrasWithCategoryName = (extrasData || []).map((e: any) => ({
      ...e,
      extra_category_name: e.extra_categories?.name || undefined,
      extra_categories: undefined,
    }));

    // Buscar complementos vinculados via product_complement_groups
    const { data: complementGroups } = await supabase
      .from("product_complement_groups")
      .select("*, extra_categories(id, name, extra_category_items(id, name, description, price))")
      .eq("product_id", product.id)
      .order("display_order");

    // Converter complementos para o formato de ProductExtra
    const complementExtras: ProductExtra[] = (complementGroups || []).flatMap((group: any) => {
      const items = group.extra_categories?.extra_category_items || [];
      return items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || null,
        price: item.price,
        is_required: group.is_required || false,
        min_selection: group.min_selection || 0,
        max_selection: group.max_selection || undefined,
        extra_category_id: group.extra_category_id,
        extra_category_name: group.extra_categories?.name || undefined,
        is_complement: true,
      }));
    });

    const allExtras = [...extrasWithCategoryName, ...complementExtras];
    setSelectedProduct(product);
    setProductExtras(allExtras);
    setShowProductDialog(true);
  }, [customerName, customerCPF, showCustomerDialog]);

  const addToCart = useCallback((product: Product, extras: ProductExtra[], notes?: string, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        JSON.stringify(item.extras.map(e => e.id).sort()) === JSON.stringify(extras.map(e => e.id).sort()) &&
        item.notes === notes
      );
      if (existing) {
        return prev.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { id: crypto.randomUUID(), product, quantity, extras, notes }];
    });
    // Silenciado - sem toast ao adicionar ao carrinho
  }, []);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => prev.map((item) => 
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ).filter((item) => item.quantity > 0));
  };

  const getCartTotal = () => cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const effectivePrice = item.product.promotional_price ?? item.product.price;
    return sum + (effectivePrice + extrasTotal) * item.quantity;
  }, 0);

  const getTotalItemCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }


  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Restaurante não encontrado</p>
      </div>
    );
  }

  const primaryColor = restaurant.primary_color || "#fe9516";
  const allProducts = categories.flatMap((c) => c.products);

  // Filtrar produtos pela busca
  const filteredCategories = searchQuery.trim() 
    ? categories.map(cat => ({
        ...cat,
        products: cat.products.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.products.length > 0)
    : categories;

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allProducts;

  const cartItemCount = getTotalItemCount();

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Fixed header area */}
      <div className="relative shrink-0">
        <div className="h-48 overflow-hidden relative">
          {restaurant.banner_url ? (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${restaurant.banner_url})` }}
            />
          ) : restaurant.logo_url ? (
            <div
              className="w-full h-full bg-cover bg-center"
              style={{ backgroundImage: `url(${restaurant.logo_url})` }}
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ backgroundColor: primaryColor }}
            />
          )}
        </div>

        <MenuHeader 
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          onSearchClick={() => setSearchOpen(true)}
          onSearchChange={setSearchQuery}
          onSearchClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
        />

        <RestaurantInfoCard
          restaurantId={restaurant.id}
          name={restaurant.name}
          logoUrl={restaurant.logo_url}
          primaryColor={primaryColor}
          tableInfo={`Mesa ${tableNumber}`}
          deliveryTime=""
          deliveryFee={0}
        />
      </div>

      {/* Restaurant closed banner */}
      {!restaurant.is_open && (
        <div className="shrink-0 mx-4 mt-2 mb-1 px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-center gap-3">
          <Clock className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive/80">
            Restaurante fechado no momento. Não é possível realizar pedidos.
          </p>
        </div>
      )}

      {/* Scrollable product content */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ paddingBottom: customerName ? '80px' : '0px' }}>

      {searchQuery.trim() ? (
        <div className="px-4 py-6">
          <h2 className="text-lg font-semibold mb-4">Resultados da busca</h2>
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.filter(p => p.available).map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="aspect-square bg-muted">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                    <p className="text-lg font-bold" style={{ color: primaryColor }}>
                      R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Nenhum produto encontrado para "{searchQuery}"
            </p>
          )}
        </div>
      ) : (
        <>
          <CategoryNav
            categories={filteredCategories}
            primaryColor={primaryColor}
          />

          {featuredProducts.length > 0 && (
            <FeaturedProducts
              products={featuredProducts}
              primaryColor={primaryColor}
              onProductClick={handleProductClick}
              title={featuredSectionTitle}
            />
          )}

          {featuredProducts.length === 0 && <div className="h-6" />}

          <CategoryProducts
            categories={filteredCategories}
            primaryColor={primaryColor}
            onProductClick={handleProductClick}
            showNav={false}
          />
        </>
      )}
      </div>

      {/* Barra de comanda - sempre visível no modo consumo local quando cliente está logado */}
      {customerName && (
        <ComandaBottomBar
          total={getCartTotal()}
          primaryColor={primaryColor}
          status={comandaStatus}
          isVisible={showComandaBar && !showProductDialog}
          hasSubmittedOrders={hasOpenComanda}
          cartItemCount={cartItemCount}
          onViewComanda={() => navigate(`/${restaurantSlug}/comanda/${tableNumber}`)}
        />
      )}

      <CustomerInfoDialog
        open={showCustomerDialog}
        onClose={() => {}} 
        onSubmit={handleCustomerInfoSubmit}
        restaurantColor={primaryColor}
        restaurantId={restaurant?.id}
        requireName={restaurant?.login_require_name ?? true}
        requirePhone={restaurant?.login_require_phone ?? false}
      />

      <ProductDetailDrawer
        product={selectedProduct}
        extras={productExtras}
        open={showProductDialog}
        onClose={() => {
          setShowProductDialog(false);
          setSelectedProduct(null);
        }}
        onAddToCart={addToCart}
        restaurantName={restaurant.name}
        restaurantLogo={restaurant.logo_url}
        primaryColor={primaryColor}
        deliveryTime={`${restaurant.prep_time_minutes || 50}-${(restaurant.prep_time_minutes || 50) + 10} min`}
        deliveryFee={0}
      />

      <CartDrawer
        open={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        items={cart}
        restaurantName={restaurant.name}
        restaurantLogo={restaurant.logo_url}
        primaryColor={primaryColor}
        onUpdateQuantity={updateQuantity}
        onClearCart={() => {
          setCart([]);
          toast.success("Comanda limpa");
        }}
        onAddMoreItems={() => setShowCartDrawer(false)}
        onContinue={() => {
          setShowCartDrawer(false);
          navigate(`/${restaurantSlug}/comanda/${tableNumber}`);
        }}
        mode="local"
      />

      <ReviewModal
        open={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewOrderId(undefined);
          setReviewCounterOrderId(undefined);
          setReviewBillId(undefined);
          setBlockLoginForReview(false); // Liberar para mostrar login agora
          // ✅ Logout completo após fechar avaliação
          handleCompleteLogout();
        }}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        orderId={reviewOrderId}
        counterOrderId={reviewCounterOrderId}
        billId={reviewBillId}
      />
    </div>
  );
};

export default Menu;
