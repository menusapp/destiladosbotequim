import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Package, List, TableIcon, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CategoriesTab from "@/components/admin/CategoriesTab";
import ProductsTab from "@/components/admin/ProductsTab";
import TablesTab from "@/components/admin/TablesTab";
import OrdersTab from "@/components/admin/OrdersTab";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

const RestaurantAdmin = () => {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userType = sessionStorage.getItem("userType");
    const restaurantId = sessionStorage.getItem("restaurantId");

    if (userType !== "restaurant" || !restaurantId) {
      navigate("/");
      return;
    }

    fetchRestaurant(restaurantId);
  }, [navigate]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!restaurant) {
    return null;
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
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Gerenciar Restaurante</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="categories" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
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
              </TabsList>

              <TabsContent value="categories">
                <CategoriesTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="products">
                <ProductsTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="tables">
                <TablesTab restaurantId={restaurant.id} />
              </TabsContent>

              <TabsContent value="orders">
                <OrdersTab restaurantId={restaurant.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RestaurantAdmin;
