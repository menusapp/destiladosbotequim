import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const ProductsTab = ({ restaurantId, isRestaurantOpen }: { restaurantId: string; isRestaurantOpen: boolean }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [restaurantId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      toast.success("Produto criado!");
    }

    resetForm();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    // Se restaurante está aberto, verificar se o produto tem pedidos associados
    if (isRestaurantOpen) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id")
        .eq("product_id", id)
        .limit(1);

      if (orderItems && orderItems.length > 0) {
        toast.error("Não é possível excluir este produto pois ele possui pedidos associados. Feche o restaurante primeiro.");
        return;
      }
    }

    // Deletar extras do produto primeiro
    await supabase.from("product_extras").delete().eq("product_id", id);

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir produto");
      return;
    }

    toast.success("Produto excluído!");
    fetchProducts();
  };

  const openEditDialog = async (product: Product) => {
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
    setEditingProduct(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Produtos</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
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
  );
};

export default ProductsTab;
