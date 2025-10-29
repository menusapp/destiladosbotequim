import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Package, AlertTriangle, Search, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StockCategory {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
  current_quantity: number;
  minimum_quantity: number;
  category_id: string | null;
  stock_categories?: { name: string } | null;
}

export default function StockTab({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [stockItemsOpen, setStockItemsOpen] = useState(false);
  
  const [itemForm, setItemForm] = useState({
    name: "",
    unit: "kg",
    price_per_unit: "",
    current_quantity: "",
    minimum_quantity: "",
    category_id: "",
  });

  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
    fetchStockItems();
  }, [restaurantId]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("stock_categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    if (error) {
      toast({ title: "Erro ao carregar categorias", variant: "destructive" });
      return;
    }
    setCategories(data || []);
  };

  const fetchStockItems = async () => {
    const { data, error } = await supabase
      .from("stock_items")
      .select("*, stock_categories(name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    if (error) {
      toast({ title: "Erro ao carregar insumos", variant: "destructive" });
      return;
    }
    setStockItems(data || []);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;

    const { error } = await supabase
      .from("stock_categories")
      .insert({ name: newCategoryName, restaurant_id: restaurantId });

    if (error) {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
      return;
    }

    toast({ title: "Categoria criada com sucesso" });
    setNewCategoryName("");
    setCategoryDialogOpen(false);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("stock_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao deletar categoria", variant: "destructive" });
      return;
    }

    toast({ title: "Categoria deletada" });
    fetchCategories();
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.price_per_unit || !itemForm.current_quantity) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    const itemData = {
      name: itemForm.name,
      unit: itemForm.unit,
      price_per_unit: parseFloat(itemForm.price_per_unit),
      current_quantity: parseFloat(itemForm.current_quantity),
      minimum_quantity: parseFloat(itemForm.minimum_quantity || "0"),
      category_id: itemForm.category_id || null,
      restaurant_id: restaurantId,
    };

    if (editingItem) {
      const { error } = await supabase
        .from("stock_items")
        .update(itemData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro ao atualizar insumo", variant: "destructive" });
        return;
      }
      toast({ title: "Insumo atualizado com sucesso" });
    } else {
      const { error } = await supabase
        .from("stock_items")
        .insert(itemData);

      if (error) {
        toast({ title: "Erro ao criar insumo", variant: "destructive" });
        return;
      }
      toast({ title: "Insumo criado com sucesso" });
    }

    resetItemForm();
    setItemDialogOpen(false);
    fetchStockItems();
  };

  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase
      .from("stock_items")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao deletar insumo", variant: "destructive" });
      return;
    }

    toast({ title: "Insumo deletado" });
    fetchStockItems();
  };

  const openEditDialog = (item: StockItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      unit: item.unit,
      price_per_unit: item.price_per_unit.toString(),
      current_quantity: item.current_quantity.toString(),
      minimum_quantity: item.minimum_quantity.toString(),
      category_id: item.category_id || "",
    });
    setItemDialogOpen(true);
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setItemForm({
      name: "",
      unit: "kg",
      price_per_unit: "",
      current_quantity: "",
      minimum_quantity: "",
      category_id: "",
    });
  };

  const lowStockItems = stockItems.filter(item => item.current_quantity <= item.minimum_quantity);

  return (
    <div className="space-y-6">
      {/* Alertas de estoque baixo */}
      {lowStockItems.length > 0 && (
        <Card className="p-4 bg-destructive/10 border-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-destructive mb-2">Alertas de Estoque Baixo</h3>
              <div className="space-y-1">
                {lowStockItems.map(item => (
                  <p key={item.id} className="text-sm">
                    <strong>{item.name}</strong>: {item.current_quantity.toFixed(2)} {item.unit} (mínimo: {item.minimum_quantity.toFixed(2)} {item.unit})
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Categorias */}
      <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Categorias de Estoque</h2>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <div className="flex items-center justify-end mb-4">
                <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Categoria de Estoque</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Nome da Categoria</Label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Ex: Carnes, Frios, Bebidas..."
                    />
                  </div>
                  <Button onClick={handleCreateCategory} className="w-full">
                    Criar Categoria
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {categories.map((cat) => (
            <Card key={cat.id} className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium">{cat.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteCategory(cat.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
            ))}
            {categories.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-4">
                Nenhuma categoria criada
              </p>
            )}
          </div>
        </div>
        </CollapsibleContent>
      </Card>
      </Collapsible>

      {/* Insumos */}
      <Collapsible open={stockItemsOpen} onOpenChange={setStockItemsOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Insumos / Ingredientes</h2>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${stockItemsOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6">
              <div className="flex items-center justify-end mb-4 gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  placeholder="Buscar insumo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Dialog open={itemDialogOpen} onOpenChange={(open) => {
                setItemDialogOpen(open);
                if (!open) resetItemForm();
              }}>
              <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Insumo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Editar Insumo" : "Novo Insumo"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="Ex: Carne costela, Queijo cheddar..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Unidade</Label>
                    <Select value={itemForm.unit} onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="g">Gramas</SelectItem>
                        <SelectItem value="l">Litros</SelectItem>
                        <SelectItem value="ml">ML</SelectItem>
                        <SelectItem value="unidade">Unidade</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Preço por Unidade (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={itemForm.price_per_unit}
                      onChange={(e) => setItemForm({ ...itemForm, price_per_unit: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quantidade Atual</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={itemForm.current_quantity}
                      onChange={(e) => setItemForm({ ...itemForm, current_quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <Label>Quantidade Mínima</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={itemForm.minimum_quantity}
                      onChange={(e) => setItemForm({ ...itemForm, minimum_quantity: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Categoria</Label>
                  <Select value={itemForm.category_id} onValueChange={(v) => setItemForm({ ...itemForm, category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSaveItem} className="w-full">
                  {editingItem ? "Atualizar" : "Criar"} Insumo
                </Button>
              </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
          {stockItems
            .filter((item) =>
              item.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Package className="h-5 w-5 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.current_quantity <= item.minimum_quantity && (
                        <Badge variant="destructive" className="text-xs">Estoque Baixo</Badge>
                      )}
                    </div>
                    {item.stock_categories && (
                      <p className="text-sm text-muted-foreground mb-2">{item.stock_categories.name}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quantidade:</span>
                        <p className="font-medium">{item.current_quantity.toFixed(2)} {item.unit}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Mínimo:</span>
                        <p className="font-medium">{item.minimum_quantity.toFixed(2)} {item.unit}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Preço/Un:</span>
                        <p className="font-medium">R$ {item.price_per_unit.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor Total:</span>
                        <p className="font-medium">R$ {(item.current_quantity * item.price_per_unit).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
            ))}
            {stockItems.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum insumo cadastrado</p>
              </Card>
            )}
          </div>
        </div>
        </CollapsibleContent>
      </Card>
      </Collapsible>
    </div>
  );
}
