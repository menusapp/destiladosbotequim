import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, Pencil, Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

interface CostsMarginsTabProps {
  restaurantId: string;
}

interface ProductWithCost {
  id: string;
  name: string;
  price: number;
  cost: number;
  cmv_percentage: number;
  margin: number;
}

interface OperationalCost {
  id?: string;
  month_year: string;
  fixed_cost: number;
  variable_cost: number;
  variable_cost_type: 'fixed' | 'percentage';
  labor_cost: number;
}

interface CardFee {
  id?: string;
  card_brand: string;
  fee_percentage: number;
}

export default function CostsMarginsTab({ restaurantId }: CostsMarginsTabProps) {
  const [productsWithCost, setProductsWithCost] = useState<ProductWithCost[]>([]);
  const [avgCMV, setAvgCMV] = useState(0);
  const [targetCMV, setTargetCMV] = useState(30);
  const [operationalCosts, setOperationalCosts] = useState<OperationalCost>({
    month_year: format(new Date(), 'yyyy-MM'),
    fixed_cost: 0,
    variable_cost: 0,
    variable_cost_type: 'fixed',
    labor_cost: 0
  });
  const [cardFees, setCardFees] = useState<CardFee[]>([]);
  const [newCardBrand, setNewCardBrand] = useState("");
  const [newCardFee, setNewCardFee] = useState("");
  const [editingCard, setEditingCard] = useState<CardFee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem('productsSortByMargin') as 'asc' | 'desc') || 'desc';
  });

  useEffect(() => {
    fetchSettings();
    fetchProductsCost();
    fetchOperationalCosts();
    fetchCardFees();
  }, [restaurantId]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("target_cmv_percentage")
      .eq("id", restaurantId)
      .single();

    if (error) {
      console.error("Erro ao buscar configurações:", error);
      return;
    }

    setTargetCMV(data?.target_cmv_percentage || 30);
  };

  const fetchOperationalCosts = async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const { data, error } = await supabase
      .from("operational_costs")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("month_year", currentMonth)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error("Erro ao buscar custos operacionais:", error);
      return;
    }

    if (data) {
      setOperationalCosts({
        ...data,
        variable_cost_type: data.variable_cost_type as 'fixed' | 'percentage'
      });
    }
  };

  const fetchCardFees = async () => {
    const { data, error } = await supabase
      .from("card_fees")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("card_brand");

    if (error) {
      console.error("Erro ao buscar taxas de cartões:", error);
      return;
    }

    setCardFees(data || []);
  };

  const saveOperationalCosts = async () => {
    const { error } = await supabase
      .from("operational_costs")
      .upsert({
        restaurant_id: restaurantId,
        ...operationalCosts
      }, {
        onConflict: 'restaurant_id,month_year'
      });

    if (error) {
      toast.error("Erro ao salvar custos operacionais");
      console.error(error);
      return;
    }

    toast.success("Custos operacionais salvos com sucesso!");
  };

  const addCardFee = async () => {
    if (!newCardBrand || !newCardFee) {
      toast.error("Preencha todos os campos");
      return;
    }

    const { error } = await supabase
      .from("card_fees")
      .insert({
        restaurant_id: restaurantId,
        card_brand: newCardBrand,
        fee_percentage: parseFloat(newCardFee)
      });

    if (error) {
      toast.error("Erro ao adicionar taxa de cartão");
      console.error(error);
      return;
    }

    toast.success("Taxa de cartão adicionada!");
    setNewCardBrand("");
    setNewCardFee("");
    fetchCardFees();
  };

  const updateCardFee = async () => {
    if (!editingCard) return;

    const { error } = await supabase
      .from("card_fees")
      .update({
        card_brand: editingCard.card_brand,
        fee_percentage: editingCard.fee_percentage
      })
      .eq("id", editingCard.id);

    if (error) {
      toast.error("Erro ao atualizar taxa de cartão");
      console.error(error);
      return;
    }

    toast.success("Taxa de cartão atualizada!");
    setEditingCard(null);
    fetchCardFees();
  };

  const deleteCardFee = async (id: string) => {
    const { error } = await supabase
      .from("card_fees")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao deletar taxa de cartão");
      console.error(error);
      return;
    }

    toast.success("Taxa de cartão deletada!");
    fetchCardFees();
  };

  const fetchProductsCost = async () => {
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          price,
          category_id,
          categories!inner (
            restaurant_id
          ),
          product_ingredients (
            quantity,
            stock_items (
              price_per_unit
            )
          )
        `)
        .eq("categories.restaurant_id", restaurantId);

      if (error) throw error;

      const productsWithCostData: ProductWithCost[] = products
        ?.filter((p: any) => p.product_ingredients && p.product_ingredients.length > 0)
        .map((product: any) => {
          const cost = product.product_ingredients.reduce((sum: number, ing: any) => {
            const quantity = ing.quantity || 0;
            const pricePerUnit = ing.stock_items?.price_per_unit || 0;
            return sum + (quantity * pricePerUnit);
          }, 0);

          const cmv_percentage = product.price > 0 ? (cost / product.price) * 100 : 0;
          const margin = product.price - cost;

          return {
            id: product.id,
            name: product.name,
            price: product.price,
            cost,
            cmv_percentage,
            margin
          };
        }) || [];

      setProductsWithCost(productsWithCostData);

      if (productsWithCostData.length > 0) {
        const avgCmv = productsWithCostData.reduce((sum, p) => sum + p.cmv_percentage, 0) / productsWithCostData.length;
        setAvgCMV(avgCmv);
      }
    } catch (error) {
      console.error("Erro ao buscar produtos com custo:", error);
    }
  };

  const highCMVProducts = productsWithCost.filter(p => p.cmv_percentage > targetCMV);
  
  // Filtrar e ordenar produtos
  const filteredAndSortedProducts = productsWithCost
    .filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      // Ordenar por margem (valor em R$)
      const marginDiff = sortOrder === 'desc' ? b.margin - a.margin : a.margin - b.margin;
      // Desempate por % de margem
      if (marginDiff === 0) {
        const marginPercentA = (a.margin / a.price) * 100;
        const marginPercentB = (b.margin / b.price) * 100;
        return sortOrder === 'desc' ? marginPercentB - marginPercentA : marginPercentA - marginPercentB;
      }
      return marginDiff;
    });

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newOrder);
    localStorage.setItem('productsSortByMargin', newOrder);
  };

  return (
    <div className="space-y-6">
      {/* Seção de Custos Operacionais */}
      <Card>
        <CardHeader>
          <CardTitle>Custos Operacionais</CardTitle>
          <CardDescription>Configure os custos mensais do restaurante</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Custo Fixo (R$/mês)</Label>
              <Input
                type="number"
                step="0.01"
                value={operationalCosts.fixed_cost}
                onChange={(e) => setOperationalCosts({...operationalCosts, fixed_cost: parseFloat(e.target.value) || 0})}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>CMO - Custo de Mão de Obra (R$/mês)</Label>
              <Input
                type="number"
                step="0.01"
                value={operationalCosts.labor_cost}
                onChange={(e) => setOperationalCosts({...operationalCosts, labor_cost: parseFloat(e.target.value) || 0})}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Custo Variável</Label>
              <Select
                value={operationalCosts.variable_cost_type}
                onValueChange={(value: 'fixed' | 'percentage') => setOperationalCosts({...operationalCosts, variable_cost_type: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">R$ Fixo</SelectItem>
                  <SelectItem value="percentage">% sobre vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Custo Variável ({operationalCosts.variable_cost_type === 'percentage' ? '%' : 'R$'})</Label>
              <Input
                type="number"
                step="0.01"
                value={operationalCosts.variable_cost}
                onChange={(e) => setOperationalCosts({...operationalCosts, variable_cost: parseFloat(e.target.value) || 0})}
                placeholder="0.00"
              />
            </div>
          </div>

          <Button onClick={saveOperationalCosts} className="w-full">
            Salvar Custos Operacionais
          </Button>
        </CardContent>
      </Card>

      {/* Seção de Taxas de Cartões */}
      <Card>
        <CardHeader>
          <CardTitle>Taxas de Cartões</CardTitle>
          <CardDescription>Configure as taxas por bandeira de cartão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Bandeira (ex: Visa, Mastercard)"
              value={newCardBrand}
              onChange={(e) => setNewCardBrand(e.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Taxa %"
              value={newCardFee}
              onChange={(e) => setNewCardFee(e.target.value)}
              className="w-32"
            />
            <Button onClick={addCardFee}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {cardFees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <span className="font-medium">{fee.card_brand}</span>
                  <span className="text-muted-foreground ml-2">{fee.fee_percentage}%</span>
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => setEditingCard(fee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Taxa de Cartão</DialogTitle>
                        <DialogDescription>Altere os dados da bandeira</DialogDescription>
                      </DialogHeader>
                      {editingCard && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Bandeira</Label>
                            <Input
                              value={editingCard.card_brand}
                              onChange={(e) => setEditingCard({...editingCard, card_brand: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Taxa (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingCard.fee_percentage}
                              onChange={(e) => setEditingCard({...editingCard, fee_percentage: parseFloat(e.target.value)})}
                            />
                          </div>
                          <Button onClick={updateCardFee} className="w-full">
                            Salvar Alterações
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => deleteCardFee(fee.id!)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Seção de CMV dos Produtos (mantida) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCMV.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              Meta: {targetCMV}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productsWithCost.length}</div>
            <p className="text-xs text-muted-foreground">
              Com ingredientes cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Acima da Meta</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highCMVProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Produtos com CMV &gt; {targetCMV}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Produtos</CardTitle>
          <CardDescription>Lista completa com custos e margens</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={toggleSortOrder}
              className="whitespace-nowrap"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ordenar por margem {sortOrder === 'desc' ? '↓ (maior→menor)' : '↑ (menor→maior)'}
            </Button>
          </div>

          {filteredAndSortedProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto com ingredientes cadastrados'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Custo: R$ {product.cost.toFixed(2)} | Preço: R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      Margem: R$ {product.margin.toFixed(2)}
                    </p>
                    <p className={`text-sm ${product.cmv_percentage > targetCMV ? 'text-destructive' : 'text-green-600'}`}>
                      CMV: {product.cmv_percentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}