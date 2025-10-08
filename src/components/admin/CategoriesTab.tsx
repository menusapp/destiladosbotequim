import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Category {
  id: string;
  name: string;
  display_order: number;
}

const CategoriesTab = ({ restaurantId, isRestaurantOpen }: { restaurantId: string; isRestaurantOpen: boolean }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    fetchCategories();
  }, [restaurantId]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("display_order");

    if (error) {
      toast.error("Erro ao carregar categorias");
      return;
    }

    setCategories(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para modificar categorias");
      return;
    }

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ name: categoryName })
        .eq("id", editingCategory.id);

      if (error) {
        toast.error("Erro ao atualizar categoria");
        return;
      }

      toast.success("Categoria atualizada!");
    } else {
      const { error } = await supabase.from("categories").insert({
        restaurant_id: restaurantId,
        name: categoryName,
        display_order: categories.length,
      });

      if (error) {
        toast.error("Erro ao criar categoria");
        return;
      }

      toast.success("Categoria criada!");
    }

    setDialogOpen(false);
    setCategoryName("");
    setEditingCategory(null);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para excluir categorias");
      return;
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir categoria");
      return;
    }

    toast.success("Categoria excluída!");
    fetchCategories();
  };

  const openEditDialog = (category: Category) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para editar categorias");
      return;
    }
    setEditingCategory(category);
    setCategoryName(category.name);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Categorias do Cardápio</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { 
              if (isRestaurantOpen) {
                toast.error("Feche o restaurante para adicionar categorias");
                return;
              }
              setEditingCategory(null); 
              setCategoryName(""); 
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Altere o nome da categoria"
                  : "Crie uma nova categoria para organizar seus produtos"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nome da Categoria</Label>
                <Input
                  id="category-name"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Ex: Pizzas, Bebidas, Sobremesas..."
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingCategory ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhuma categoria criada ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
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
                  onClick={() => handleDelete(category.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoriesTab;
