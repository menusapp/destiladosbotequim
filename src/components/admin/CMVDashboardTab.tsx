import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductWithCost {
  id: string;
  name: string;
  price: number;
  cost: number;
  cmv_percentage: number;
  margin: number;
}

interface StockAlert {
  id: string;
  name: string;
  current_quantity: number;
  minimum_quantity: number;
  unit: string;
}

export default function CMVDashboardTab({ restaurantId }: { restaurantId: string }) {
  const [productsWithCost, setProductsWithCost] = useState<ProductWithCost[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [avgCMV, setAvgCMV] = useState(0);

  useEffect(() => {
    fetchProductsCost();
    fetchStockAlerts();
  }, [restaurantId]);

  const fetchProductsCost = async () => {
    // Buscar produtos com seus ingredientes
    const { data: products, error: prodError } = await supabase
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

    if (prodError || !products) return;

    const productsData: ProductWithCost[] = products.map((product: any) => {
      const cost = product.product_ingredients?.reduce((sum: number, ing: any) => {
        const ingredientCost = (ing.quantity || 0) * (ing.stock_items?.price_per_unit || 0);
        return sum + ingredientCost;
      }, 0) || 0;

      const cmv = product.price > 0 ? (cost / product.price) * 100 : 0;
      const margin = product.price - cost;

      return {
        id: product.id,
        name: product.name,
        price: product.price,
        cost,
        cmv_percentage: cmv,
        margin,
      };
    });

    setProductsWithCost(productsData);

    // Calcular CMV médio
    const totalCMV = productsData.reduce((sum, p) => sum + p.cmv_percentage, 0);
    setAvgCMV(productsData.length > 0 ? totalCMV / productsData.length : 0);
  };

  const fetchStockAlerts = async () => {
    const { data, error } = await supabase
      .from("stock_items")
      .select("id, name, current_quantity, minimum_quantity, unit")
      .eq("restaurant_id", restaurantId);

    if (error || !data) return;

    const alerts = data.filter(item => item.current_quantity <= item.minimum_quantity);
    setStockAlerts(alerts);
  };

  const mostProfitable = [...productsWithCost].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const leastProfitable = [...productsWithCost].sort((a, b) => a.margin - b.margin).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CMV Médio</p>
              <p className="text-2xl font-bold">{avgCMV.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Produtos Cadastrados</p>
              <p className="text-2xl font-bold">{productsWithCost.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alertas de Estoque</p>
              <p className="text-2xl font-bold">{stockAlerts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas de estoque baixo */}
      {stockAlerts.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold">Insumos com Estoque Baixo</h3>
          </div>
          <div className="space-y-2">
            {stockAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                <div>
                  <p className="font-medium">{alert.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Atual: {alert.current_quantity} {alert.unit} / Mínimo: {alert.minimum_quantity} {alert.unit}
                  </p>
                </div>
                <Badge variant="destructive">Crítico</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Produtos mais rentáveis */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h3 className="text-lg font-semibold">Produtos Mais Rentáveis</h3>
          </div>
          <div className="space-y-3">
            {mostProfitable.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-green-500/5 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>Custo: R$ {product.cost.toFixed(2)}</span>
                    <span>Venda: R$ {product.price.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">+R$ {product.margin.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">CMV: {product.cmv_percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
            {mostProfitable.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum produto com ingredientes cadastrado</p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-orange-500" />
            <h3 className="text-lg font-semibold">Produtos Menos Rentáveis</h3>
          </div>
          <div className="space-y-3">
            {leastProfitable.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-orange-500/5 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>Custo: R$ {product.cost.toFixed(2)}</span>
                    <span>Venda: R$ {product.price.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-600">+R$ {product.margin.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">CMV: {product.cmv_percentage.toFixed(1)}%</p>
                </div>
              </div>
            ))}
            {leastProfitable.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum produto com ingredientes cadastrado</p>
            )}
          </div>
        </Card>
      </div>

      {/* Lista completa de produtos */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Custos Médios por Produto</h3>
        <div className="space-y-2">
          {productsWithCost.map((product) => (
            <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <p className="font-medium">{product.name}</p>
                <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                  <span>Custo: R$ {product.cost.toFixed(2)}</span>
                  <span>Venda: R$ {product.price.toFixed(2)}</span>
                  <span>Margem: R$ {product.margin.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={product.cmv_percentage > 40 ? "destructive" : product.cmv_percentage > 30 ? "secondary" : "default"}>
                  CMV: {product.cmv_percentage.toFixed(1)}%
                </Badge>
              </div>
            </div>
          ))}
          {productsWithCost.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum produto com ingredientes cadastrado. Adicione ingredientes aos produtos na aba Produtos.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
