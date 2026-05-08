import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Package, Target, Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { normalizeSearch } from "@/lib/searchNormalize";

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
      // 1) Buscar todos os produtos do restaurante
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          promotional_price,
          categories!inner(restaurant_id)
        `)
        .eq('categories.restaurant_id', restaurantId);

      if (productsError) throw productsError;
      if (!productsData || productsData.length === 0) {
        setProducts([]);
        setAverageCMV(0);
        return;
      }

      const productIds = productsData.map((p: any) => p.id);

      // 2) Buscar TUDO em paralelo com apenas 3 queries
      const [ingredientsRes, extrasRes, extraIngredientsRes] = await Promise.all([
        supabase
          .from('product_ingredients')
          .select('product_id, quantity, stock_items(price_per_unit)')
          .in('product_id', productIds),
        supabase
          .from('product_extras')
          .select('id, product_id, name, price, is_required')
          .in('product_id', productIds),
        supabase
          .from('product_extra_ingredients')
          .select('product_extra_id, quantity, stock_items(price_per_unit)')
      ]);

      // 3) Indexar por produto/extra para acesso O(1)
      const ingredientsByProduct = new Map<string, any[]>();
      for (const ing of ingredientsRes.data || []) {
        const list = ingredientsByProduct.get(ing.product_id) || [];
        list.push(ing);
        ingredientsByProduct.set(ing.product_id, list);
      }

      const extrasByProduct = new Map<string, any[]>();
      const allExtraIds = new Set<string>();
      for (const ext of extrasRes.data || []) {
        const list = extrasByProduct.get(ext.product_id) || [];
        list.push(ext);
        extrasByProduct.set(ext.product_id, list);
        allExtraIds.add(ext.id);
      }

      const ingredientsByExtra = new Map<string, any[]>();
      for (const ei of extraIngredientsRes.data || []) {
        if (!allExtraIds.has(ei.product_extra_id)) continue;
        const list = ingredientsByExtra.get(ei.product_extra_id) || [];
        list.push(ei);
        ingredientsByExtra.set(ei.product_extra_id, list);
      }

      // 4) Processar tudo em memória (sem mais queries)
      const productsWithCosts: ProductWithCost[] = productsData.map((product: any) => {
        const ingredients = ingredientsByProduct.get(product.id) || [];
        const extras = extrasByProduct.get(product.id) || [];

        let baseCost = 0;
        for (const ing of ingredients) {
          if (ing.stock_items) {
            baseCost += ing.quantity * ing.stock_items.price_per_unit;
          }
        }

        const variations = extras.filter((e: any) => e.is_required);

        if (variations.length > 0) {
          const variationsWithCosts: ProductVariation[] = variations.map((variation: any) => {
            const varIngredients = ingredientsByExtra.get(variation.id) || [];
            let variationCost = baseCost;
            for (const ing of varIngredients) {
              if (ing.stock_items) {
                variationCost += ing.quantity * ing.stock_items.price_per_unit;
              }
            }
            const effectiveBasePrice = product.promotional_price || product.price;
            const variationPrice = effectiveBasePrice + (variation.price || 0);
            const cmv = variationPrice > 0 ? (variationCost / variationPrice) * 100 : 0;
            return {
              name: variation.name,
              price: variationPrice,
              cost: variationCost,
              cmv_percentage: cmv,
              margin: variationPrice - variationCost
            };
          });

          const len = variationsWithCosts.length;
          return {
            id: product.id,
            name: product.name,
            price: variationsWithCosts.reduce((s, v) => s + v.price, 0) / len,
            cost: variationsWithCosts.reduce((s, v) => s + v.cost, 0) / len,
            cmv_percentage: variationsWithCosts.reduce((s, v) => s + v.cmv_percentage, 0) / len,
            margin: variationsWithCosts.reduce((s, v) => s + v.margin, 0) / len,
            hasVariations: true,
            variations: variationsWithCosts
          };
        } else {
          const effectivePrice = product.promotional_price || product.price;
          const cmv = effectivePrice > 0 ? (baseCost / effectivePrice) * 100 : 0;
          return {
            id: product.id,
            name: product.name,
            price: effectivePrice,
            cost: baseCost,
            cmv_percentage: cmv,
            margin: effectivePrice - baseCost,
            hasVariations: false
          };
        }
      });

      setProducts(productsWithCosts);

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
    .filter(p => normalizeSearch(p.name).includes(normalizeSearch(searchQuery)))
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
      {/* Header com CMV Desejado inline */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Margens</h2>
          <p className="text-sm text-muted-foreground font-light">Análise de custos e margens por produto</p>
        </div>
        <div className="flex items-center gap-2">
          <div data-tour="margens-target-cmv" className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Meta CMV:</span>
            <Input
              type="number"
              step="0.1"
              value={targetCMV}
              onChange={(e) => setTargetCMV(parseFloat(e.target.value) || 0)}
              className="w-16 h-7 text-xs text-center p-1"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleSaveTargetCMV}>Salvar</Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", averageCMV > targetCMV ? "bg-destructive/10" : "bg-primary/10")}>
              {averageCMV > targetCMV ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : (
                <TrendingUp className="h-4 w-4 text-primary" />
              )}
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{averageCMV.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground mt-1">CMV Médio · Meta: {targetCMV}%</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{products.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Produtos Cadastrados</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-destructive">{getHighCMVCount()}</p>
          <p className="text-xs text-muted-foreground mt-1">CMV Acima da Meta</p>
        </Card>
      </div>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Análise por Produto</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-56 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={toggleSortOrder} className="h-8 text-xs">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                Margem {sortOrder === 'desc' ? '↓' : '↑'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_100px_100px_100px_90px] items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40 border-y">
            <span>Produto</span>
            <span className="text-right">Custo</span>
            <span className="text-right">Preço</span>
            <span className="text-right">Margem</span>
            <span className="text-right">CMV</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto divide-y">
            {filteredAndSortedProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum produto encontrado</p>
            ) : (
              filteredAndSortedProducts.map((product) => (
                <div key={product.id}>
                  {product.hasVariations && product.variations ? (
                    <>
                      <div
                        className="grid grid-cols-[1fr_100px_100px_100px_90px] items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => toggleExpanded(product.id)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedProducts.has(product.id) ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">{product.name}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{product.variations.length} var.</Badge>
                        </div>
                        <span className="text-right text-sm tabular-nums text-muted-foreground">—</span>
                        <span className="text-right text-sm tabular-nums text-muted-foreground">—</span>
                        <span className="text-right text-sm tabular-nums text-muted-foreground">—</span>
                        <span className="text-right text-sm tabular-nums text-muted-foreground">—</span>
                      </div>
                      {expandedProducts.has(product.id) && product.variations.map((variation, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-[1fr_100px_100px_100px_90px] items-center gap-2 px-4 py-2 pl-10 bg-muted/10 border-t border-dashed"
                        >
                          <span className="text-sm text-muted-foreground truncate">• {variation.name}</span>
                          <span className="text-right text-sm tabular-nums">R$ {variation.cost.toFixed(2)}</span>
                          <span className="text-right text-sm tabular-nums">R$ {variation.price.toFixed(2)}</span>
                          <span className="text-right text-sm tabular-nums font-medium">R$ {variation.margin.toFixed(2)}</span>
                          <div className="flex justify-end">
                            <Badge variant={variation.cmv_percentage > targetCMV ? "destructive" : "default"} className="text-[10px]">
                              {variation.cmv_percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="grid grid-cols-[1fr_100px_100px_100px_90px] items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      <span className="text-right text-sm tabular-nums">R$ {product.cost.toFixed(2)}</span>
                      <span className="text-right text-sm tabular-nums">R$ {product.price.toFixed(2)}</span>
                      <span className="text-right text-sm tabular-nums font-medium">R$ {product.margin.toFixed(2)}</span>
                      <div className="flex justify-end">
                        <Badge variant={product.cmv_percentage > targetCMV ? "destructive" : "default"} className="text-[10px]">
                          {product.cmv_percentage.toFixed(1)}%
                        </Badge>
                      </div>
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
