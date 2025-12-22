import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price?: number | null;
  category_id: string;
  available: boolean;
  image_url: string | null;
  cost?: number;
  margin?: number;
  prep_time?: number;
  sku?: string;
  variableCosts?: VariableCostInfo[];
}

interface VariableCostInfo {
  name: string;
  price: number;
  cost: number;
  margin: number;
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
  is_required?: boolean;
  min_selection?: number;
  max_selection?: number | null;
}

interface ComplementCategory {
  id: string;
  name: string;
}

interface LinkedComplementGroup {
  id: string;
  extra_category_id: string;
  category_name: string;
  is_required: boolean;
  min_selection: number;
  max_selection: number | null;
  items: {
    id: string;
    name: string;
    price: number;
  }[];
}

// Variação para insumos variáveis
interface IngredientVariation {
  id: string;
  name: string;
  price: number;
  ingredients: ProductIngredient[];
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
  
  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Form states
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productPromotionalPrice, setProductPromotionalPrice] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productPrepTime, setProductPrepTime] = useState("");
  
  // Tipo de insumos: "fixed" ou "variable"
  const [ingredientType, setIngredientType] = useState<"fixed" | "variable">("fixed");
  
  // Insumos fixos
  const [ingredients, setIngredients] = useState<ProductIngredient[]>([]);
  const [selectedStockItem, setSelectedStockItem] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");
  
  // Insumos variáveis (variações)
  const [variations, setVariations] = useState<IngredientVariation[]>([]);
  const [variationName, setVariationName] = useState("");
  const [variationPrice, setVariationPrice] = useState("");
  const [variationIngredients, setVariationIngredients] = useState<ProductIngredient[]>([]);
  const [selectedVariationStockItem, setSelectedVariationStockItem] = useState("");
  const [variationIngredientQuantity, setVariationIngredientQuantity] = useState("");
  const [variationIsRequired, setVariationIsRequired] = useState(true);
  const [variationMinSelection, setVariationMinSelection] = useState("1");
  const [variationMaxSelection, setVariationMaxSelection] = useState("1");
  
  // Complementos avulsos
  const [extras, setExtras] = useState<ProductExtra[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [extraIngredients, setExtraIngredients] = useState<ProductIngredient[]>([]);
  const [selectedExtraStockItem, setSelectedExtraStockItem] = useState("");
  const [extraIngredientQuantity, setExtraIngredientQuantity] = useState("");
  const [extraIsRequired, setExtraIsRequired] = useState(false);
  
  // Complementos avançados (categorias vinculadas)
  const [complementCategories, setComplementCategories] = useState<ComplementCategory[]>([]);
  const [linkedGroups, setLinkedGroups] = useState<LinkedComplementGroup[]>([]);
  const [selectedComplementCategory, setSelectedComplementCategory] = useState("");
  const [groupIsRequired, setGroupIsRequired] = useState(false);
  const [groupMinSelection, setGroupMinSelection] = useState("0");
  const [groupMaxSelection, setGroupMaxSelection] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchProducts();
    fetchStockItems();
    fetchComplementCategories();

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

  const fetchComplementCategories = async () => {
    const { data } = await supabase
      .from("extra_categories")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setComplementCategories(data || []);
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
        // Buscar insumos fixos
        const { data: ingredientsData } = await supabase
          .from("product_ingredients")
          .select("quantity, stock_items(price_per_unit)")
          .eq("product_id", product.id);

        const fixedCost = ingredientsData?.reduce((sum, ing: any) => {
          return sum + (ing.quantity * (ing.stock_items?.price_per_unit || 0));
        }, 0) || 0;

        // Buscar extras (insumos variáveis) com ingredientes
        const { data: extrasData } = await supabase
          .from("product_extras")
          .select("id, name, price, is_required, product_extra_ingredients(quantity, stock_items(price_per_unit))")
          .eq("product_id", product.id);

        // Calcular custo de cada variação
        const variableCosts: VariableCostInfo[] = (extrasData || [])
          .filter((e: any) => e.is_required) // Insumos variáveis são marcados como required
          .map((extra: any) => {
            const extraCost = extra.product_extra_ingredients?.reduce((sum: number, ing: any) => {
              return sum + (ing.quantity * (ing.stock_items?.price_per_unit || 0));
            }, 0) || 0;
            
            // Usar preço promocional se existir
            const effectiveBasePrice = product.promotional_price || product.price;
            const totalPrice = effectiveBasePrice + extra.price;
            const margin = totalPrice > 0 ? ((totalPrice - extraCost) / totalPrice) * 100 : 0;
            
            return {
              name: extra.name,
              price: extra.price,
              cost: extraCost,
              margin
            };
          });

        // Se tem variações, usar range; senão, usar custo fixo
        let cost = fixedCost;
        // Usar preço promocional se existir
        const effectivePrice = product.promotional_price || product.price;
        let margin = effectivePrice > 0 ? ((effectivePrice - cost) / effectivePrice) * 100 : 0;

        return {
          ...product,
          promotional_price: product.promotional_price,
          cost,
          margin,
          prep_time: product.prep_time_minutes || 30,
          sku: product.name.substring(0, 3).toUpperCase() + String(product.id).substring(0, 4).toUpperCase(),
          variableCosts: variableCosts.length > 0 ? variableCosts : undefined
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

  // Duplicar produto
  const handleDuplicateProduct = async (product: Product) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para duplicar produtos");
      return;
    }

    // Preencher formulário com dados do produto
    setProductName(`${product.name} (cópia)`);
    setProductDescription(product.description || "");
    setProductPrice(product.price.toString());
    setProductPromotionalPrice(product.promotional_price?.toString() || "");
    setProductCategoryId(product.category_id);
    setProductImageUrl(product.image_url);
    setProductPrepTime(product.prep_time?.toString() || "");

    // Buscar insumos do produto original
    const { data: ingredientsData } = await supabase
      .from("product_ingredients")
      .select("*, stock_items(name, unit, price_per_unit)")
      .eq("product_id", product.id);

    const formattedIngredients = ingredientsData?.map((ing: any) => ({
      id: crypto.randomUUID(),
      stock_item_id: ing.stock_item_id,
      quantity: ing.quantity,
      stock_item_name: ing.stock_items?.name,
      stock_item_unit: ing.stock_items?.unit,
      stock_item_price: ing.stock_items?.price_per_unit
    })) || [];

    // Buscar extras do produto original
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("*, product_extra_ingredients(*, stock_items(name, unit, price_per_unit))")
      .eq("product_id", product.id);

    const variationsFromDB: IngredientVariation[] = [];
    const extrasFromDB: ProductExtra[] = [];

    extrasData?.forEach((extra: any) => {
      const ingredients = extra.product_extra_ingredients?.map((ing: any) => ({
        id: crypto.randomUUID(),
        stock_item_id: ing.stock_item_id,
        quantity: ing.quantity,
        stock_item_name: ing.stock_items?.name,
        stock_item_unit: ing.stock_items?.unit,
        stock_item_price: ing.stock_items?.price_per_unit
      })) || [];

      if (extra.is_required && ingredients.length > 0) {
        variationsFromDB.push({
          id: crypto.randomUUID(),
          name: extra.name,
          price: extra.price,
          ingredients
        });
        if (variationsFromDB.length === 1) {
          setVariationMinSelection(extra.min_selection?.toString() || "1");
          setVariationMaxSelection(extra.max_selection?.toString() || "1");
          setVariationIsRequired(true);
        }
      } else {
        extrasFromDB.push({
          id: crypto.randomUUID(),
          name: extra.name,
          price: extra.price,
          ingredients,
          is_required: extra.is_required
        });
      }
    });

    if (variationsFromDB.length > 0) {
      setIngredientType("variable");
      setVariations(variationsFromDB);
      setIngredients([]);
    } else {
      setIngredientType("fixed");
      setIngredients(formattedIngredients);
      setVariations([]);
    }

    setExtras(extrasFromDB);

    // Buscar grupos de complementos vinculados
    const { data: groupsData } = await supabase
      .from("product_complement_groups")
      .select("*, extra_categories(id, name, extra_category_items(id, name, price))")
      .eq("product_id", product.id);

    const formattedGroups: LinkedComplementGroup[] = (groupsData || []).map((g: any) => ({
      id: crypto.randomUUID(),
      extra_category_id: g.extra_category_id,
      category_name: g.extra_categories?.name || "",
      is_required: g.is_required || false,
      min_selection: g.min_selection || 0,
      max_selection: g.max_selection,
      items: g.extra_categories?.extra_category_items || []
    }));

    setLinkedGroups(formattedGroups);
    setEditingProduct(null); // Garantir que é criação, não edição
    setDialogOpen(true);
    toast.info("Produto duplicado! Altere o que precisar e salve.");
  };

  // Excluir produto
  const handleDeleteProduct = async (productId: string) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para excluir produtos");
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_delete_product', {
        p_product_id: productId,
        p_restaurant_id: restaurantId
      });

      if (error) throw error;

      toast.success("Produto excluído com sucesso!");
      fetchProducts();
    } catch (error) {
      console.error("Erro ao excluir produto:", error);
      toast.error("Erro ao excluir produto");
    }
  };

  // Insumos fixos
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

  // Variações de insumos
  const handleAddVariationIngredient = () => {
    if (!selectedVariationStockItem || !variationIngredientQuantity) return;
    const stockItem = stockItems.find(s => s.id === selectedVariationStockItem);
    if (!stockItem) return;

    setVariationIngredients([...variationIngredients, {
      id: crypto.randomUUID(),
      stock_item_id: selectedVariationStockItem,
      quantity: parseFloat(variationIngredientQuantity),
      stock_item_name: stockItem.name,
      stock_item_unit: stockItem.unit,
      stock_item_price: stockItem.price_per_unit
    }]);
    setSelectedVariationStockItem("");
    setVariationIngredientQuantity("");
  };

  const handleRemoveVariationIngredient = (id: string) => {
    setVariationIngredients(variationIngredients.filter(i => i.id !== id));
  };

  const handleAddVariation = () => {
    if (!variationName) {
      toast.error("Informe o nome da variação");
      return;
    }
    if (variationIngredients.length === 0) {
      toast.error("Adicione pelo menos um insumo à variação");
      return;
    }

    setVariations([...variations, {
      id: crypto.randomUUID(),
      name: variationName,
      price: parseFloat(variationPrice) || 0,
      ingredients: [...variationIngredients]
    }]);

    setVariationName("");
    setVariationPrice("");
    setVariationIngredients([]);
  };

  const handleRemoveVariation = (id: string) => {
    setVariations(variations.filter(v => v.id !== id));
  };

  // Complementos avulsos
  const handleAddExtra = () => {
    if (!extraName || !extraPrice) {
      toast.error("Preencha nome e preço do complemento");
      return;
    }

    if (extras.some(e => e.name.toLowerCase() === extraName.toLowerCase())) {
      toast.error("Já existe um complemento com este nome");
      return;
    }

    setExtras([...extras, {
      id: crypto.randomUUID(),
      name: extraName,
      price: parseFloat(extraPrice),
      ingredients: [...extraIngredients],
      is_required: extraIsRequired,
    }]);

    setExtraName("");
    setExtraPrice("");
    setExtraIngredients([]);
    setExtraIsRequired(false);
  };

  const handleLinkComplementCategory = async () => {
    if (!selectedComplementCategory) {
      toast.error("Selecione uma categoria de complementos");
      return;
    }

    if (linkedGroups.some(g => g.extra_category_id === selectedComplementCategory)) {
      toast.error("Esta categoria já está vinculada");
      return;
    }

    const category = complementCategories.find(c => c.id === selectedComplementCategory);
    if (!category) return;

    const { data: itemsData } = await supabase
      .from("extra_category_items")
      .select("id, name, price")
      .eq("category_id", selectedComplementCategory);

    setLinkedGroups([...linkedGroups, {
      id: crypto.randomUUID(),
      extra_category_id: selectedComplementCategory,
      category_name: category.name,
      is_required: groupIsRequired,
      min_selection: parseInt(groupMinSelection) || 0,
      max_selection: groupMaxSelection ? parseInt(groupMaxSelection) : null,
      items: itemsData || [],
    }]);

    setSelectedComplementCategory("");
    setGroupIsRequired(false);
    setGroupMinSelection("0");
    setGroupMaxSelection("");
  };

  const handleRemoveLinkedGroup = (id: string) => {
    setLinkedGroups(linkedGroups.filter(g => g.id !== id));
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
      promotional_price: productPromotionalPrice ? parseFloat(productPromotionalPrice) : null,
      category_id: productCategoryId,
      image_url: imageUrl,
      prep_time_minutes: productPrepTime ? parseInt(productPrepTime) : null,
    };

    let productId: string;

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }
      productId = editingProduct.id;

      // Limpar ingredientes antigos
      await supabase.from("product_ingredients").delete().eq("product_id", productId);

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
      productId = newProduct.id;
    }

    // Salvar insumos baseado no tipo
    if (ingredientType === "fixed") {
      // Insumos fixos
      if (ingredients.length > 0) {
        const ingredientsData = ingredients.map(ing => ({
          product_id: productId,
          stock_item_id: ing.stock_item_id,
          quantity: ing.quantity
        }));
        await supabase.from("product_ingredients").insert(ingredientsData);
      }
    }

    // Deletar extras antigos (variações + complementos avulsos)
    const { data: oldExtras } = await supabase
      .from("product_extras")
      .select("id")
      .eq("product_id", productId);
    
    if (oldExtras && oldExtras.length > 0) {
      for (const extra of oldExtras) {
        await supabase.from("product_extra_ingredients").delete().eq("product_extra_id", extra.id);
      }
      await supabase.from("product_extras").delete().eq("product_id", productId);
    }

    // Salvar variações como extras com is_required = true
    if (ingredientType === "variable" && variations.length > 0) {
      for (const variation of variations) {
        const { data: newExtra } = await supabase
          .from("product_extras")
          .insert({
            product_id: productId,
            name: variation.name,
            price: variation.price,
            is_required: true,
            min_selection: parseInt(variationMinSelection) || 1,
            max_selection: parseInt(variationMaxSelection) || 1
          })
          .select()
          .single();

        if (newExtra && variation.ingredients.length > 0) {
          const extraIngredientsData = variation.ingredients.map(ing => ({
            product_extra_id: newExtra.id,
            stock_item_id: ing.stock_item_id,
            quantity: ing.quantity
          }));
          await supabase.from("product_extra_ingredients").insert(extraIngredientsData);
        }
      }
    }

    // Salvar complementos avulsos (não obrigatórios por padrão, ou conforme configurado)
    for (const extra of extras) {
      const { data: newExtra } = await supabase
        .from("product_extras")
        .insert({
          product_id: productId,
          name: extra.name,
          price: extra.price,
          is_required: extra.is_required || false
        })
        .select()
        .single();

      if (newExtra && extra.ingredients && extra.ingredients.length > 0) {
        const extraIngredientsData = extra.ingredients.map(ing => ({
          product_extra_id: newExtra.id,
          stock_item_id: ing.stock_item_id,
          quantity: ing.quantity
        }));
        await supabase.from("product_extra_ingredients").insert(extraIngredientsData);
      }
    }

    // Salvar grupos de complementos vinculados
    await supabase.from("product_complement_groups").delete().eq("product_id", productId);
    
    if (linkedGroups.length > 0) {
      const groupsData = linkedGroups.map(group => ({
        product_id: productId,
        extra_category_id: group.extra_category_id,
        is_required: group.is_required,
        min_selection: group.min_selection,
        max_selection: group.max_selection
      }));
      await supabase.from("product_complement_groups").insert(groupsData);
    }

    toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!");
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
    setProductPromotionalPrice(product.promotional_price?.toString() || "");
    setProductCategoryId(product.category_id);
    setProductImageUrl(product.image_url);
    setProductPrepTime(product.prep_time?.toString() || "");

    // Fetch ingredients (insumos fixos)
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

    // Fetch extras
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("*, product_extra_ingredients(*, stock_items(name, unit, price_per_unit))")
      .eq("product_id", product.id);

    // Separar variações (is_required=true) de complementos avulsos
    const variationsFromDB: IngredientVariation[] = [];
    const extrasFromDB: ProductExtra[] = [];

    extrasData?.forEach((extra: any) => {
      const ingredients = extra.product_extra_ingredients?.map((ing: any) => ({
        id: ing.id,
        stock_item_id: ing.stock_item_id,
        quantity: ing.quantity,
        stock_item_name: ing.stock_items?.name,
        stock_item_unit: ing.stock_items?.unit,
        stock_item_price: ing.stock_items?.price_per_unit
      })) || [];

      if (extra.is_required && ingredients.length > 0) {
        // É uma variação de insumo
        variationsFromDB.push({
          id: extra.id,
          name: extra.name,
          price: extra.price,
          ingredients
        });
        // Pegar configurações de min/max do primeiro
        if (variationsFromDB.length === 1) {
          setVariationMinSelection(extra.min_selection?.toString() || "1");
          setVariationMaxSelection(extra.max_selection?.toString() || "1");
          setVariationIsRequired(true);
        }
      } else {
        // É um complemento avulso
        extrasFromDB.push({
          id: extra.id,
          name: extra.name,
          price: extra.price,
          ingredients,
          is_required: extra.is_required
        });
      }
    });

    // Determinar tipo de insumos
    if (variationsFromDB.length > 0) {
      setIngredientType("variable");
      setVariations(variationsFromDB);
      setIngredients([]);
    } else {
      setIngredientType("fixed");
      setIngredients(formattedIngredients);
      setVariations([]);
    }

    setExtras(extrasFromDB);

    // Fetch linked complement groups
    const { data: groupsData } = await supabase
      .from("product_complement_groups")
      .select("*, extra_categories(id, name, extra_category_items(id, name, price))")
      .eq("product_id", product.id);

    const formattedGroups: LinkedComplementGroup[] = (groupsData || []).map((g: any) => ({
      id: g.id,
      extra_category_id: g.extra_category_id,
      category_name: g.extra_categories?.name || "",
      is_required: g.is_required || false,
      min_selection: g.min_selection || 0,
      max_selection: g.max_selection,
      items: g.extra_categories?.extra_category_items || []
    }));

    setLinkedGroups(formattedGroups);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setDialogOpen(false);
    setProductName("");
    setProductDescription("");
    setProductPrice("");
    setProductPromotionalPrice("");
    setProductCategoryId("");
    setProductImage(null);
    setProductImageUrl(null);
    setProductPrepTime("");
    setIngredientType("fixed");
    setIngredients([]);
    setVariations([]);
    setVariationName("");
    setVariationPrice("");
    setVariationIngredients([]);
    setVariationIsRequired(true);
    setVariationMinSelection("1");
    setVariationMaxSelection("1");
    setExtras([]);
    setExtraName("");
    setExtraPrice("");
    setExtraIngredients([]);
    setSelectedStockItem("");
    setIngredientQuantity("");
    setSelectedExtraStockItem("");
    setExtraIngredientQuantity("");
    setEditingProduct(null);
    setLinkedGroups([]);
    setSelectedComplementCategory("");
    setGroupIsRequired(false);
    setGroupMinSelection("0");
    setGroupMaxSelection("");
    setExtraIsRequired(false);
  };

  // Cálculo de custo para insumos fixos
  const fixedCost = useMemo(() => {
    return ingredients.reduce((sum, ing) => {
      return sum + (ing.quantity * (ing.stock_item_price || 0));
    }, 0);
  }, [ingredients]);

  // Cálculo de custos para variações
  const variationCosts = useMemo(() => {
    const basePrice = parseFloat(productPrice) || 0;
    const promoPrice = parseFloat(productPromotionalPrice) || 0;
    const effectiveBasePrice = promoPrice > 0 ? promoPrice : basePrice;
    
    return variations.map(v => {
      const cost = v.ingredients.reduce((sum, ing) => {
        return sum + (ing.quantity * (ing.stock_item_price || 0));
      }, 0);
      const totalPrice = effectiveBasePrice + v.price;
      const margin = totalPrice > 0 ? ((totalPrice - cost) / totalPrice) * 100 : 0;
      const cmv = totalPrice > 0 ? (cost / totalPrice) * 100 : 0;
      return { name: v.name, price: v.price, cost, margin, cmv, totalPrice };
    });
  }, [variations, productPrice, productPromotionalPrice]);

  const parsedProductPrice = parseFloat(productPrice) || 0;
  const parsedPromoPrice = parseFloat(productPromotionalPrice) || 0;
  const effectivePriceForCMV = parsedPromoPrice > 0 ? parsedPromoPrice : parsedProductPrice;
  const cmvPercentage = effectivePriceForCMV > 0 ? (fixedCost / effectivePriceForCMV) * 100 : 0;

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
          resetForm();
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
              onDuplicate={handleDuplicateProduct}
              onDelete={handleDeleteProduct}
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
                  <Label htmlFor="product-price">Preço Base (R$) *</Label>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product-prep-time">Tempo de Preparo (min)</Label>
                  <Input
                    id="product-prep-time"
                    type="number"
                    min="0"
                    step="1"
                    value={productPrepTime}
                    onChange={(e) => setProductPrepTime(e.target.value)}
                    placeholder="Ex: 30"
                  />
                </div>
                <div>
                  <Label htmlFor="product-promotional-price">Preço Promocional (R$)</Label>
                  <Input
                    id="product-promotional-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={productPromotionalPrice}
                    onChange={(e) => setProductPromotionalPrice(e.target.value)}
                    placeholder="Deixe vazio se não tiver promoção"
                  />
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
            <div className="space-y-4 p-4 border rounded-xl bg-primary/5">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Insumos (Opcional)</h4>
              </div>

              {/* Tipo de Insumos */}
              <RadioGroup 
                value={ingredientType} 
                onValueChange={(v) => setIngredientType(v as "fixed" | "variable")}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="cursor-pointer">
                    Insumos Fixos
                    <span className="text-xs text-muted-foreground block">Todos os pedidos usam os mesmos insumos</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="variable" id="variable" />
                  <Label htmlFor="variable" className="cursor-pointer">
                    Insumos Variáveis
                    <span className="text-xs text-muted-foreground block">Cliente escolhe uma opção (tamanhos, etc.)</span>
                  </Label>
                </div>
              </RadioGroup>

              {/* Insumos Fixos */}
              {ingredientType === "fixed" && (
                <div className="space-y-3">
                  {fixedCost > 0 && (
                    <div className="text-sm space-y-1 p-2 bg-background rounded border">
                      <p className="text-muted-foreground">
                        Custo: <span className="font-semibold text-foreground">R$ {fixedCost.toFixed(2)}</span>
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
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Insumos Variáveis */}
              {ingredientType === "variable" && (
                <div className="space-y-4">
                  {/* Configuração do grupo */}
                  <div className="grid grid-cols-3 gap-2 p-2 bg-background rounded border">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="variation-required"
                        checked={variationIsRequired}
                        onChange={(e) => setVariationIsRequired(e.target.checked)}
                        className="rounded border-input"
                      />
                      <Label htmlFor="variation-required" className="text-xs">Obrigatório</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Mín</Label>
                      <Input
                        type="number"
                        min="0"
                        value={variationMinSelection}
                        onChange={(e) => setVariationMinSelection(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máx</Label>
                      <Input
                        type="number"
                        min="1"
                        value={variationMaxSelection}
                        onChange={(e) => setVariationMaxSelection(e.target.value)}
                        className="h-8"
                      />
                    </div>
                  </div>

                  {/* Nova variação */}
                  <div className="space-y-2 p-3 bg-background rounded-lg border">
                    <p className="text-sm font-medium">Nova Variação</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome (ex: Batata P)"
                        value={variationName}
                        onChange={(e) => setVariationName(e.target.value)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Preço adicional"
                        value={variationPrice}
                        onChange={(e) => setVariationPrice(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Select value={selectedVariationStockItem} onValueChange={setSelectedVariationStockItem}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Insumo" />
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
                        className="w-24"
                        type="number"
                        step="0.001"
                        placeholder="Qtd"
                        value={variationIngredientQuantity}
                        onChange={(e) => setVariationIngredientQuantity(e.target.value)}
                      />
                      <Button type="button" variant="outline" size="icon" onClick={handleAddVariationIngredient}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {variationIngredients.length > 0 && (
                      <div className="space-y-1">
                        {variationIngredients.map((ing) => (
                          <div key={ing.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                            <span>{ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveVariationIngredient(ing.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button type="button" variant="secondary" onClick={handleAddVariation} className="w-full">
                      Adicionar Variação
                    </Button>
                  </div>

                  {/* Lista de variações */}
                  {variations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Variações Cadastradas:</p>
                      {variations.map((v) => {
                        const vc = variationCosts.find(c => c.name === v.name);
                        return (
                          <div key={v.id} className="p-3 bg-background rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-medium">{v.name}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  {v.price > 0 ? `+R$ ${v.price.toFixed(2)}` : "Incluído"}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveVariation(v.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {v.ingredients.map(i => `${i.stock_item_name} - ${i.quantity}${i.stock_item_unit}`).join(", ")}
                            </div>
                            {vc && (
                              <div className="mt-2 pt-2 border-t text-sm grid grid-cols-3 gap-2">
                                <div>
                                  <span className="text-muted-foreground">Custo: </span>
                                  <span className="font-medium">R$ {vc.cost.toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CMV: </span>
                                  <span className={`font-medium ${vc.cmv > 35 ? 'text-destructive' : 'text-success'}`}>
                                    {vc.cmv.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Margem: </span>
                                  <span className={`font-medium ${vc.margin < 50 ? 'text-destructive' : 'text-success'}`}>
                                    {vc.margin.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Complementos Section */}
            <div className="space-y-4 p-4 border rounded-xl bg-secondary/20">
              <h4 className="font-semibold">Complementos (Opcional)</h4>
              
              {/* Link Complement Category */}
              <div className="space-y-3 p-3 bg-background rounded-lg border">
                <p className="text-sm font-medium">Vincular Categoria de Complementos</p>
                <div className="flex gap-2">
                  <Select value={selectedComplementCategory} onValueChange={setSelectedComplementCategory}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {complementCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedComplementCategory && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="group-required"
                        checked={groupIsRequired}
                        onChange={(e) => setGroupIsRequired(e.target.checked)}
                        className="rounded border-input"
                      />
                      <Label htmlFor="group-required" className="text-xs">Obrigatório</Label>
                    </div>
                    <div>
                      <Label className="text-xs">Mín</Label>
                      <Input
                        type="number"
                        min="0"
                        value={groupMinSelection}
                        onChange={(e) => setGroupMinSelection(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Máx</Label>
                      <Input
                        type="number"
                        min="0"
                        value={groupMaxSelection}
                        onChange={(e) => setGroupMaxSelection(e.target.value)}
                        placeholder="∞"
                        className="h-8"
                      />
                    </div>
                  </div>
                )}
                <Button type="button" variant="outline" onClick={handleLinkComplementCategory} className="w-full">
                  Vincular Categoria
                </Button>
              </div>

              {/* Linked Groups */}
              {linkedGroups.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Categorias Vinculadas:</p>
                  {linkedGroups.map((group) => (
                    <div key={group.id} className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium">{group.category_name}</span>
                          {group.is_required && (
                            <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLinkedGroup(group.id)}
                        >
                          Remover
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {group.items.length} itens • 
                        Min: {group.min_selection} • 
                        Max: {group.max_selection ?? "∞"}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {group.items.map(i => i.name).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Individual Complement */}
              <div className="space-y-3 p-3 bg-background rounded-lg border">
                <p className="text-sm font-medium">Criar Complemento Avulso</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nome do complemento"
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

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="extra-required"
                    checked={extraIsRequired}
                    onChange={(e) => setExtraIsRequired(e.target.checked)}
                    className="rounded border-input"
                  />
                  <Label htmlFor="extra-required" className="text-xs">Obrigatório</Label>
                </div>

                <div className="flex gap-2">
                  <Select value={selectedExtraStockItem} onValueChange={setSelectedExtraStockItem}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Insumo (opcional)" />
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
                      <div key={ing.id} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
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
                  Adicionar Complemento
                </Button>
              </div>

              {/* Individual Extras List */}
              {extras.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Complementos Avulsos:</p>
                  {extras.map((extra) => (
                    <div key={extra.id} className="flex items-center justify-between p-3 bg-background rounded border">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{extra.name} - R$ {extra.price.toFixed(2)}</p>
                          {extra.is_required && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                              Obrigatório
                            </span>
                          )}
                        </div>
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
