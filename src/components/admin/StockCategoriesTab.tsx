import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FolderOpen } from "lucide-react";

interface StockCategory {
  id: string;
  name: string;
  restaurant_id: string;
}

interface StockCategoriesTabProps {
  restaurantId: string;
}

const StockCategoriesTab = ({ restaurantId }: StockCategoriesTabProps) => {
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
      toast({ title: "Categoria atualizada com sucesso" });
    } else {
      const { error } = await supabase
        .from("stock_categories")
        .insert({ name: categoryName, restaurant_id: restaurantId });

      if (error) {
        toast({ title: "Erro ao criar categoria", variant: "destructive" });
        return;
      }
      toast({ title: "Categoria criada com sucesso" });
    }

    resetForm();
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

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
    <div className="space-y-6">
      {/* Botão criar nova categoria */}
      <div className="flex justify-end">
        <Button onClick={() => {
          resetForm();
          setCategoryDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </div>

      {/* Grid de categorias */}
      {categories.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card key={category.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(category)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
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
