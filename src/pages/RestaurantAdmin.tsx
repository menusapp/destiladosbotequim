import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DevelopmentPlaceholder } from "@/components/admin/DevelopmentPlaceholder";
import { ReportsTab } from "@/components/admin/ReportsTab";
import PedidosTab from "@/components/admin/PedidosTab";
import LocalOrdersTab from "@/components/admin/LocalOrdersTab";
import CardapioTab from "@/components/admin/CardapioTab";
import TablesTab from "@/components/admin/TablesTab";
import SettingsTab from "@/components/admin/SettingsTab";
import StockTab from "@/components/admin/StockTab";
import FluxoCaixaTab from "@/components/admin/FluxoCaixaTab";
import BalcaoTab from "@/components/admin/BalcaoTab";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { NewOrderNotification } from "@/components/admin/NewOrderNotification";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  prep_time_minutes: number;
  pickup_time_minutes: number;
}

const RestaurantAdmin = () => {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [hasNewBills, setHasNewBills] = useState(false);
  const [hasNewDeliveryOrders, setHasNewDeliveryOrders] = useState(false);
  const [globalNotification, setGlobalNotification] = useState<{
    orderId: string;
    customerName: string;
    total: number;
    orderType: 'local' | 'delivery';
    tableNumber?: number;
    deliveryType?: 'delivery' | 'pickup';
  } | null>(null);
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set());
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const [pendingOrderToOpen, setPendingOrderToOpen] = useState<string | null>(null);
  
  // Sync ref with state to avoid stale closure in realtime callback
  useEffect(() => {
    notifiedOrdersRef.current = notifiedOrders;
  }, [notifiedOrders]);
  
  useInactivityLogout();

  useEffect(() => {
    const restaurantId = localStorage.getItem('restaurant_id');
    const restaurantName = localStorage.getItem('restaurant_name');
    
    if (!restaurantId || !restaurantName) {
      toast.error("Você precisa estar logado para acessar esta página");
      navigate("/");
      return;
    }

    fetchRestaurant(restaurantId);
    setupNotifications(restaurantId);
  }, [navigate]);

  const setupNotifications = (restaurantId: string) => {
    // Load notified orders from localStorage
    const stored = localStorage.getItem("notifiedGlobalOrders");
    if (stored) {
      const storedSet = new Set<string>(JSON.parse(stored));
      setNotifiedOrders(storedSet);
      notifiedOrdersRef.current = storedSet;
    }

    // Canal para novos pedidos
    const ordersChannel = supabase
      .channel('new-orders-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          const order = payload.new as any;
          const orderRestaurantId = order.restaurant_id;
          const orderType = order.order_type;
          const orderId = order.id;
          const status = order.status;
          
          // Verificar diretamente pelo restaurant_id do pedido e status pending
          if (orderRestaurantId === restaurantId && status === 'pending') {
            // Verificar se já foi notificado (usar ref para evitar stale closure)
            if (notifiedOrdersRef.current.has(orderId)) return;

            // Buscar detalhes completos do pedido para calcular total
            const { data: orderData } = await supabase
              .from('orders')
              .select(`
                *,
                order_items(
                  price_at_order,
                  quantity,
                  order_item_extras(price_at_order)
                )
              `)
              .eq('id', orderId)
              .single();

            if (orderData) {
              const total = orderData.order_items.reduce((sum: number, item: any) => {
                const extrasTotal = item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0;
                return sum + (item.price_at_order + extrasTotal) * item.quantity;
              }, 0);

              // Buscar número da mesa para pedidos locais
              let tableNumber: number | undefined;
              if (order.table_id) {
                const { data: tableData } = await supabase
                  .from('tables')
                  .select('table_number')
                  .eq('id', order.table_id)
                  .single();
                tableNumber = tableData?.table_number;
              }

              // Mostrar notificação global
              setGlobalNotification({
                orderId: orderId,
                customerName: order.customer_name,
                total,
                orderType: orderType === 'delivery' ? 'delivery' : 'local',
                tableNumber,
                deliveryType: order.delivery_type as 'delivery' | 'pickup' | undefined,
              });

              // Marcar como notificado (atualizar ref e state)
              const updated = new Set(notifiedOrdersRef.current);
              updated.add(orderId);
              notifiedOrdersRef.current = updated;
              setNotifiedOrders(updated);
              localStorage.setItem("notifiedGlobalOrders", JSON.stringify(Array.from(updated)));
            }

            // Atualizar badges da sidebar
            if (orderType === 'delivery' && activeSection !== 'pedidos-online') {
              setHasNewDeliveryOrders(true);
            } else if ((orderType === 'local' || !orderType) && activeSection !== 'pedidos-locais') {
              setHasNewOrders(true);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const order = payload.new as any;
          const orderId = order.id;
          const status = order.status;
          
          // Se o pedido foi aceito/mudou de status, fechar notificação
          if (globalNotification && globalNotification.orderId === orderId && status !== 'pending') {
            setGlobalNotification(null);
          }
        }
      )
      .subscribe();

    // Canal para novas contas
    const billsChannel = supabase
      .channel('new-bills-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bills',
        },
        (payload) => {
          // Verificar se a conta é do restaurante atual através da mesa
          supabase
            .from('tables')
            .select('restaurant_id')
            .eq('id', (payload.new as any).table_id)
            .single()
            .then(({ data }) => {
              if (data?.restaurant_id === restaurantId && activeSection !== 'pedidos-locais') {
                setHasNewBills(true);
                toast.info("Nova conta solicitada!");
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(billsChannel);
    };
  };

  useEffect(() => {
    // Limpar notificações quando mudar de seção
    if (activeSection === 'pedidos-locais') {
      setHasNewOrders(false);
      setHasNewBills(false);
    }
    if (activeSection === 'pedidos-online') {
      setHasNewDeliveryOrders(false);
    }
  }, [activeSection]);

  const fetchRestaurant = async (restaurantId: string) => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;
      setRestaurant(data);
    } catch (error) {
      toast.error("Erro ao carregar dados do restaurante");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('restaurant_id');
    localStorage.removeItem('restaurant_name');
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

  const handleToggleRestaurant = async (isOpen: boolean) => {
    console.log('🏪 Mudando status do restaurante:', { isOpen, restaurantId: restaurant!.id });
    
    const { error } = await supabase
      .from("restaurants")
      .update({ is_open: isOpen })
      .eq("id", restaurant!.id);

    if (error) {
      console.error('❌ Erro ao atualizar:', error);
      toast.error("Erro ao atualizar status do restaurante");
      return;
    }

    console.log('✅ Status do restaurante atualizado com sucesso!');
    setRestaurant({ ...restaurant!, is_open: isOpen });
    toast.success(isOpen ? "Restaurante aberto! 🎉" : "Restaurante fechado! 🔒");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sem sessão ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Faça login para acessar o painel do restaurante.
            </p>
            <Button onClick={() => navigate("/")}>Ir para Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleViewOrder = () => {
    if (!globalNotification) return;

    // Navegar para a aba correta
    if (globalNotification.orderType === 'delivery') {
      setActiveSection('pedidos-online');
    } else {
      setActiveSection('pedidos-locais');
    }

    // Definir o pedido a ser aberto
    setPendingOrderToOpen(globalNotification.orderId);

    // Fechar notificação
    setGlobalNotification(null);
  };

  const renderContent = () => {
    switch (activeSection) {
      // Pedidos Online (apenas delivery/retirada)
      case "pedidos-online":
        return <PedidosTab restaurantId={restaurant.id} pendingOrderToOpen={pendingOrderToOpen} onOrderOpened={() => setPendingOrderToOpen(null)} />;
      
      // Pedidos Locais (mesas e comandas)
      case "pedidos-locais":
        return <LocalOrdersTab restaurantId={restaurant.id} pendingOrderToOpen={pendingOrderToOpen} onOrderOpened={() => setPendingOrderToOpen(null)} />;
      
      // PDV (Balcão)
      case "pdv":
        return <BalcaoTab restaurantId={restaurant.id} />;
      
      // Mesas e Comandas
      case "mesas-comandas":
        return <TablesTab restaurantId={restaurant.id} />;
      
      // Cardápio
      case "cardapio":
        return <CardapioTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />;
      
      // Caixa
      case "caixa":
        return <FluxoCaixaTab restaurantId={restaurant.id} />;
      
      // Estoque
      case "estoque":
        return <StockTab restaurantId={restaurant.id} />;
      
      // Relatórios
      case "relatorios":
        return <ReportsTab restaurantId={restaurant.id} />;
      
      // Em Desenvolvimento
      case "entregadores":
        return <DevelopmentPlaceholder title="Entregadores" />;
      case "marketing":
        return <DevelopmentPlaceholder title="Marketing" />;
      case "clientes":
        return <DevelopmentPlaceholder title="Clientes" />;
      case "configuracoes":
        return <SettingsTab restaurantId={restaurant.id} />;
      case "modulos":
        return <DevelopmentPlaceholder title="Módulos e Assinaturas" />;
      
      default:
        return <PedidosTab restaurantId={restaurant.id} pendingOrderToOpen={pendingOrderToOpen} onOrderOpened={() => setPendingOrderToOpen(null)} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          hasNewOrders={hasNewOrders}
          hasNewBills={hasNewBills}
          hasNewDeliveryOrders={hasNewDeliveryOrders}
        />
        <SidebarInset className="flex-1 flex flex-col">
          <AdminHeader
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            prepTime={restaurant.prep_time_minutes}
            pickupTime={restaurant.pickup_time_minutes}
            onPrepTimeUpdate={(time) => setRestaurant({ ...restaurant, prep_time_minutes: time })}
            onPickupTimeUpdate={(time) => setRestaurant({ ...restaurant, pickup_time_minutes: time })}
          />
          <main className="flex-1 overflow-auto p-6">
            {renderContent()}
          </main>
        </SidebarInset>

        {/* Global Notification */}
        {globalNotification && (
          <NewOrderNotification
            orderId={globalNotification.orderId}
            customerName={globalNotification.customerName}
            total={globalNotification.total}
            orderType={globalNotification.orderType}
            tableNumber={globalNotification.tableNumber}
            deliveryType={globalNotification.deliveryType}
            onView={handleViewOrder}
            onDismiss={() => setGlobalNotification(null)}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default RestaurantAdmin;
