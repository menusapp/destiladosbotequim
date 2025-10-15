import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, TrendingDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockItem {
  id: string;
  name: string;
  unit: string;
  current_quantity: number;
  minimum_quantity: number;
}

interface ProductWithCost {
  id: string;
  name: string;
  price: number;
  cost: number;
  cmv_percentage: number;
  margin: number;
}

export default function CMVDashboardTab({ restaurantId }: { restaurantId: string }) {
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<ProductWithCost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLowStockItems(), fetchProductsWithCost()]);
    setLoading(false);
  };

  const fetchLowStockItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("id, name, unit, current_quantity, minimum_quantity")
      .eq("restaurant_id", restaurantId)
      .order("current_quantity");

    // Filtrar itens com estoque baixo no client-side
    const lowStock = data?.filter(item => item.current_quantity <= item.minimum_quantity) || [];
    setLowStockItems(lowStock);
  };

  const fetchProductsWithCost = async () => {
    // Buscar produtos com seus ingredientes
    const { data: productsData } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        product_ingredients(
          quantity,
          stock_items(price_per_unit)
        )
      `)
      .eq("product_ingredients.stock_items.restaurant_id", restaurantId);

    if (!productsData) return;

    const productsWithCost: ProductWithCost[] = productsData.map((product: any) => {
      // Calcular custo total do produto
      const cost = product.product_ingredients.reduce((total: number, ing: any) => {
        const price = ing.stock_items?.price_per_unit || 0;
        return total + (ing.quantity * price);
      }, 0);

      const cmv_percentage = product.price > 0 ? (cost / product.price) * 100 : 0;
      const margin = product.price - cost;

      return {
        id: product.id,
        name: product.name,
        price: product.price,
        cost,
        cmv_percentage,
        margin,
      };
    });

    setProducts(productsWithCost);
  };

  const mostProfitable = [...products]
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const leastProfitable = [...products]
    .sort((a, b) => a.margin - b.margin)
    .slice(0, 5);

  const averageCMV = products.length > 0
    ? products.reduce((sum, p) => sum + p.cmv_percentage, 0) / products.length
    : 0;

  if (loading) {
    return <div className="p-4">Carregando dados...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageCMV.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Custo médio dos produtos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Produtos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Com ingredientes configurados
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {lowStockItems.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Insumos abaixo do mínimo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Estoque Baixo */}
      {lowStockItems.length > 0 && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Insumos com Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Atual: {item.current_quantity} {item.unit} | Mínimo: {item.minimum_quantity} {item.unit}
                      </p>
                    </div>
                  </div>
                  <Badge variant="destructive">Crítico</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Mais Rentáveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <TrendingUp className="h-5 w-5" />
            Produtos Mais Rentáveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mostProfitable.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Custo: R$ {product.cost.toFixed(2)} | Venda: R$ {product.price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">R$ {product.margin.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    CMV: {product.cmv_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Produtos Menos Rentáveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <TrendingDown className="h-5 w-5" />
            Produtos Menos Rentáveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leastProfitable.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Custo: R$ {product.cost.toFixed(2)} | Venda: R$ {product.price.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">R$ {product.margin.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    CMV: {product.cmv_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
