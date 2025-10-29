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
  const [targetCMV, setTargetCMV] = useState(30);

  useEffect(() => {
    fetchSettings();
    fetchProductsCost();
  }, [restaurantId]);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("restaurants")
      .select("target_cmv_percentage")
      .eq("id", restaurantId)
      .maybeSingle();
    
    if (data) {
      setTargetCMV(data.target_cmv_percentage || 30);
    }
  };

  const fetchProductsCost = async () => {
    // Buscar produtos com seus ingredientes do restaurante específico
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        category_id,
        categories!inner(restaurant_id),
        product_ingredients(
          quantity,
          stock_items(price_per_unit)
        )
      `)
      .eq("categories.restaurant_id", restaurantId);

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

  const mostProfitable = [...productsWithCost].sort((a, b) => b.margin - a.margin).slice(0, 5);
  const leastProfitable = [...productsWithCost].sort((a, b) => a.margin - b.margin).slice(0, 5);
  const highCMVProducts = productsWithCost.filter(p => p.cmv_percentage > targetCMV);

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
              <p className="text-sm text-muted-foreground">Produtos CMV Alto</p>
              <p className="text-2xl font-bold">{highCMVProducts.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas de CMV Alto */}
      {highCMVProducts.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold">Produtos com CMV Acima do Desejado ({targetCMV}%)</h3>
          </div>
          <div className="space-y-2">
            {highCMVProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span>Custo: R$ {product.cost.toFixed(2)}</span>
                    <span>Venda: R$ {product.price.toFixed(2)}</span>
                    <span>Margem: R$ {product.margin.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="destructive">CMV: {product.cmv_percentage.toFixed(1)}%</Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(product.cmv_percentage - targetCMV).toFixed(1)}% acima
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Produtos mais rentáveis e menos rentáveis - só mostrar se houver produtos */}
      {productsWithCost.length > 0 && (
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
            </div>
          </Card>
        </div>
      )}

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
                <Badge variant={product.cmv_percentage > targetCMV ? "destructive" : "default"}>
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
