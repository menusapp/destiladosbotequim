import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  available: boolean;
  image_url: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

interface ProductIngredient {
  id: string;
  stock_item_id: string;
  quantity: number;
  stock_item_name?: string;
  stock_item_unit?: string;
  stock_item_price?: number;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface ExtraCategory {
  id: string;
  name: string;
  restaurant_id: string;
}

interface ExtraCategoryItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
}

const ProductsTab = ({ restaurantId, isRestaurantOpen }: { restaurantId: string; isRestaurantOpen: boolean }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([]);
  const [selectedStockItem, setSelectedStockItem] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");

  // Estados para categorias de adicionais
  const [extraCategories, setExtraCategories] = useState<ExtraCategory[]>([]);
  const [extraCategoryDialogOpen, setExtraCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryItems, setCategoryItems] = useState<ExtraCategoryItem[]>([]);
  const [categoryItemName, setCategoryItemName] = useState("");
  const [categoryItemPrice, setCategoryItemPrice] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchExtraCategories();
    fetchStockItems();
  }, [restaurantId]);

  const fetchStockItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("id, name, unit, price_per_unit")
      .eq("restaurant_id", restaurantId);
    setStockItems(data || []);
  };

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (!error) {
      setCategories(data || []);
    }
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        categories!inner(restaurant_id)
      `)
      .eq("categories.restaurant_id", restaurantId);

    if (error) {
      toast.error("Erro ao carregar produtos");
      return;
    }

    setProducts(data || []);
  };

  const fetchExtraCategories = async () => {
    const { data, error } = await supabase
      .from("extra_categories")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (!error) {
      setExtraCategories(data || []);
    }
  };

  const handleAddExtra = () => {
    if (!extraName || !extraPrice) {
      toast.error("Preencha nome e preço do adicional");
      return;
    }
    
    setExtras([...extras, {
      id: crypto.randomUUID(),
      name: extraName,
      price: parseFloat(extraPrice)
    }]);
    setExtraName("");
    setExtraPrice("");
  };

  const handleRemoveExtra = (id: string) => {
    setExtras(extras.filter(e => e.id !== id));
  };

  const handleAddIngredient = () => {
    if (!selectedStockItem || !ingredientQuantity) return;
    const stockItem = stockItems.find(s => s.id === selectedStockItem);
    if (!stockItem) return;
    
    setIngredients([...ingredients, {
      id: crypto.randomUUID(),
      stock_item_id: selectedStockItem,
      quantity: parseFloat(ingredientQuantity),
      stock_item_name: stockItem.name,
      stock_item_unit: stockItem.unit,
      stock_item_price: stockItem.price_per_unit
    }]);
    setSelectedStockItem("");
    setIngredientQuantity("");
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(ingredients.filter(i => i.id !== id));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase
      .from("categories")
      .insert({ name: newCategoryName, restaurant_id: restaurantId });
    if (!error) {
      toast.success("Categoria criada!");
      setNewCategoryName("");
      setCategoryDialogOpen(false);
      fetchCategories();
    }
  };

  const handleAddCategoryItem = () => {
    if (!categoryItemName || !categoryItemPrice) {
      toast.error("Preencha nome e preço do adicional");
      return;
    }
    
    setCategoryItems([...categoryItems, {
      id: crypto.randomUUID(),
      category_id: "",
      name: categoryItemName,
      price: parseFloat(categoryItemPrice)
    }]);
    setCategoryItemName("");
    setCategoryItemPrice("");
  };

  const handleRemoveCategoryItem = (id: string) => {
    setCategoryItems(categoryItems.filter(i => i.id !== id));
  };

  const handleSaveExtraCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryName || categoryItems.length === 0) {
      toast.error("Preencha o nome da categoria e adicione pelo menos um item");
      return;
    }

    // Criar a categoria
    const { data: newCategory, error: categoryError } = await supabase
      .from("extra_categories")
      .insert({ name: categoryName, restaurant_id: restaurantId })
      .select()
      .single();

    if (categoryError) {
      toast.error("Erro ao criar categoria de adicionais");
      return;
    }

    // Inserir os itens da categoria
    const itemsData = categoryItems.map(item => ({
      category_id: newCategory.id,
      name: item.name,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from("extra_category_items")
      .insert(itemsData);

    if (itemsError) {
      toast.error("Erro ao adicionar itens da categoria");
      return;
    }

    toast.success("Categoria de adicionais criada!");
    setCategoryName("");
    setCategoryItems([]);
    setExtraCategoryDialogOpen(false);
    fetchExtraCategories();
  };

  const handleLoadExtrasFromCategory = async (categoryId: string) => {
    const { data, error } = await supabase
      .from("extra_category_items")
      .select("*")
      .eq("category_id", categoryId);

    if (error) {
      toast.error("Erro ao carregar adicionais da categoria");
      return;
    }

    // Adicionar os itens da categoria aos extras do produto
    const newExtras = data.map(item => ({
      id: crypto.randomUUID(),
      name: item.name,
      price: item.price
    }));

    setExtras([...extras, ...newExtras]);
    toast.success("Adicionais adicionados!");
  };

  const handleDeleteExtraCategory = async (categoryId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    const { error } = await supabase
      .from("extra_categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      toast.error("Erro ao excluir categoria");
      return;
    }

    toast.success("Categoria excluída!");
    fetchExtraCategories();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para modificar produtos");
      return;
    }

    if (!productCategoryId) {
      toast.error("Selecione uma categoria");
      return;
    }

    let imageUrl = productImageUrl;

    // Upload da imagem se houver
    if (productImage) {
      const fileExt = productImage.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, productImage);

      if (uploadError) {
        toast.error("Erro ao fazer upload da imagem");
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
      
      imageUrl = publicUrl;
    }

    const productData = {
      name: productName,
      description: productDescription,
      price: parseFloat(productPrice),
      category_id: productCategoryId,
      image_url: imageUrl,
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }

      // Deletar extras antigos e inserir novos
      await supabase.from("product_extras").delete().eq("product_id", editingProduct.id);
      
      if (extras.length > 0) {
        const extrasData = extras.map(extra => ({
          product_id: editingProduct.id,
          name: extra.name,
          price: extra.price
        }));
        await supabase.from("product_extras").insert(extrasData);
      }

      // Deletar ingredientes antigos e inserir novos
      await supabase.from("product_ingredients").delete().eq("product_id", editingProduct.id);
      
      if (ingredients.length > 0) {
        const ingredientsData = ingredients.map(ing => ({
          product_id: editingProduct.id,
          stock_item_id: ing.stock_item_id,
          quantity: ing.quantity
        }));
        await supabase.from("product_ingredients").insert(ingredientsData);
      }

      toast.success("Produto atualizado!");
    } else {
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();

      if (error) {
        toast.error("Erro ao criar produto");
        return;
      }

      // Inserir extras
      if (extras.length > 0 && newProduct) {
        const extrasData = extras.map(extra => ({
          product_id: newProduct.id,
          name: extra.name,
          price: extra.price
        }));
        await supabase.from("product_extras").insert(extrasData);
      }

      // Inserir ingredientes
      if (ingredients.length > 0 && newProduct) {
        const ingredientsData = ingredients.map(ing => ({
          product_id: newProduct.id,
          stock_item_id: ing.stock_item_id,
          quantity: ing.quantity
        }));
        await supabase.from("product_ingredients").insert(ingredientsData);
      }

      toast.success("Produto criado!");
    }

    resetForm();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto? Os pedidos já feitos com este produto serão mantidos no histórico.")) return;

    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para excluir produtos");
      return;
    }

    try {
      // Apenas deletar product_extras e o produto
      // Os order_items permanecem para histórico de faturamento
      await supabase.from("product_extras").delete().eq("product_id", id);

      const { error } = await supabase.from("products").delete().eq("id", id);

      if (error) {
        toast.error("Erro ao excluir produto");
        return;
      }

      toast.success("Produto excluído! Pedidos históricos foram mantidos.");
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir produto");
    }
  };

  const openEditDialog = async (product: Product) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para editar produtos");
      return;
    }
    setEditingProduct(product);
    setProductName(product.name);
    setProductDescription(product.description || "");
    setProductPrice(product.price.toString());
    setProductCategoryId(product.category_id);
    setProductImageUrl(product.image_url);
    
    // Buscar extras do produto
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("*")
      .eq("product_id", product.id);
    
    setExtras(extrasData || []);

    // Buscar ingredientes
    const { data: ingredientsData } = await supabase
      .from("product_ingredients")
      .select("*, stock_items(name, unit, price_per_unit)")
      .eq("product_id", product.id);
    
    const formattedIngredients = ingredientsData?.map((ing: any) => ({
      id: ing.id,
      stock_item_id: ing.stock_item_id,
      quantity: ing.quantity,
      stock_item_name: ing.stock_items?.name,
      stock_item_unit: ing.stock_items?.unit,
      stock_item_price: ing.stock_items?.price_per_unit
    })) || [];
    
    setIngredients(formattedIngredients);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setDialogOpen(false);
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setProductCategoryId("");
    setProductImage(null);
    setProductImageUrl(null);
    setExtras([]);
    setExtraName("");
    setExtraPrice("");
    setIngredients([]);
    setSelectedStockItem("");
    setIngredientQuantity("");
    setEditingProduct(null);
  };

  const calculateProductCost = () => {
    return ingredients.reduce((sum, ing) => {
      return sum + (ing.quantity * (ing.stock_item_price || 0));
    }, 0);
  };

  const productCost = calculateProductCost();
  const parsedProductPrice = parseFloat(productPrice) || 0;
  const cmvPercentage = parsedProductPrice > 0 ? (productCost / parsedProductPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Seção de Categorias de Adicionais */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Categorias de Adicionais</h3>
          <Dialog open={extraCategoryDialogOpen} onOpenChange={setExtraCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Categoria de Adicionais</DialogTitle>
                <DialogDescription>
                  Crie uma categoria com adicionais que podem ser reutilizados em vários produtos
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveExtraCategory} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name">Nome da Categoria</Label>
                  <Input
                    id="category-name"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Ex: Tamanhos, Sabores, Bebidas"
                    required
                  />
                </div>

                <div className="space-y-3 p-4 border rounded-lg bg-secondary/20">
                  <h4 className="font-semibold text-sm">Itens da Categoria</h4>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Nome do adicional"
                        value={categoryItemName}
                        onChange={(e) => setCategoryItemName(e.target.value)}
                      />
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Preço"
                        value={categoryItemPrice}
                        onChange={(e) => setCategoryItemPrice(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddCategoryItem}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {categoryItems.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {categoryItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-background rounded">
                          <span className="text-sm">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">+ R$ {item.price.toFixed(2)}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCategoryItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Salvar Categoria
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {extraCategories.length > 0 && (
          <div className="space-y-2">
            {extraCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <p className="font-medium">{category.name}</p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteExtraCategory(category.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Categorias de Produtos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Categorias de Produtos</h3>
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Categoria de Produto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                />
                <Button onClick={handleCreateCategory} className="w-full">Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {categories.map(cat => (
            <Card key={cat.id} className="p-2 text-center text-sm">{cat.name}</Card>
          ))}
        </div>
      </div>

      {/* Seção de Produtos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Produtos</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                if (isRestaurantOpen) {
                  toast.error("Feche o restaurante para adicionar produtos");
                  return;
                }
                resetForm();
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Editar Produto" : "Novo Produto"}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Altere os dados do produto"
                  : "Adicione um novo produto ao cardápio"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-name">Nome</Label>
                <Input
                  id="product-name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Pizza Margherita"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-description">Descrição</Label>
                <Textarea
                  id="product-description"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Descreva o produto..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-price">Preço (R$)</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-category">Categoria</Label>
                <Select value={productCategoryId} onValueChange={setProductCategoryId}>
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
              <div className="space-y-2">
                <Label htmlFor="product-image">Foto do Produto</Label>
                {productImageUrl && !productImage && (
                  <img src={productImageUrl} alt="Preview" className="w-32 h-32 object-cover rounded" />
                )}
                <Input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                />
              </div>
              
              <div className="space-y-3 p-4 border rounded-lg bg-secondary/20">
                <h4 className="font-semibold text-sm">Adicionais (Opcionais)</h4>
                
                {extraCategories.length > 0 && (
                  <div className="space-y-2">
                    <Label>Ou selecione uma categoria de adicionais:</Label>
                    <Select onValueChange={handleLoadExtrasFromCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {extraCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Nome do adicional"
                      value={extraName}
                      onChange={(e) => setExtraName(e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Preço"
                      value={extraPrice}
                      onChange={(e) => setExtraPrice(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddExtra}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {extras.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {extras.map((extra) => (
                      <div key={extra.id} className="flex items-center justify-between p-2 bg-background rounded">
                        <span className="text-sm">{extra.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">+ R$ {extra.price.toFixed(2)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveExtra(extra.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full">
                {editingProduct ? "Atualizar" : "Criar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

        {categories.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">
            Crie categorias primeiro antes de adicionar produtos
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhum produto criado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{product.description}</p>
                <p className="text-sm font-semibold text-primary mt-1">
                  R$ {product.price.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(product)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTab;
