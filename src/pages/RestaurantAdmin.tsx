import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/admin/AppSidebar";
import ProductsTab from "@/components/admin/ProductsTab";
import TablesTab from "@/components/admin/TablesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import DashboardTab from "@/components/admin/DashboardTab";
import BillsTab from "@/components/admin/BillsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import StockTab from "@/components/admin/StockTab";
import CostosTab from "@/components/admin/CostosTab";
import MargensTab from "@/components/admin/MargensTab";
import FluxoCaixaTab from "@/components/admin/FluxoCaixaTab";
import CMVDashboardTab from "@/components/admin/CMVDashboardTab";
import CategoriesTab from "@/components/admin/CategoriesTab";
import DeliveryTab from "@/components/admin/DeliveryTab";
import DRETab from "@/components/admin/DRETab";
import BalcaoTab from "@/components/admin/BalcaoTab";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
}

const RestaurantAdmin = () => {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [hasNewBills, setHasNewBills] = useState(false);
  
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
        (payload) => {
          // Verificar se o pedido é do restaurante atual através da mesa
          supabase
            .from('tables')
            .select('restaurant_id')
            .eq('id', (payload.new as any).table_id)
            .single()
            .then(({ data }) => {
              if (data?.restaurant_id === restaurantId && activeSection !== 'pedidos') {
                setHasNewOrders(true);
                toast.info("Novo pedido recebido!");
              }
            });
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
              if (data?.restaurant_id === restaurantId && activeSection !== 'comandas') {
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
    if (activeSection === 'pedidos') {
      setHasNewOrders(false);
    }
    if (activeSection === 'comandas') {
      setHasNewBills(false);
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
    const { error } = await supabase
      .from("restaurants")
      .update({ is_open: isOpen })
      .eq("id", restaurant!.id);

    if (error) {
      toast.error("Erro ao atualizar status do restaurante");
      return;
    }

    setRestaurant({ ...restaurant!, is_open: isOpen });
    toast.success(isOpen ? "Restaurante aberto!" : "Restaurante fechado!");
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

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardTab restaurantId={restaurant.id} />;
      
      // Finanças - sub-itens
      case "caixa":
        return <FluxoCaixaTab restaurantId={restaurant.id} />;
      case "custos":
        return <CostosTab restaurantId={restaurant.id} />;
      case "margens":
        return <MargensTab restaurantId={restaurant.id} />;
      case "dre":
        return <DRETab restaurantId={restaurant.id} />;
      
      // Operações - sub-itens
      case "estoque":
        return <StockTab restaurantId={restaurant.id} />;
      case "produtos":
        return <ProductsTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />;
      case "ingredientes":
        return <CategoriesTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />;
      
      // Atendimento - sub-itens
      case "mesas":
        return <TablesTab restaurantId={restaurant.id} />;
      case "pedidos":
        return <OrdersTab restaurantId={restaurant.id} />;
      case "comandas":
        return <BillsTab restaurantId={restaurant.id} />;
      case "balcao":
        return <BalcaoTab restaurantId={restaurant.id} />;
      
      // Delivery - sub-itens
      case "areas-entrega":
        return <DeliveryTab restaurantId={restaurant.id} />;
      case "delivery-config":
        return <DeliveryTab restaurantId={restaurant.id} />;
      
      case "configuracoes":
        return <SettingsTab restaurantId={restaurant.id} />;
      
      default:
        return <DashboardTab restaurantId={restaurant.id} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" style={{ background: "radial-gradient(circle at top left, hsl(0 0% 100%), hsl(40 100% 97% / 0.3))" }}>
        <AppSidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          hasNewOrders={hasNewOrders}
          hasNewBills={hasNewBills}
        />
        <SidebarInset className="flex-1">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white/80 backdrop-blur-sm px-6">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo-menus.png" alt="Menus" className="h-8 w-8" />
                <div>
                  <h1 className="text-lg font-bold text-foreground">Menus</h1>
                  <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant={restaurant?.is_open ? "default" : "outline"}
                  onClick={() => handleToggleRestaurant(!restaurant?.is_open)}
                  className={restaurant?.is_open ? "bg-primary hover:bg-primary-hover" : ""}
                >
                  {restaurant?.is_open ? "Restaurante Aberto" : "Restaurante Fechado"}
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  Sair
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default RestaurantAdmin;
