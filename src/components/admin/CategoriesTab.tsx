import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ImageIcon, Loader2, Search, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface Category {
  id: string;
  name: string;
  display_order: number;
  image_url: string | null;
  is_active: boolean | null;
}

interface ProductInfo {
  id: string;
  name: string;
  category_id: string | null;
}

const CategoriesTab = ({ restaurantId, isRestaurantOpen }: { restaurantId: string; isRestaurantOpen: boolean }) => {
  const confirm = useConfirmDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Product management inside category
  const [allProducts, setAllProducts] = useState<ProductInfo[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");

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

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, category_id")
      .eq("categories.restaurant_id", restaurantId)
      .order("name");
    
    // Fallback: fetch all products that belong to categories of this restaurant
    const { data: cats } = await supabase.from("categories").select("id").eq("restaurant_id", restaurantId);
    const catIds = (cats || []).map(c => c.id);
    
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category_id")
      .in("category_id", catIds.length > 0 ? catIds : ["__none__"])
      .order("name");
    
    // Also get products without category
    const { data: orphans } = await supabase
      .from("products")
      .select("id, name, category_id")
      .is("category_id", null)
      .order("name");
    
    const all = [...(products || []), ...(orphans || [])];
    // Deduplicate
    const seen = new Set<string>();
    const unique = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    setAllProducts(unique);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }

    setUploading(true);
    const bucket = "product-images";
    const ext = file.name.split(".").pop();
    const fileName = `category-${restaurantId}-${Date.now()}.${ext}`;
    const filePath = `categories/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      setCategoryImageUrl(urlData.publicUrl);
      toast.success("Imagem carregada!");
    } catch (err) {
      console.error("[CategoryUpload] error:", err);
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

    let categoryId = editingCategory?.id;

    if (editingCategory) {
      const { error } = await supabase
        .from("categories")
        .update({ name: categoryName, image_url: categoryImageUrl } as any)
        .eq("id", editingCategory.id);

      if (error) {
        toast.error("Erro ao atualizar categoria");
        return;
      }
    } else {
      const { data, error } = await supabase.from("categories").insert({
        restaurant_id: restaurantId,
        name: categoryName,
        display_order: categories.length,
        image_url: categoryImageUrl,
      } as any).select().single();

      if (error) {
        toast.error("Erro ao criar categoria");
        return;
      }
      categoryId = data?.id;
    }

    // Update product assignments
    if (categoryId) {
      // Products that should belong to this category
      const toAdd = Array.from(selectedProductIds);
      // Products that were in this category but are now unchecked
      const toRemove = allProducts
        .filter(p => p.category_id === categoryId && !selectedProductIds.has(p.id))
        .map(p => p.id);

      if (toAdd.length > 0) {
        await supabase.from("products").update({ category_id: categoryId }).in("id", toAdd);
      }
      if (toRemove.length > 0) {
        // Set to null (uncategorized)
        await supabase.from("products").update({ category_id: null } as any).in("id", toRemove);
      }
    }

    toast.success(editingCategory ? "Categoria atualizada!" : "Categoria criada!");
    setDialogOpen(false);
    setCategoryName("");
    setCategoryImageUrl(null);
    setEditingCategory(null);
    setSelectedProductIds(new Set());
    setProductSearch("");
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      variant: "destructive",
      title: "Excluir categoria?",
      description: "Os produtos vinculados a esta categoria ficarão sem categoria.",
      consequence: "Esta ação não pode ser desfeita.",
    });
    if (!ok) return;

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

  // When dialog opens, fetch products and pre-select ones in this category
  useEffect(() => {
    if (dialogOpen) {
      fetchProducts().then(() => {
        if (editingCategory) {
          const inCategory = allProducts.filter(p => p.category_id === editingCategory.id).map(p => p.id);
          setSelectedProductIds(new Set(inCategory));
        } else {
          setSelectedProductIds(new Set());
        }
      });
    }
  }, [dialogOpen, editingCategory?.id]);

  // Re-select when allProducts loads
  useEffect(() => {
    if (dialogOpen && editingCategory && allProducts.length > 0) {
      const inCategory = allProducts.filter(p => p.category_id === editingCategory.id).map(p => p.id);
      setSelectedProductIds(new Set(inCategory));
    }
  }, [allProducts]);

  const filteredProducts = productSearch
    ? allProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : allProducts;

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Categorias do Cardápio</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setProductSearch(""); }
        }}>
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Editar Categoria" : "Nova Categoria"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Altere o nome, imagem e produtos da categoria"
                  : "Crie uma nova categoria e vincule produtos"}
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

              {/* Products in this category */}
              <div className="space-y-2">
                <Label>Produtos desta categoria</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                    ) : (
                      filteredProducts.map(product => (
                        <label
                          key={product.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedProductIds.has(product.id)}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                          <span className="text-sm flex-1">{product.name}</span>
                          {product.category_id && product.category_id !== editingCategory?.id && (
                            <span className="text-[10px] text-muted-foreground">
                              (outra cat.)
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">{selectedProductIds.size} produto(s) selecionado(s)</p>
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
              className={`flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors ${category.is_active === false ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={categories.indexOf(category) === 0}
                    onClick={async () => {
                      const idx = categories.indexOf(category);
                      const target = categories[idx - 1];
                      const currentOrder = category.display_order;
                      const targetOrder = target.display_order;
                      const newCurrent = targetOrder === currentOrder ? currentOrder - 1 : targetOrder;
                      await supabase.from("categories").update({ display_order: newCurrent } as any).eq("id", category.id);
                      await supabase.from("categories").update({ display_order: currentOrder } as any).eq("id", target.id);
                      fetchCategories();
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={categories.indexOf(category) === categories.length - 1}
                    onClick={async () => {
                      const idx = categories.indexOf(category);
                      const target = categories[idx + 1];
                      const currentOrder = category.display_order;
                      const targetOrder = target.display_order;
                      const newCurrent = targetOrder === currentOrder ? currentOrder + 1 : targetOrder;
                      await supabase.from("categories").update({ display_order: newCurrent } as any).eq("id", category.id);
                      await supabase.from("categories").update({ display_order: currentOrder } as any).eq("id", target.id);
                      fetchCategories();
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                {category.image_url ? (
                  <img src={category.image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <p className="font-medium">{category.name}</p>
                {category.is_active === false && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Inativo</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  className="h-4 w-8 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4"
                  checked={category.is_active !== false}
                  onCheckedChange={async (checked) => {
                    await supabase.from("categories").update({ is_active: checked } as any).eq("id", category.id);
                    fetchCategories();
                  }}
                />
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
