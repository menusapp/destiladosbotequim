import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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
  image_url: string | null;
}

const CategoriesTab = ({ restaurantId, isRestaurantOpen }: { restaurantId: string; isRestaurantOpen: boolean }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `category-${restaurantId}-${Date.now()}.${ext}`;
      const filePath = `categories/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("products")
        .getPublicUrl(filePath);

      setCategoryImageUrl(urlData.publicUrl);
      toast.success("Imagem carregada!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
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
        .update({ name: categoryName, image_url: categoryImageUrl } as any)
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
        image_url: categoryImageUrl,
      } as any);

      if (error) {
        toast.error("Erro ao criar categoria");
        return;
      }

      toast.success("Categoria criada!");
    }

    setDialogOpen(false);
    setCategoryName("");
    setCategoryImageUrl(null);
    setEditingCategory(null);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para excluir categorias");
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_delete_category', {
        p_category_id: id,
        p_restaurant_id: restaurantId,
      });

      if (error) {
        toast.error("Erro ao excluir categoria");
        return;
      }

      toast.success("Categoria excluída!");
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir categoria");
    }
  };

  const openEditDialog = (category: Category) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para editar categorias");
      return;
    }
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryImageUrl(category.image_url || null);
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
              setCategoryImageUrl(null);
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
                  ? "Altere o nome e a imagem da categoria"
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
              <div className="space-y-2">
                <Label>Imagem da Categoria (opcional — exibida no Totem)</Label>
                <div className="flex items-center gap-3">
                  {categoryImageUrl ? (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border">
                      <img src={categoryImageUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCategoryImageUrl(null)}
                        className="absolute top-0.5 right-0.5 bg-destructive text-white rounded-full h-5 w-5 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/30">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImageIcon className="h-4 w-4 mr-1" />}
                      {uploading ? "Enviando..." : "Escolher imagem"}
                    </Button>
                  </div>
                </div>
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
        <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)]">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {category.image_url ? (
                  <img src={category.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <p className="font-medium">{category.name}</p>
              </div>
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
