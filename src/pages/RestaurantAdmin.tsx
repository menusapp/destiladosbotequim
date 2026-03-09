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
import MarketingTab from "@/components/admin/MarketingTab";
import { ReportsTab } from "@/components/admin/ReportsTab";
import PedidosTab from "@/components/admin/PedidosTab";
import LocalOrdersTab from "@/components/admin/LocalOrdersTab";
import CardapioTab from "@/components/admin/CardapioTab";
import TablesTab from "@/components/admin/TablesTab";
import StockTab from "@/components/admin/StockTab";
import CostosTab from "@/components/admin/CostosTab";
import MargensTab from "@/components/admin/MargensTab";
import FluxoCaixaTab from "@/components/admin/FluxoCaixaTab";
import PDVTab from "@/components/admin/PDVTab";
import ClientesTab from "@/components/admin/ClientesTab";
import FidelityTab from "@/components/admin/FidelityTab";
// ReservasTab removed - unified into TablesTab
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useRestaurantModules } from "@/hooks/useRestaurantModules";
import ModulosTab from "@/components/admin/ModulosTab";
import { NewOrderNotification } from "@/components/admin/NewOrderNotification";
import { NewBillNotification } from "@/components/admin/NewBillNotification";
import { NewReservationNotification } from "@/components/admin/NewReservationNotification";
// Settings sub-tabs
import CompanyDataSettings from "@/components/admin/settings/CompanyDataSettings";
import BusinessHoursSettings from "@/components/admin/settings/BusinessHoursSettings";
import DeliveryZonesSettings from "@/components/admin/settings/DeliveryZonesSettings";
import PaymentMethodsSettings from "@/components/admin/settings/PaymentMethodsSettings";
import PrintersSettings from "@/components/admin/settings/PrintersSettings";
import WhatsAppSettings from "@/components/admin/settings/WhatsAppSettings";
import OnlinePaymentsSettings from "@/components/admin/settings/OnlinePaymentsSettings";
import FiscalTab from "@/components/admin/FiscalTab";
import ContasTab from "@/components/admin/ContasTab";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  prep_time_minutes: number;
  pickup_time_minutes: number;
  auto_open_close?: boolean;
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
  const [billNotification, setBillNotification] = useState<{
    billId: string;
    tableNumber: number;
    total: number;
    customerName: string;
  } | null>(null);
  const [reservationNotification, setReservationNotification] = useState<{
    reservationId: string;
    customerName: string;
    tableName: string;
    date: string;
    time: string;
    partySize: number;
  } | null>(null);
  const [notifiedOrders, setNotifiedOrders] = useState<Set<string>>(new Set());
  const [notifiedBills, setNotifiedBills] = useState<Set<string>>(new Set());
  const [notifiedReservations, setNotifiedReservations] = useState<Set<string>>(new Set());
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  const notifiedBillsRef = useRef<Set<string>>(new Set());
  const notifiedReservationsRef = useRef<Set<string>>(new Set());
  const globalNotificationRef = useRef<typeof globalNotification>(null);
  const billNotificationRef = useRef<typeof billNotification>(null);
  const reservationNotificationRef = useRef<typeof reservationNotification>(null);
  const [pendingOrderToOpen, setPendingOrderToOpen] = useState<string | null>(null);
  
  // Sync refs with state to avoid stale closure in realtime callback
  useEffect(() => {
    notifiedOrdersRef.current = notifiedOrders;
  }, [notifiedOrders]);
  
  useEffect(() => {
    notifiedBillsRef.current = notifiedBills;
  }, [notifiedBills]);
  
  useEffect(() => {
    notifiedReservationsRef.current = notifiedReservations;
  }, [notifiedReservations]);
  
  useEffect(() => {
    globalNotificationRef.current = globalNotification;
  }, [globalNotification]);
  
  useEffect(() => {
    billNotificationRef.current = billNotification;
  }, [billNotification]);

  useEffect(() => {
    reservationNotificationRef.current = reservationNotification;
  }, [reservationNotification]);
  
  useInactivityLogout();
  const { isSectionAllowed, hasActiveSubscription } = useRestaurantModules(restaurant?.id || null);

  // Force "modulos" section when no active subscription
  useEffect(() => {
    if (hasActiveSubscription === false && activeSection !== "modulos") {
      setActiveSection("modulos");
    }
  }, [hasActiveSubscription]);

  // Read staff data from localStorage
  const staffRole = localStorage.getItem('staff_role') || '';
  const staffAllowedSections: string[] = (() => {
    try {
      return JSON.parse(localStorage.getItem('staff_allowed_sections') || '[]');
    } catch { return []; }
  })();

  useEffect(() => {
    const restaurantId = localStorage.getItem('restaurant_id');
    const restaurantName = localStorage.getItem('restaurant_name');
    const staffId = localStorage.getItem('staff_id');
    
    if (!restaurantId || !restaurantName) {
      toast.error("Você precisa estar logado para acessar esta página");
      navigate("/");
      return;
    }

    // If no staff session, redirect to staff login
    if (!staffId) {
      navigate("/staff-login");
      return;
    }

    fetchRestaurant(restaurantId);
    return setupNotifications(restaurantId);
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
          
          // Se o pedido foi aceito/mudou de status, fechar notificação (usar ref para evitar stale closure)
          if (globalNotificationRef.current && globalNotificationRef.current.orderId === orderId && status !== 'pending') {
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
        async (payload) => {
          const bill = payload.new as any;
          const billId = bill.id;
          
          // Verificar se já foi notificado
          if (notifiedBillsRef.current.has(billId)) return;
          
          // Verificar se a conta é do restaurante atual através da mesa
          const { data: tableData } = await supabase
            .from('tables')
            .select('restaurant_id, table_number')
            .eq('id', bill.table_id)
            .single();
            
          if (tableData?.restaurant_id === restaurantId && bill.status === 'requested') {
            // Buscar nome do cliente da comanda ativa
            const { data: comandaData } = await supabase
              .from('comandas')
              .select('customer_name')
              .eq('table_id', bill.table_id)
              .eq('status', 'active')
              .maybeSingle();
            
            // Mostrar notificação pop-up
            setBillNotification({
              billId: billId,
              tableNumber: tableData.table_number,
              total: bill.total_amount,
              customerName: comandaData?.customer_name || 'Cliente',
            });
            
            // Marcar como notificado
            const updated = new Set(notifiedBillsRef.current);
            updated.add(billId);
            notifiedBillsRef.current = updated;
            setNotifiedBills(updated);
            
            // Atualizar badge
            if (activeSection !== 'pedidos-locais') {
              setHasNewBills(true);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bills',
        },
        (payload) => {
          const bill = payload.new as any;
          const billId = bill.id;
          const status = bill.status;
          
          // Se a conta foi atualizada (não mais requested), fechar notificação
          if (billNotificationRef.current && billNotificationRef.current.billId === billId && status !== 'requested') {
            setBillNotification(null);
          }
        }
      )
      .subscribe();

    // Canal para novas reservas
    const reservationsChannel = supabase
      .channel('new-reservations-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reservations',
        },
        async (payload) => {
          const reservation = payload.new as any;
          const reservationId = reservation.id;
          
          // Verificar se já foi notificado
          if (notifiedReservationsRef.current.has(reservationId)) return;
          
          // Verificar se é do restaurante atual e está pendente
          if (reservation.restaurant_id === restaurantId && reservation.status === 'pending') {
            // Buscar dados da mesa
            const { data: tableData } = await supabase
              .from('tables')
              .select('table_name, table_number')
              .eq('id', reservation.table_id)
              .single();
            
            setReservationNotification({
              reservationId: reservationId,
              customerName: reservation.customer_name,
              tableName: tableData?.table_name || `Mesa ${tableData?.table_number || '?'}`,
              date: reservation.reservation_date,
              time: reservation.reservation_time,
              partySize: reservation.party_size,
            });
            
            // Marcar como notificado
            const updated = new Set(notifiedReservationsRef.current);
            updated.add(reservationId);
            notifiedReservationsRef.current = updated;
            setNotifiedReservations(updated);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          const reservation = payload.new as any;
          const reservationId = reservation.id;
          const status = reservation.status;
          
          // Se a reserva foi confirmada/cancelada, fechar notificação
          if (reservationNotificationRef.current && 
              reservationNotificationRef.current.reservationId === reservationId && 
              status !== 'pending') {
            setReservationNotification(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(reservationsChannel);
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
      
      // Verificar horário automaticamente após carregar restaurante
      if (data?.auto_open_close) {
        checkAndUpdateOpenStatus(data);
      }
    } catch (error) {
      toast.error("Erro ao carregar dados do restaurante");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar e atualizar status de abertura baseado no horário
  const checkAndUpdateOpenStatus = async (restaurantData: Restaurant) => {
    if (!restaurantData.auto_open_close) return;

    try {
      // Buscar horários de funcionamento
      const { data: hours, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurantData.id);

      if (error) throw error;

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Domingo, 6 = Sábado
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

      // Encontrar configuração do dia atual
      const todayConfig = hours?.find(h => h.day_of_week === currentDay);

      let shouldBeOpen = false;

      if (todayConfig && todayConfig.is_open && todayConfig.open_time && todayConfig.close_time) {
        // Verificar se está dentro do horário de funcionamento
        shouldBeOpen = currentTime >= todayConfig.open_time && currentTime < todayConfig.close_time;
      }

      // Só atualizar se o status atual for diferente do esperado
      if (restaurantData.is_open !== shouldBeOpen) {
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({ is_open: shouldBeOpen })
          .eq('id', restaurantData.id);

        if (!updateError) {
          setRestaurant(prev => prev ? { ...prev, is_open: shouldBeOpen } : null);
          console.log(`🕐 Status automático: ${shouldBeOpen ? 'Aberto' : 'Fechado'}`);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar horário:', error);
    }
  };

  // Verificar horário a cada minuto quando automação está ativa
  useEffect(() => {
    if (!restaurant?.auto_open_close) return;

    const interval = setInterval(() => {
      checkAndUpdateOpenStatus(restaurant);
    }, 60000); // A cada 1 minuto

    return () => clearInterval(interval);
  }, [restaurant?.id, restaurant?.auto_open_close]);

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

  const handleViewBill = () => {
    if (!billNotification) return;

    // Navegar para pedidos locais
    setActiveSection('pedidos-locais');

    // Fechar notificação
    setBillNotification(null);
  };

  const handleViewReservation = () => {
    if (!reservationNotification) return;

    // Navegar para mesas e reservas
    setActiveSection('mesas-reservas');

    // Fechar notificação
    setReservationNotification(null);
  };

  const renderContent = () => {
    switch (activeSection) {
      // Pedidos Online (apenas delivery/retirada)
      case "pedidos-online":
        return <PedidosTab restaurantId={restaurant.id} pendingOrderToOpen={pendingOrderToOpen} onOrderOpened={() => setPendingOrderToOpen(null)} />;
      
      // Pedidos Locais (mesas e comandas)
      case "pedidos-locais":
        return <LocalOrdersTab restaurantId={restaurant.id} pendingOrderToOpen={pendingOrderToOpen} onOrderOpened={() => setPendingOrderToOpen(null)} />;
      
      // PDV (Balcão + Mesas)
      case "pdv":
        return <PDVTab restaurantId={restaurant.id} />;
      
      // Mesas e Reservas (unified)
      case "mesas-reservas":
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
      
      // Custos
      case "custos":
        return <CostosTab restaurantId={restaurant.id} />;
      
      // Margens
      case "margens":
        return <MargensTab restaurantId={restaurant.id} />;
      
      // Relatórios
      case "relatorios":
        return <ReportsTab restaurantId={restaurant.id} />;
      
      // Clientes
      case "clientes":
        return <ClientesTab restaurantId={restaurant.id} />;
      
      // Fidelidade
      case "fidelidade":
        return <FidelityTab restaurantId={restaurant.id} />;
      
      // Marketing
      case "marketing":
        return <MarketingTab restaurantId={restaurant.id} onNavigateToWhatsApp={() => setActiveSection("config-whatsapp")} />;
      
      // Fiscal (unified: settings + invoices)
      case "fiscal":
        return <FiscalTab restaurantId={restaurant.id} />;
      
      // Em Desenvolvimento
      case "modulos":
        return <ModulosTab restaurantId={restaurant.id} />;
      
      // Configurações - Subabas
      case "config-dados":
        return <CompanyDataSettings restaurantId={restaurant.id} />;
      case "config-horario":
        return <BusinessHoursSettings restaurantId={restaurant.id} />;
      case "config-regioes":
        return <DeliveryZonesSettings restaurantId={restaurant.id} />;
      case "config-pagamentos":
        return <PaymentMethodsSettings restaurantId={restaurant.id} />;
      case "config-pagamentos-online":
        return <OnlinePaymentsSettings restaurantId={restaurant.id} />;
      case "config-impressoras":
        return <PrintersSettings restaurantId={restaurant.id} />;
      case "config-whatsapp":
        return <WhatsAppSettings restaurantId={restaurant.id} />;
      
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
          isSectionAllowed={isSectionAllowed}
          hasActiveSubscription={hasActiveSubscription}
        />
        <SidebarInset className="flex-1 flex flex-col">
          <AdminHeader
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            prepTime={restaurant.prep_time_minutes}
            pickupTime={restaurant.pickup_time_minutes}
            isOpen={restaurant.is_open}
            autoOpenClose={restaurant.auto_open_close}
            onPrepTimeUpdate={(time) => setRestaurant({ ...restaurant, prep_time_minutes: time })}
            onPickupTimeUpdate={(time) => setRestaurant({ ...restaurant, pickup_time_minutes: time })}
            onIsOpenUpdate={(isOpen) => setRestaurant({ ...restaurant, is_open: isOpen })}
          />
          <main className="flex-1 overflow-auto p-4">
            {renderContent()}
          </main>
        </SidebarInset>

        {/* Global Order Notification */}
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
        
        {/* Global Bill Notification */}
        {billNotification && (
          <NewBillNotification
            billId={billNotification.billId}
            tableNumber={billNotification.tableNumber}
            total={billNotification.total}
            customerName={billNotification.customerName}
            onView={handleViewBill}
            onDismiss={() => setBillNotification(null)}
          />
        )}

        {/* Global Reservation Notification */}
        {reservationNotification && (
          <NewReservationNotification
            reservationId={reservationNotification.reservationId}
            customerName={reservationNotification.customerName}
            tableName={reservationNotification.tableName}
            date={reservationNotification.date}
            time={reservationNotification.time}
            partySize={reservationNotification.partySize}
            onView={handleViewReservation}
            onDismiss={() => setReservationNotification(null)}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default RestaurantAdmin;
