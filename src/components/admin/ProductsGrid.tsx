import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string;
  available: boolean;
  image_url: string | null;
  cost?: number;
  margin?: number;
  prep_time?: number;
  sku?: string;
}

interface Category {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface ProductIngredient {
  id: string;
  stock_item_id: string;
  quantity: number;
  stock_item_name?: string;
  stock_item_unit?: string;
  stock_item_price?: number;
}

interface ProductExtra {
  id: string;
  name: string;
  price: number;
  ingredients?: ProductIngredient[];
}

interface ProductsGridProps {
  restaurantId: string;
  isRestaurantOpen: boolean;
}

const ProductsGrid = ({ restaurantId, isRestaurantOpen }: ProductsGridProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([]);
  const [selectedStockItem, setSelectedStockItem] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [extraIngredients, setExtraIngredients] = useState<ProductIngredient[]>([]);
  const [selectedExtraStockItem, setSelectedExtraStockItem] = useState("");
  const [extraIngredientQuantity, setExtraIngredientQuantity] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchStockItems();

    // Realtime updates
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchStockItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("id, name, unit, price_per_unit")
      .eq("restaurant_id", restaurantId);
    setStockItems(data || []);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("restaurant_id", restaurantId);
    setCategories(data || []);
  };

  const fetchProducts = async () => {
    const { data: restaurantCategories } = await supabase
      .from("categories")
      .select("id")
      .eq("restaurant_id", restaurantId);

    if (!restaurantCategories || restaurantCategories.length === 0) {
      setProducts([]);
      return;
    }

    const categoryIds = restaurantCategories.map(c => c.id);
    const { data } = await supabase
      .from("products")
      .select("*")
      .in("category_id", categoryIds);

    // Calculate cost and margin for each product
    const productsWithMetrics = await Promise.all(
      (data || []).map(async (product) => {
        const { data: ingredientsData } = await supabase
          .from("product_ingredients")
          .select("quantity, stock_items(price_per_unit)")
          .eq("product_id", product.id);

        const cost = ingredientsData?.reduce((sum, ing: any) => {
          return sum + (ing.quantity * (ing.stock_items?.price_per_unit || 0));
        }, 0) || 0;

        const margin = product.price > 0 ? ((product.price - cost) / product.price) * 100 : 0;

        return {
          ...product,
          cost,
          margin,
          prep_time: 30, // TODO: Add prep_time field to products table
          sku: product.name.substring(0, 3).toUpperCase() + String(product.id).substring(0, 4).toUpperCase()
        };
      })
    );

    setProducts(productsWithMetrics);
  };

