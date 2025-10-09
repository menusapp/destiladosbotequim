import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut, Package, List, TableIcon, ShoppingCart, BarChart3, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CategoriesTab from "@/components/admin/CategoriesTab";
import ProductsTab from "@/components/admin/ProductsTab";
import TablesTab from "@/components/admin/TablesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import DashboardTab from "@/components/admin/DashboardTab";
import BillsTab from "@/components/admin/BillsTab";

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

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    const restaurantId = sessionStorage.getItem("restaurantId");

    if (userType !== "restaurant" || !restaurantId) {
      // No session in preview: don't redirect, just show inline login card
      setLoading(false);
      return;
    }

    fetchRestaurant(restaurantId);
  }, []);

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
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="dashboard">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="categories">
                  <List className="h-4 w-4 mr-2" />
                  Categorias
                </TabsTrigger>
                <TabsTrigger value="products">
                  <Package className="h-4 w-4 mr-2" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="tables">
                  <TableIcon className="h-4 w-4 mr-2" />
                  Mesas
                </TabsTrigger>
                <TabsTrigger value="orders">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Pedidos
                </TabsTrigger>
                <TabsTrigger value="bills">
                  <Receipt className="h-4 w-4 mr-2" />
                  Contas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <DashboardTab restaurantId={restaurant.id} />
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
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantAdmin;
