import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, AlertTriangle, Package } from "lucide-react";
import StockCard from "./StockCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [movementTab, setMovementTab] = useState<"data" | "movement">("data");
  
  const [itemForm, setItemForm] = useState({
    name: "",
    unit: "kg",
    price_per_unit: "",
    current_quantity: "",
    minimum_quantity: "",
    category_id: "",
  });

  const [movementForm, setMovementForm] = useState({
    type: "entrada",
    quantity: "",
    reason: "",
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

    resetForms();
    setItemDialogOpen(false);
    fetchStockItems();
  };

  const handleSaveMovement = async () => {
    if (!editingItem || !movementForm.quantity) {
      toast({ title: "Preencha a quantidade", variant: "destructive" });
      return;
    }

    const quantity = parseFloat(movementForm.quantity);
    const newQuantity = movementForm.type === "entrada" 
      ? editingItem.current_quantity + quantity
      : editingItem.current_quantity - quantity;

    if (newQuantity < 0) {
      toast({ title: "Quantidade insuficiente em estoque", variant: "destructive" });
      return;
    }

    // Atualizar estoque
    const { error: updateError } = await supabase
      .from("stock_items")
      .update({ current_quantity: newQuantity })
      .eq("id", editingItem.id);

    if (updateError) {
      toast({ title: "Erro ao atualizar estoque", variant: "destructive" });
      return;
    }

    // Registrar movimentação
    const { error: movementError } = await supabase
      .from("stock_movements")
      .insert({
        stock_item_id: editingItem.id,
        quantity: quantity,
        movement_type: movementForm.type,
        reason: movementForm.reason || "Movimentação manual",
      });

    if (movementError) {
      toast({ title: "Erro ao registrar movimentação", variant: "destructive" });
      return;
    }

    toast({ title: "Movimentação registrada com sucesso" });
    resetForms();
    setItemDialogOpen(false);
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
    setMovementTab("data");
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
    setMovementForm({
      type: "entrada",
      quantity: "",
      reason: "",
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
          setMovementTab("data");
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <StockCard key={item.id} item={item} onEdit={openEditDialog} />
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
              {editingItem ? "Movimentar Insumo" : "Novo Insumo"}
            </DialogTitle>
          </DialogHeader>

          {editingItem ? (
            <Tabs value={movementTab} onValueChange={(v: any) => setMovementTab(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="data">Dados</TabsTrigger>
                <TabsTrigger value="movement">Movimentação</TabsTrigger>
              </TabsList>

              <TabsContent value="data" className="space-y-4 pt-4">
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
                  Atualizar Insumo
                </Button>
              </TabsContent>

              <TabsContent value="movement" className="space-y-4 pt-4">
                <div>
                  <Label>Tipo de Movimentação</Label>
                  <Select value={movementForm.type} onValueChange={(v) => setMovementForm({ ...movementForm, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={movementForm.reason}
                    onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                    placeholder="Ex: Compra, Perda, Ajuste..."
                  />
                </div>

                <Button onClick={handleSaveMovement} className="w-full">
                  Registrar Movimentação
                </Button>
              </TabsContent>
            </Tabs>
          ) : (
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

              <div className="grid grid-cols-2 gap-4">
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
                Criar Insumo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockItemsGrid;
