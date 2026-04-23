import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface StockCategory {
  id: string;
  name: string;
  restaurant_id: string;
}

interface StockCategoriesTabProps {
  restaurantId: string;
}

const StockCategoriesTab = ({ restaurantId }: StockCategoriesTabProps) => {
  const confirm = useConfirmDialog();
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
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

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: "Digite um nome para a categoria", variant: "destructive" });
      return;
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("stock_categories")
        .update({ name: categoryName })
        .eq("id", editingCategory.id);

      if (error) {
        toast({ title: "Erro ao atualizar categoria", variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("stock_categories")
        .insert({ name: categoryName, restaurant_id: restaurantId });

      if (error) {
        toast({ title: "Erro ao criar categoria", variant: "destructive" });
        return;
      }
    }

    resetForm();
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const ok = await confirm({
      variant: "destructive",
      title: "Excluir categoria de estoque?",
      description: "Os insumos vinculados ficarão sem categoria.",
      consequence: "Esta ação não pode ser desfeita.",
    });
    if (!ok) return;

    const { error } = await supabase
      .from("stock_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao deletar categoria", variant: "destructive" });
      return;
    }

    fetchCategories();
  };

  const openEditDialog = (category: StockCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Categorias do Estoque</h3>
        <Button onClick={() => { resetForm(); setCategoryDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[calc(100vh-300px)] space-y-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <p className="font-medium">{category.name}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(category)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setCategoryDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nome da Categoria</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Carnes, Frios, Bebidas..."
              />
            </div>
            <Button onClick={handleSaveCategory} className="w-full">
              {editingCategory ? "Atualizar" : "Criar"} Categoria
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockCategoriesTab;
