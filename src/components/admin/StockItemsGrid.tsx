import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, AlertTriangle, Package } from "lucide-react";
import StockCard from "./StockCard";

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

interface StockItemsGridProps {
  restaurantId: string;
}

const StockItemsGrid = ({ restaurantId }: StockItemsGridProps) => {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  
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

  const handleSaveItem = async () => {
    // Para criação, exige quantidade inicial
    if (!editingItem && (!itemForm.name || !itemForm.price_per_unit || !itemForm.current_quantity)) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    
    // Para edição, não exige quantidade
    if (editingItem && (!itemForm.name || !itemForm.price_per_unit)) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (editingItem) {
      // Atualização: não altera current_quantity
      const updateData = {
        name: itemForm.name,
        unit: itemForm.unit,
        price_per_unit: parseFloat(itemForm.price_per_unit),
        minimum_quantity: parseFloat(itemForm.minimum_quantity || "0"),
        category_id: itemForm.category_id || null,
      };

      const { error } = await supabase
        .from("stock_items")
        .update(updateData)
        .eq("id", editingItem.id);

      if (error) {
        toast({ title: "Erro ao atualizar insumo", variant: "destructive" });
        return;
      }
      toast({ title: "Insumo atualizado com sucesso" });
    } else {
      // Criação: inclui current_quantity
      const itemData = {
        name: itemForm.name,
        unit: itemForm.unit,
        price_per_unit: parseFloat(itemForm.price_per_unit),
        current_quantity: parseFloat(itemForm.current_quantity),
        minimum_quantity: parseFloat(itemForm.minimum_quantity || "0"),
        category_id: itemForm.category_id || null,
        restaurant_id: restaurantId,
      };

      const { error } = await supabase
        .from("stock_items")
        .insert(itemData);

      if (error) {
        toast({ title: "Erro ao criar insumo", variant: "destructive" });
        return;
      }
      toast({ title: "Insumo criado com sucesso" });
    }

    resetForms();
    setItemDialogOpen(false);
    fetchStockItems();
  };

  const handleDeleteItem = (item: StockItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    const { error } = await supabase.rpc("admin_delete_stock_item", {
      p_stock_item_id: itemToDelete.id,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast({ title: "Erro ao excluir insumo", description: error.message, variant: "destructive" });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      return;
    }

    toast({ title: "Insumo excluído com sucesso" });
    setDeleteDialogOpen(false);
    setItemToDelete(null);
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

  const resetForms = () => {
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
  const filteredItems = stockItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Alertas de estoque baixo */}
      {lowStockItems.length > 0 && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">
                  {lowStockItems.length} ingrediente{lowStockItems.length > 1 ? 's' : ''} abaixo do estoque mínimo
                </h3>
                <p className="text-sm text-destructive/80">
                  {lowStockItems.map(item => item.name).join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de busca e botão novo */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar insumo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => {
          resetForms();
          setItemDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Insumo
        </Button>
      </div>

      {/* Grid de cards */}
      {filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {searchQuery ? "Nenhum insumo encontrado" : "Nenhum insumo cadastrado"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredItems.map((item) => (
            <StockCard 
              key={item.id} 
              item={item} 
              onEdit={openEditDialog} 
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Dialog de edição/criação */}
      <Dialog open={itemDialogOpen} onOpenChange={(open) => {
        setItemDialogOpen(open);
        if (!open) resetForms();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Atualizar Insumo" : "Novo Insumo"}
            </DialogTitle>
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
                    <SelectItem value="un">Unidade</SelectItem>
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

            {/* Quantidade inicial só aparece para novos insumos */}
            {!editingItem && (
              <div>
                <Label>Quantidade Inicial</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.current_quantity}
                  onChange={(e) => setItemForm({ ...itemForm, current_quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            )}

            <div>
              <Label>Quantidade Mínima (para alertas)</Label>
              <Input
                type="number"
                step="0.01"
                value={itemForm.minimum_quantity}
                onChange={(e) => setItemForm({ ...itemForm, minimum_quantity: e.target.value })}
                placeholder="0"
              />
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
              {editingItem ? "Salvar Alterações" : "Criar Insumo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Insumo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{itemToDelete?.name}"?
              Esta ação não pode ser desfeita e removerá o insumo de todas as receitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StockItemsGrid;
