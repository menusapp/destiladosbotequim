import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, Package, List, TableIcon, ShoppingCart, BarChart3, Receipt, Settings, Warehouse, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CategoriesTab from "@/components/admin/CategoriesTab";
import ProductsTab from "@/components/admin/ProductsTab";
import TablesTab from "@/components/admin/TablesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import DashboardTab from "@/components/admin/DashboardTab";
import BillsTab from "@/components/admin/BillsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import StockTab from "@/components/admin/StockTab";
import CMVDashboardTab from "@/components/admin/CMVDashboardTab";

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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [hasNewOrders, setHasNewOrders] = useState(false);
  const [hasNewBills, setHasNewBills] = useState(false);

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    const restaurantId = sessionStorage.getItem("restaurantId");

    if (userType !== "restaurant" || !restaurantId) {
      // No session in preview: don't redirect, just show inline login card
      setLoading(false);
      return;
    }

    fetchRestaurant(restaurantId);
    setupNotifications(restaurantId);
  }, []);

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
              if (data?.restaurant_id === restaurantId && activeTab !== 'orders') {
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
              if (data?.restaurant_id === restaurantId && activeTab !== 'bills') {
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
    // Limpar notificações quando mudar de aba
    if (activeTab === 'orders') {
      setHasNewOrders(false);
    }
    if (activeTab === 'bills') {
      setHasNewBills(false);
    }
  }, [activeTab]);

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
    sessionStorage.clear();
    navigate("/");
    toast.success("Logout realizado com sucesso");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {restaurant.name}
            </h1>
            <p className="text-muted-foreground mt-1">Painel Administrativo</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="restaurant-status"
                checked={restaurant.is_open}
                onCheckedChange={handleToggleRestaurant}
              />
              <Label htmlFor="restaurant-status" className="cursor-pointer">
                {restaurant.is_open ? "Aberto" : "Fechado"}
              </Label>
            </div>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Restaurante</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-9 text-xs">
                <TabsTrigger value="faturamento">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Faturamento
                </TabsTrigger>
                <TabsTrigger value="cmv">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  CMV
                </TabsTrigger>
                <TabsTrigger value="stock">
                  <Warehouse className="h-4 w-4 mr-1" />
                  Estoque
                </TabsTrigger>
                <TabsTrigger value="categories">
                  <List className="h-4 w-4 mr-1" />
                  Categorias
                </TabsTrigger>
                <TabsTrigger value="products">
                  <Package className="h-4 w-4 mr-1" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="tables">
                  <TableIcon className="h-4 w-4 mr-1" />
                  Mesas
                </TabsTrigger>
                <TabsTrigger value="orders" className="relative">
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Pedidos
                  {hasNewOrders && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-orange-500 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bills" className="relative">
                  <Receipt className="h-4 w-4 mr-1" />
                  Contas
                  {hasNewBills && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-orange-500 rounded-full"></span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="settings">
                  <Settings className="h-4 w-4 mr-1" />
                  Config
                </TabsTrigger>
              </TabsList>

              <TabsContent value="faturamento">
                <DashboardTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="cmv">
                <CMVDashboardTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="stock">
                <StockTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="categories">
                <CategoriesTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />
              </TabsContent>

              <TabsContent value="products">
                <ProductsTab restaurantId={restaurant.id} isRestaurantOpen={restaurant.is_open} />
              </TabsContent>

              <TabsContent value="tables">
                <TablesTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="orders">
                <OrdersTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="bills">
                <BillsTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="settings">
                <SettingsTab restaurantId={restaurant.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantAdmin;