  const handleToggleAvailable = async (id: string, available: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ available })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar disponibilidade");
      return;
    }

    toast.success(`Produto ${available ? "disponibilizado" : "indisponibilizado"}`);
    fetchProducts();
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

  const handleAddExtra = () => {
    if (!extraName || !extraPrice) {
      toast.error("Preencha nome e preço do adicional");
      return;
    }

    if (extraIngredients.length === 0) {
      toast.error("Adicione pelo menos 1 insumo ao adicional");
      return;
    }

    setExtras([...extras, {
      id: crypto.randomUUID(),
      name: extraName,
      price: parseFloat(extraPrice),
      ingredients: [...extraIngredients]
    }]);

    setExtraName("");
    setExtraPrice("");
    setExtraIngredients([]);
  };

  const handleRemoveExtra = (id: string) => {
    setExtras(extras.filter(e => e.id !== id));
  };

  const handleAddExtraIngredient = () => {
    if (!selectedExtraStockItem || !extraIngredientQuantity) return;
    const stockItem = stockItems.find(s => s.id === selectedExtraStockItem);
    if (!stockItem) return;

    setExtraIngredients([...extraIngredients, {
      id: crypto.randomUUID(),
      stock_item_id: selectedExtraStockItem,
      quantity: parseFloat(extraIngredientQuantity),
      stock_item_name: stockItem.name,
      stock_item_unit: stockItem.unit,
      stock_item_price: stockItem.price_per_unit
    }]);
    setSelectedExtraStockItem("");
    setExtraIngredientQuantity("");
  };

  const handleRemoveExtraIngredient = (id: string) => {
    setExtraIngredients(extraIngredients.filter(i => i.id !== id));
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

    if (ingredients.length === 0) {
      toast.error("Adicione pelo menos 1 insumo ao produto");
      return;
    }

    let imageUrl = productImageUrl;

    // Upload image if provided
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

      // Update ingredients
      await supabase.from("product_ingredients").delete().eq("product_id", editingProduct.id);
      const ingredientsData = ingredients.map(ing => ({
        product_id: editingProduct.id,
        stock_item_id: ing.stock_item_id,
        quantity: ing.quantity
      }));
      await supabase.from("product_ingredients").insert(ingredientsData);

      // Update extras
      await supabase.from("product_extras").delete().eq("product_id", editingProduct.id);
      if (extras.length > 0) {
        const extrasData = extras.map(extra => ({
          product_id: editingProduct.id,
          name: extra.name,
          price: extra.price
        }));
        const { data: insertedExtras } = await supabase
          .from("product_extras")
          .insert(extrasData)
          .select();

        if (insertedExtras) {
          for (let i = 0; i < insertedExtras.length; i++) {
            const extra = extras[i];
            if (extra.ingredients && extra.ingredients.length > 0) {
              const extraIngredientsData = extra.ingredients.map(ing => ({
                product_extra_id: insertedExtras[i].id,
                stock_item_id: ing.stock_item_id,
                quantity: ing.quantity
              }));
              await supabase.from("product_extra_ingredients").insert(extraIngredientsData);
            }
          }
        }
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

      // Insert ingredients
      const ingredientsData = ingredients.map(ing => ({
        product_id: newProduct.id,
        stock_item_id: ing.stock_item_id,
        quantity: ing.quantity
      }));
      await supabase.from("product_ingredients").insert(ingredientsData);

      // Insert extras
      if (extras.length > 0) {
        const extrasData = extras.map(extra => ({
          product_id: newProduct.id,
          name: extra.name,
          price: extra.price
        }));
        const { data: insertedExtras } = await supabase
          .from("product_extras")
          .insert(extrasData)
          .select();

        if (insertedExtras) {
          for (let i = 0; i < insertedExtras.length; i++) {
            const extra = extras[i];
            if (extra.ingredients && extra.ingredients.length > 0) {
              const extraIngredientsData = extra.ingredients.map(ing => ({
                product_extra_id: insertedExtras[i].id,
                stock_item_id: ing.stock_item_id,
                quantity: ing.quantity
              }));
              await supabase.from("product_extra_ingredients").insert(extraIngredientsData);
            }
          }
        }
      }

      toast.success("Produto criado!");
    }

    resetForm();
    fetchProducts();
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

    // Fetch ingredients
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

    // Fetch extras
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("*, product_extra_ingredients(*, stock_items(name, unit, price_per_unit))")
      .eq("product_id", product.id);

    const formattedExtras = extrasData?.map((extra: any) => {
      const ingredients = extra.product_extra_ingredients?.map((ing: any) => ({
        id: ing.id,
        stock_item_id: ing.stock_item_id,
        quantity: ing.quantity,
        stock_item_name: ing.stock_items?.name,
        stock_item_unit: ing.stock_items?.unit,
        stock_item_price: ing.stock_items?.price_per_unit
      })) || [];

      return {
        id: extra.id,
        name: extra.name,
        price: extra.price,
        ingredients
      };
    }) || [];

    setExtras(formattedExtras);
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
    setIngredients([]);
    setExtras([]);
    setExtraName("");
    setExtraPrice("");
    setExtraIngredients([]);
    setSelectedStockItem("");
    setIngredientQuantity("");
    setSelectedExtraStockItem("");
    setExtraIngredientQuantity("");
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

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => {
          if (isRestaurantOpen) {
            toast.error("Feche o restaurante para adicionar produtos");
            return;
          }
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/20">
          <p className="text-muted-foreground">
            {searchQuery ? "Nenhum produto encontrado" : "Nenhum produto cadastrado ainda"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEditDialog}
              onToggleAvailable={handleToggleAvailable}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="product-name">Nome *</Label>
                <Input
                  id="product-name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Pizza Margherita"
                  required
                />
              </div>
              <div>
                <Label htmlFor="product-description">Descrição</Label>
                <Textarea
                  id="product-description"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  placeholder="Descreva o produto..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product-price">Preço (R$) *</Label>
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
                <div>
                  <Label htmlFor="product-category">Categoria *</Label>
                  <Select value={productCategoryId} onValueChange={setProductCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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
              </div>
              <div>
                <Label htmlFor="product-image">Foto do Produto</Label>
                {productImageUrl && !productImage && (
                  <img src={productImageUrl} alt="Preview" className="w-32 h-32 object-cover rounded mb-2" />
                )}
                <Input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            {/* Ingredients Section */}
            <div className="space-y-3 p-4 border rounded-xl bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Receita (Insumos) *</h4>
                {productCost > 0 && (
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground">
                      Custo: <span className="font-semibold text-foreground">R$ {productCost.toFixed(2)}</span>
                    </p>
                    {parsedProductPrice > 0 && (
                      <p className="text-muted-foreground">
                        CMV: <span className={`font-semibold ${cmvPercentage > 35 ? 'text-destructive' : 'text-success'}`}>
                          {cmvPercentage.toFixed(1)}%
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit}) - R$ {item.price_per_unit.toFixed(2)}/{item.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-28"
                  type="number"
                  step="0.001"
                  placeholder="Qtd"
                  value={ingredientQuantity}
                  onChange={(e) => setIngredientQuantity(e.target.value)}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddIngredient}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {ingredients.length > 0 && (
                <div className="space-y-2">
                  {ingredients.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between p-2 bg-background rounded border text-sm">
                      <span>
                        {ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          R$ {((ing.stock_item_price || 0) * ing.quantity).toFixed(2)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveIngredient(ing.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extras Section */}
            <div className="space-y-3 p-4 border rounded-xl bg-secondary/20">
              <h4 className="font-semibold">Adicionais (Opcional)</h4>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nome do adicional"
                    value={extraName}
                    onChange={(e) => setExtraName(e.target.value)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Preço"
                    value={extraPrice}
                    onChange={(e) => setExtraPrice(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Select value={selectedExtraStockItem} onValueChange={setSelectedExtraStockItem}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Insumo do adicional" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - R$ {item.price_per_unit.toFixed(2)}/{item.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="w-28"
                    type="number"
                    step="0.001"
                    placeholder="Qtd"
                    value={extraIngredientQuantity}
                    onChange={(e) => setExtraIngredientQuantity(e.target.value)}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleAddExtraIngredient}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {extraIngredients.length > 0 && (
                  <div className="space-y-1">
                    {extraIngredients.map((ing) => (
                      <div key={ing.id} className="flex items-center justify-between p-2 bg-background rounded text-xs">
                        <span>{ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExtraIngredient(ing.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="button" variant="secondary" onClick={handleAddExtra} className="w-full">
                  Adicionar Extra
                </Button>
              </div>

              {extras.length > 0 && (
                <div className="space-y-2 pt-2">
                  {extras.map((extra) => (
                    <div key={extra.id} className="flex items-center justify-between p-3 bg-background rounded border">
                      <div>
                        <p className="font-medium">{extra.name} - R$ {extra.price.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {extra.ingredients?.length || 0} insumo(s)
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveExtra(extra.id)}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full">
              {editingProduct ? "Atualizar Produto" : "Criar Produto"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsGrid;
