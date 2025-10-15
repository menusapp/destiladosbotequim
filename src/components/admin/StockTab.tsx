import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
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
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Category form
  const [categoryName, setCategoryName] = useState("");

  // Item form
  const [itemName, setItemName] = useState("");
  const [itemUnit, setItemUnit] = useState("kg");
  const [itemPrice, setItemPrice] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemMinQuantity, setItemMinQuantity] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");

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
    if (!categoryName.trim()) {
      toast({ title: "Digite um nome para a categoria", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("stock_categories")
      .insert({ restaurant_id: restaurantId, name: categoryName });

    if (error) {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
      return;
    }

    toast({ title: "Categoria criada com sucesso!" });
    setCategoryName("");
    setCategoryDialogOpen(false);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("stock_categories").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao deletar categoria", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria deletada" });
    fetchCategories();
  };

  const openItemDialog = (item?: StockItem) => {
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemUnit(item.unit);
      setItemPrice(item.price_per_unit.toString());
      setItemQuantity(item.current_quantity.toString());
      setItemMinQuantity(item.minimum_quantity.toString());
      setItemCategoryId(item.category_id || "");
    } else {
      setEditingItem(null);
      setItemName("");
      setItemUnit("kg");
      setItemPrice("");
      setItemQuantity("");
      setItemMinQuantity("");
      setItemCategoryId("");
    }
    setItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemName.trim() || !itemPrice || !itemQuantity || !itemMinQuantity) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    const itemData = {
      restaurant_id: restaurantId,
      name: itemName,
      unit: itemUnit,
      price_per_unit: parseFloat(itemPrice),
      current_quantity: parseFloat(itemQuantity),
      minimum_quantity: parseFloat(itemMinQuantity),
      category_id: itemCategoryId || null,
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
      toast({ title: "Insumo atualizado!" });
    } else {
      const { error } = await supabase.from("stock_items").insert(itemData);

      if (error) {
        toast({ title: "Erro ao criar insumo", variant: "destructive" });
        return;
      }
      toast({ title: "Insumo criado!" });
    }

    setItemDialogOpen(false);
    fetchStockItems();
  };

  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao deletar insumo", variant: "destructive" });
      return;
    }
    toast({ title: "Insumo deletado" });
    fetchStockItems();
  };

  const isLowStock = (item: StockItem) => item.current_quantity <= item.minimum_quantity;

  return (
    <div className="space-y-6">
      {/* Categorias de Estoque */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Categorias de Estoque</CardTitle>
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
              <div className="space-y-4">
                <div>
                  <Label>Nome da Categoria</Label>
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Ex: Carnes, Frios, Embalagens..."
                  />
                </div>
                <Button onClick={handleCreateCategory} className="w-full">
                  Criar Categoria
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 border rounded-lg"
              >
                <span className="text-sm">{cat.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteCategory(cat.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insumos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Insumos / Ingredientes</CardTitle>
          <Button size="sm" onClick={() => openItemDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Insumo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stockItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  isLowStock(item) ? "bg-red-50 border-red-300" : ""
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    {isLowStock(item) && (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Estoque Baixo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.stock_categories?.name || "Sem categoria"}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>
                      Quantidade: <strong>{item.current_quantity} {item.unit}</strong>
                    </span>
                    <span>
                      Mínimo: <strong>{item.minimum_quantity} {item.unit}</strong>
                    </span>
                    <span>
                      Preço: <strong>R$ {item.price_per_unit.toFixed(2)}/{item.unit}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openItemDialog(item)}>
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Insumo */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Insumo" : "Novo Insumo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Insumo</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Ex: Carne Costela"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={itemCategoryId} onValueChange={setItemCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
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
            <div>
              <Label>Unidade de Medida</Label>
              <Select value={itemUnit} onValueChange={setItemUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Quilograma (kg)</SelectItem>
                  <SelectItem value="g">Grama (g)</SelectItem>
                  <SelectItem value="l">Litro (l)</SelectItem>
                  <SelectItem value="ml">Mililitro (ml)</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço por Unidade (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={itemPrice}
                onChange={(e) => setItemPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Quantidade Atual</Label>
              <Input
                type="number"
                step="0.01"
                value={itemQuantity}
                onChange={(e) => setItemQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Quantidade Mínima (Alerta)</Label>
              <Input
                type="number"
                step="0.01"
                value={itemMinQuantity}
                onChange={(e) => setItemMinQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <Button onClick={handleSaveItem} className="w-full">
              {editingItem ? "Salvar Alterações" : "Criar Insumo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
