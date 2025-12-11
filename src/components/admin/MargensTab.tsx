import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Package, Target, Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MargensTabProps {
  restaurantId: string;
}

interface ProductVariation {
  name: string;
  price: number;
  cost: number;
  cmv_percentage: number;
  margin: number;
}

interface ProductWithCost {
  id: string;
  name: string;
  price: number;
  cost: number;
  cmv_percentage: number;
  margin: number;
  hasVariations: boolean;
  variations?: ProductVariation[];
}

export default function MargensTab({ restaurantId }: MargensTabProps) {
  const [products, setProducts] = useState<ProductWithCost[]>([]);
  const [averageCMV, setAverageCMV] = useState(0);
  const [targetCMV, setTargetCMV] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchTargetCMV();
    fetchProductsCost();
  }, [restaurantId]);

  const fetchTargetCMV = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('target_cmv_percentage')
      .eq('id', restaurantId)
      .single();

    if (data) {
      setTargetCMV(data.target_cmv_percentage || 30);
    }
  };

  const fetchProductsCost = async () => {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          categories!inner(restaurant_id)
        `)
        .eq('categories.restaurant_id', restaurantId);

      if (productsError) throw productsError;

      const productsWithCosts: ProductWithCost[] = await Promise.all(
        (productsData || []).map(async (product: any) => {
          // Buscar ingredientes base do produto
          const { data: ingredients } = await supabase
            .from('product_ingredients')
            .select(`
              quantity,
              stock_items(price_per_unit)
            `)
            .eq('product_id', product.id);

          // Buscar extras com is_required para identificar variações
          const { data: extras } = await supabase
            .from('product_extras')
            .select(`
              id,
              name,
              price,
              is_required
            `)
            .eq('product_id', product.id);

          // Calcular custo base (ingredientes fixos)
          let baseCost = 0;
          if (ingredients) {
            for (const ing of ingredients) {
              if (ing.stock_items) {
                baseCost += ing.quantity * ing.stock_items.price_per_unit;
              }
            }
          }

          // Separar variações (is_required = true) de extras opcionais
          const variations = extras?.filter(e => e.is_required) || [];
          const optionalExtras = extras?.filter(e => !e.is_required) || [];

          if (variations.length > 0) {
            // Produto com INSUMOS VARIÁVEIS
            const variationsWithCosts: ProductVariation[] = await Promise.all(
              variations.map(async (variation) => {
                // Buscar ingredientes dessa variação
                const { data: variationIngredients } = await supabase
                  .from('product_extra_ingredients')
                  .select(`
                    quantity,
                    stock_items(price_per_unit)
                  `)
                  .eq('product_extra_id', variation.id);

                let variationCost = baseCost; // Começa com custo base
                if (variationIngredients) {
                  for (const ing of variationIngredients) {
                    if (ing.stock_items) {
                      variationCost += ing.quantity * ing.stock_items.price_per_unit;
                    }
                  }
                }

                const variationPrice = product.price + (variation.price || 0);
                const cmv = variationPrice > 0 ? (variationCost / variationPrice) * 100 : 0;
                const margin = variationPrice - variationCost;

                return {
                  name: variation.name,
                  price: variationPrice,
                  cost: variationCost,
                  cmv_percentage: cmv,
                  margin: margin
                };
              })
            );

            // Calcular média do produto baseado nas variações
            const avgCost = variationsWithCosts.reduce((sum, v) => sum + v.cost, 0) / variationsWithCosts.length;
            const avgPrice = variationsWithCosts.reduce((sum, v) => sum + v.price, 0) / variationsWithCosts.length;
            const avgCMV = variationsWithCosts.reduce((sum, v) => sum + v.cmv_percentage, 0) / variationsWithCosts.length;
            const avgMargin = variationsWithCosts.reduce((sum, v) => sum + v.margin, 0) / variationsWithCosts.length;

            return {
              id: product.id,
              name: product.name,
              price: avgPrice,
              cost: avgCost,
              cmv_percentage: avgCMV,
              margin: avgMargin,
              hasVariations: true,
              variations: variationsWithCosts
            };
          } else {
            // Produto com INSUMOS FIXOS (comportamento original)
            let productCost = baseCost;

            // Adicionar custo de extras opcionais para referência
            for (const extra of optionalExtras) {
              const { data: extraIngredients } = await supabase
                .from('product_extra_ingredients')
                .select(`
                  quantity,
                  stock_items(price_per_unit)
                `)
                .eq('product_extra_id', extra.id);

              if (extraIngredients) {
                for (const ing of extraIngredients) {
                  if (ing.stock_items) {
                    productCost += ing.quantity * ing.stock_items.price_per_unit;
                  }
                }
              }
            }

            const cmv = product.price > 0 ? (baseCost / product.price) * 100 : 0;
            const margin = product.price - baseCost;

            return {
              id: product.id,
              name: product.name,
              price: product.price,
              cost: baseCost,
              cmv_percentage: cmv,
              margin: margin,
              hasVariations: false
            };
          }
        })
      );

      setProducts(productsWithCosts);

      // Calcular CMV médio considerando cada variação individualmente
      let totalCMVItems = 0;
      let cmvCount = 0;
      
      for (const product of productsWithCosts) {
        if (product.hasVariations && product.variations) {
          for (const v of product.variations) {
            totalCMVItems += v.cmv_percentage;
            cmvCount++;
          }
        } else {
          totalCMVItems += product.cmv_percentage;
          cmvCount++;
        }
      }

      setAverageCMV(cmvCount > 0 ? totalCMVItems / cmvCount : 0);
    } catch (error) {
      console.error('Error fetching products cost:', error);
      toast.error('Erro ao carregar custos dos produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTargetCMV = async () => {
    const { error } = await supabase
      .from('restaurants')
      .update({ target_cmv_percentage: targetCMV })
      .eq('id', restaurantId);

    if (error) {
      toast.error('Erro ao salvar CMV desejado');
      return;
    }

    toast.success('CMV desejado atualizado!');
  };

  // Contar produtos com CMV alto (incluindo variações)
  const getHighCMVCount = () => {
    let count = 0;
    for (const product of products) {
      if (product.hasVariations && product.variations) {
        for (const v of product.variations) {
          if (v.cmv_percentage > targetCMV) count++;
        }
      } else {
        if (product.cmv_percentage > targetCMV) count++;
      }
    }
    return count;
  };

  const filteredAndSortedProducts = products
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      return sortOrder === 'desc' ? b.margin - a.margin : a.margin - b.margin;
    });

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newOrder);
    localStorage.setItem('marginSortOrder', newOrder);
  };

  const toggleExpanded = (productId: string) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando margens...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CMV Desejado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            CMV Desejado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label>Percentual Alvo de CMV (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={targetCMV}
                onChange={(e) => setTargetCMV(parseFloat(e.target.value) || 0)}
                placeholder="30"
              />
            </div>
            <Button onClick={handleSaveTargetCMV}>Salvar</Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            {averageCMV > targetCMV ? (
              <TrendingDown className="h-4 w-4 text-destructive" />
            ) : (
              <TrendingUp className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageCMV.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Meta: {targetCMV}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">
              Produtos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Acima da Meta</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {getHighCMVCount()}
            </div>
            <p className="text-xs text-muted-foreground">
              Precisam de atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Análise de Margens por Produto</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleSortOrder}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Margem {sortOrder === 'desc' ? '↓' : '↑'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {filteredAndSortedProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum produto encontrado</p>
            ) : (
              filteredAndSortedProducts.map((product) => (
                <div key={product.id} className="bg-secondary/30 rounded overflow-hidden">
                  {product.hasVariations && product.variations ? (
                    // Produto com variações - expandível
                    <div>
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
                        onClick={() => toggleExpanded(product.id)}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {expandedProducts.has(product.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.variations.length} variações
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                          Variável
                        </Badge>
                      </div>
                      
                      {expandedProducts.has(product.id) && (
                        <div className="border-t border-border/50 bg-background/50">
                          {product.variations.map((variation, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 pl-10 border-b border-border/30 last:border-b-0"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-sm">• {variation.name}</p>
                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                  <span>Custo: R$ {variation.cost.toFixed(2)}</span>
                                  <span>Preço: R$ {variation.price.toFixed(2)}</span>
                                  <span className="font-semibold text-foreground">
                                    Margem: R$ {variation.margin.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              <Badge variant={variation.cmv_percentage > targetCMV ? "destructive" : "default"}>
                                CMV: {variation.cmv_percentage.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Produto sem variações - linha única
                    <div className="flex items-center justify-between p-3">
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Custo: R$ {product.cost.toFixed(2)}</span>
                          <span>Preço: R$ {product.price.toFixed(2)}</span>
                          <span className="font-semibold text-foreground">
                            Margem: R$ {product.margin.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={product.cmv_percentage > targetCMV ? "destructive" : "default"}>
                        CMV: {product.cmv_percentage.toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
