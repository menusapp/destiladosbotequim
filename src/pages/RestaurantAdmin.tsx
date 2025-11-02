import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { 
  LogOut, 
  Package, 
  TableIcon, 
  ShoppingCart, 
  Receipt, 
  Warehouse, 
  TrendingUp, 
  Wallet, 
  Target,
  Settings,
  CreditCard,
  DollarSign,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ProductsTab from "@/components/admin/ProductsTab";
import TablesTab from "@/components/admin/TablesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import BillsTab from "@/components/admin/BillsTab";
import StockTab from "@/components/admin/StockTab";
import CostosTab from "@/components/admin/CostosTab";
import MargensTab from "@/components/admin/MargensTab";
import FluxoCaixaTab from "@/components/admin/FluxoCaixaTab";
import ConfiguracoesTab from "@/components/admin/ConfiguracoesTab";
import PlanosTab from "@/components/admin/PlanosTab";
import DRETab from "@/components/admin/DRETab";
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
  const [activeGroup, setActiveGroup] = useState("financeiro");
  const [activeSubTab, setActiveSubTab] = useState("custos");
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
          supabase
            .from('tables')
            .select('restaurant_id')
            .eq('id', (payload.new as any).table_id)
            .single()
            .then(({ data }) => {
              if (data?.restaurant_id === restaurantId && activeGroup !== 'operacional') {
                setHasNewOrders(true);
                toast.info("Novo pedido recebido!");
              }
            });
        }
      )
      .subscribe();

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
          supabase
            .from('tables')
            .select('restaurant_id')
            .eq('id', (payload.new as any).table_id)
            .single()
            .then(({ data }) => {
              if (data?.restaurant_id === restaurantId && activeGroup !== 'operacional') {
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
    if (activeGroup === 'operacional' && activeSubTab === 'pedidos') {
      setHasNewOrders(false);
    }
    if (activeGroup === 'operacional' && activeSubTab === 'contas') {
      setHasNewBills(false);
    }
  }, [activeGroup, activeSubTab]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full shadow-md">
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

  const menuGroups = [
    {
      id: "financeiro",
      label: "💰 Financeiro",
      icon: DollarSign,
      tabs: [
        { id: "custos", label: "Custos" },
        { id: "margens", label: "Margens" },
        { id: "caixa", label: "Caixa" },
        { id: "dre", label: "DRE" },
      ]
    },
    {
      id: "operacional",
      label: "⚙️ Operacional",
      icon: Settings,
      tabs: [
        { id: "mesas", label: "Mesas" },
        { id: "pedidos", label: "Pedidos" },
        { id: "contas", label: "Contas" },
      ]
    },
    {
      id: "gestao",
      label: "📋 Gestão de Itens",
      icon: Package,
      tabs: [
        { id: "produtos", label: "Produtos" },
        { id: "estoque", label: "Estoque" },
      ]
    },
    {
      id: "administrativo",
      label: "🧾 Administrativo",
      icon: FileText,
      tabs: [
        { id: "configuracoes", label: "Configurações" },
        { id: "planos", label: "Planos" },
      ]
    },
  ];

  const renderTabContent = () => {
    if (!restaurant) return null;

    switch (activeSubTab) {
      case "custos":
        return <CostosTab restaurantId={restaurant.id} />;
      case "margens":
        return <MargensTab restaurantId={restaurant.id} />;
      case "caixa":
        return <FluxoCaixaTab restaurantId={restaurant.id} />;
      case "dre":
        return <DRETab />;
      case "mesas":
        return <TablesTab restaurantId={restaurant.id} />;
      case "pedidos":
        return <OrdersTab restaurantId={restaurant.id} />;
      case "contas":
        return <BillsTab restaurantId={restaurant.id} />;
      case "produtos":
        return <ProductsTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />;
      case "estoque":
        return <StockTab restaurantId={restaurant.id} />;
      case "configuracoes":
        return <ConfiguracoesTab />;
      case "planos":
        return <PlanosTab />;
      default:
        return null;
    }
  };

  const currentGroup = menuGroups.find(g => g.id === activeGroup);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar className="border-r bg-white">
          <SidebarContent>
            <div className="p-6 border-b">
              <h1 className="text-xl font-bold" style={{ color: "#fe9516" }}>
                Menu's
              </h1>
              <p className="text-sm text-muted-foreground">{restaurant.name}</p>
            </div>
            
            <SidebarMenu>
              {menuGroups.map((group) => (
                <SidebarMenuItem key={group.id}>
                  <SidebarMenuButton
                    onClick={() => {
                      setActiveGroup(group.id);
                      setActiveSubTab(group.tabs[0].id);
                    }}
                    isActive={activeGroup === group.id}
                    className="w-full justify-start text-base py-6"
                  >
                    <span>{group.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <div className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">{currentGroup?.label}</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="restaurant-status"
                  checked={restaurant.is_open}
                  onCheckedChange={handleToggleRestaurant}
                />
                <Label htmlFor="restaurant-status" className="cursor-pointer text-sm">
                  {restaurant.is_open ? "Aberto" : "Fechado"}
                </Label>
              </div>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>

          <div className="p-6">
            <Card className="shadow-md rounded-2xl">
              <CardContent className="p-6">
                <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                  <TabsList className="mb-6">
                    {currentGroup?.tabs.map((tab) => (
                      <TabsTrigger 
                        key={tab.id} 
                        value={tab.id}
                        className="relative"
                      >
                        {tab.label}
                        {tab.id === "pedidos" && hasNewOrders && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ backgroundColor: "#fe9516" }}></span>
                        )}
                        {tab.id === "contas" && hasNewBills && (
                          <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ backgroundColor: "#fe9516" }}></span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {currentGroup?.tabs.map((tab) => (
                    <TabsContent key={tab.id} value={tab.id}>
                      {renderTabContent()}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default RestaurantAdmin;
