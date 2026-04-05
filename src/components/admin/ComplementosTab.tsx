import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Edit2, Trash2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { generateNextPdvCode } from "@/lib/pdvCodeGenerator";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface StockItem { id: string; name: string; unit: string; price_per_unit: number; }
interface CategoryItemIngredient { id: string; stock_item_id: string; quantity: number; stock_item_name?: string; stock_item_unit?: string; stock_item_price?: number; }
interface CategoryItem { id: string; name: string; price: number; pdv_code?: string; ingredients: CategoryItemIngredient[]; }
interface ComplementCategory { id: string; name: string; items: CategoryItem[]; }
interface SimpleProduct { id: string; name: string; }
interface ComplementosTabProps { restaurantId: string; isRestaurantOpen: boolean; }

const ComplementosTab = ({ restaurantId, isRestaurantOpen }: ComplementosTabProps) => {
  const [categories, setCategories] = useState<ComplementCategory[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ComplementCategory | null>(null);
  const [editingItem, setEditingItem] = useState<CategoryItem | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ComplementCategory | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [allProducts, setAllProducts] = useState<SimpleProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [originalProductIds, setOriginalProductIds] = useState<Set<string>>(new Set());
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemPdvCode, setItemPdvCode] = useState("");
  const [itemIngredients, setItemIngredients] = useState<CategoryItemIngredient[]>([]);
  const [selectedStockItem, setSelectedStockItem] = useState("");
  const [ingredientQuantity, setIngredientQuantity] = useState("");

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => { fetchCategories(); fetchStockItems(); fetchAllProducts(); }, [restaurantId]);

  const fetchAllProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, category_id, categories!inner(restaurant_id)").eq("categories.restaurant_id", restaurantId).order("name");
    setAllProducts((data || []).map((p: any) => ({ id: p.id, name: p.name })));
  };

  const fetchStockItems = async () => {
    const { data } = await supabase.from("stock_items").select("id, name, unit, price_per_unit").eq("restaurant_id", restaurantId);
    setStockItems(data || []);
  };

  const fetchCategories = async () => {
    setLoading(true);
    const { data: categoriesData } = await supabase.from("extra_categories").select("*").eq("restaurant_id", restaurantId).order("name");
    if (!categoriesData) { setCategories([]); setLoading(false); return; }

    const categoriesWithItems = await Promise.all(
      categoriesData.map(async (cat) => {
        const { data: itemsData } = await supabase.from("extra_category_items").select("*, extra_category_item_ingredients(*, stock_items(name, unit, price_per_unit))").eq("category_id", cat.id);
        const items = (itemsData || []).map((item: any) => ({
          id: item.id, name: item.name, price: item.price, pdv_code: item.pdv_code || "",
          ingredients: (item.extra_category_item_ingredients || []).map((ing: any) => ({
            id: ing.id, stock_item_id: ing.stock_item_id, quantity: ing.quantity,
            stock_item_name: ing.stock_items?.name, stock_item_unit: ing.stock_items?.unit, stock_item_price: ing.stock_items?.price_per_unit,
          })),
        }));
        return { id: cat.id, name: cat.name, items };
      })
    );
    setCategories(categoriesWithItems);
    setLoading(false);
  };

  // Helper: fully sync product_extras + product_extra_ingredients for a category
  const syncCategoryToProducts = async (categoryId: string) => {
    // 1. Fetch all category items with their ingredients
    const { data: catItems } = await supabase
      .from("extra_category_items")
      .select("id, name, price, extra_category_item_ingredients(id, stock_item_id, quantity)")
      .eq("category_id", categoryId);

    // 2. Find all products currently linked to this category
    const { data: existingExtras } = await supabase
      .from("product_extras")
      .select("id, product_id")
      .eq("extra_category_id", categoryId);

    if (!existingExtras || existingExtras.length === 0) return;

    const linkedProductIds = [...new Set(existingExtras.map((e: any) => e.product_id as string))];
    const existingExtraIds = existingExtras.map((e: any) => e.id as string);

    // 3. Delete old product_extra_ingredients for these extras
    if (existingExtraIds.length > 0) {
      await supabase.from("product_extra_ingredients").delete().in("product_extra_id", existingExtraIds);
      // 4. Delete old product_extras for this category
      await supabase.from("product_extras").delete().eq("extra_category_id", categoryId);
    }

    // 5. Recreate product_extras + product_extra_ingredients for each product
    if (!catItems || catItems.length === 0) return;

    for (const productId of linkedProductIds) {
      for (const item of catItems) {
        const { data: newExtra } = await supabase.from("product_extras").insert({
          product_id: productId,
          extra_category_id: categoryId,
          name: item.name,
          price: item.price,
        }).select("id").single();

        if (newExtra && item.extra_category_item_ingredients && item.extra_category_item_ingredients.length > 0) {
          const ingredientInserts = item.extra_category_item_ingredients.map((ing: any) => ({
            product_extra_id: newExtra.id,
            stock_item_id: ing.stock_item_id,
            quantity: ing.quantity,
          }));
          await supabase.from("product_extra_ingredients").insert(ingredientInserts);
        }
      }
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) { toast.error("Digite o nome da categoria"); return; }
    let categoryId = editingCategory?.id;
    if (editingCategory) {
      const { error } = await supabase.from("extra_categories").update({ name: categoryName }).eq("id", editingCategory.id);
      if (error) { toast.error("Erro ao atualizar categoria"); return; }
    } else {
      const { data, error } = await supabase.from("extra_categories").insert({ name: categoryName, restaurant_id: restaurantId }).select().single();
      if (error || !data) { toast.error("Erro ao criar categoria"); return; }
      categoryId = data.id;
    }

    // Sync product links
    if (categoryId) {
      const productsToAdd = [...selectedProductIds].filter(id => !originalProductIds.has(id));
      const productsToRemove = [...originalProductIds].filter(id => !selectedProductIds.has(id));

      // Remove deselected — delete their product_extra_ingredients first, then product_extras
      if (productsToRemove.length > 0) {
        const { data: extrasToRemove } = await supabase
          .from("product_extras")
          .select("id")
          .eq("extra_category_id", categoryId)
          .in("product_id", productsToRemove);
        if (extrasToRemove && extrasToRemove.length > 0) {
          const idsToRemove = extrasToRemove.map((e: any) => e.id);
          await supabase.from("product_extra_ingredients").delete().in("product_extra_id", idsToRemove);
        }
        await supabase.from("product_extras").delete().eq("extra_category_id", categoryId).in("product_id", productsToRemove);
      }

      // Add newly selected — create product_extras + ingredients
      if (productsToAdd.length > 0) {
        const { data: catItems } = await supabase
          .from("extra_category_items")
          .select("id, name, price, extra_category_item_ingredients(id, stock_item_id, quantity)")
          .eq("category_id", categoryId);
        if (catItems && catItems.length > 0) {
          for (const productId of productsToAdd) {
            for (const item of catItems) {
              const { data: newExtra } = await supabase.from("product_extras").insert({
                product_id: productId,
                extra_category_id: categoryId,
                name: item.name,
                price: item.price,
              }).select("id").single();

              if (newExtra && item.extra_category_item_ingredients && item.extra_category_item_ingredients.length > 0) {
                const ingredientInserts = item.extra_category_item_ingredients.map((ing: any) => ({
                  product_extra_id: newExtra.id,
                  stock_item_id: ing.stock_item_id,
                  quantity: ing.quantity,
                }));
                await supabase.from("product_extra_ingredients").insert(ingredientInserts);
              }
            }
          }
        }
      }

      // Full sync for products that stayed linked (repairs broken data + propagates changes)
      const productsStaying = [...selectedProductIds].filter(id => originalProductIds.has(id));
      if (productsStaying.length > 0) {
        // Sync all linked products (including staying ones) to fix broken ingredient data
        await syncCategoryToProducts(categoryId);
      }
    }

    toast.success(editingCategory ? "Categoria atualizada!" : "Categoria criada!");
    resetCategoryForm(); fetchCategories();
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    // Delete product_extra_ingredients for all product_extras of this category
    const { data: extrasToClean } = await supabase
      .from("product_extras")
      .select("id")
      .eq("extra_category_id", deletingCategory.id);
    if (extrasToClean && extrasToClean.length > 0) {
      await supabase.from("product_extra_ingredients").delete().in("product_extra_id", extrasToClean.map((e: any) => e.id));
    }
    await supabase.from("product_extras").delete().eq("extra_category_id", deletingCategory.id);
    for (const item of deletingCategory.items) { await supabase.from("extra_category_item_ingredients").delete().eq("category_item_id", item.id); }
    await supabase.from("extra_category_items").delete().eq("category_id", deletingCategory.id);
    const { error } = await supabase.from("extra_categories").delete().eq("id", deletingCategory.id);
    if (error) { toast.error("Erro ao excluir categoria"); return; }
    toast.success("Categoria excluída!");
    setDeleteDialogOpen(false); setDeletingCategory(null); fetchCategories();
  };

  const handleAddIngredient = () => {
    if (!selectedStockItem || !ingredientQuantity) return;
    const stockItem = stockItems.find(s => s.id === selectedStockItem);
    if (!stockItem) return;
    setItemIngredients([...itemIngredients, {
      id: crypto.randomUUID(), stock_item_id: selectedStockItem, quantity: parseFloat(ingredientQuantity),
      stock_item_name: stockItem.name, stock_item_unit: stockItem.unit, stock_item_price: stockItem.price_per_unit,
    }]);
    setSelectedStockItem(""); setIngredientQuantity("");
  };

  const handleRemoveIngredient = (id: string) => { setItemIngredients(itemIngredients.filter(i => i.id !== id)); };

  const handleSaveItem = async () => {
    if (!itemName.trim() || !selectedCategoryId) { toast.error("Preencha o nome do item"); return; }
    if (editingItem) {
      const { error } = await supabase.from("extra_category_items").update({ name: itemName, price: parseFloat(itemPrice) || 0, pdv_code: itemPdvCode || null } as any).eq("id", editingItem.id);
      if (error) { toast.error("Erro ao atualizar item"); return; }
      await supabase.from("extra_category_item_ingredients").delete().eq("category_item_id", editingItem.id);
      if (itemIngredients.length > 0) {
        await supabase.from("extra_category_item_ingredients").insert(itemIngredients.map(ing => ({ category_item_id: editingItem.id, stock_item_id: ing.stock_item_id, quantity: ing.quantity })));
      }
      // Sync to all linked products
      await syncCategoryToProducts(selectedCategoryId);
      toast.success("Item atualizado!");
    } else {
      const finalPdvCode = itemPdvCode || await generateNextPdvCode(restaurantId);
      const { data: newItem, error } = await supabase.from("extra_category_items").insert({ category_id: selectedCategoryId, name: itemName, price: parseFloat(itemPrice) || 0, pdv_code: finalPdvCode } as any).select().single();
      if (error) { toast.error("Erro ao criar item"); return; }
      if (newItem && itemIngredients.length > 0) {
        await supabase.from("extra_category_item_ingredients").insert(itemIngredients.map(ing => ({ category_item_id: newItem.id, stock_item_id: ing.stock_item_id, quantity: ing.quantity })));
      }
      // Sync to all linked products
      await syncCategoryToProducts(selectedCategoryId);
      toast.success("Item criado!");
    }
    resetItemForm(); fetchCategories();
  };

  const handleDeleteItem = async (item: CategoryItem, categoryId: string) => {
    await supabase.from("extra_category_item_ingredients").delete().eq("category_item_id", item.id);
    const { error } = await supabase.from("extra_category_items").delete().eq("id", item.id);
    if (error) { toast.error("Erro ao excluir item"); return; }
    // Sync to rebuild remaining items for linked products
    await syncCategoryToProducts(categoryId);
    toast.success("Item excluído!"); fetchCategories();
  };

  const openEditCategory = async (category: ComplementCategory) => {
    if (isRestaurantOpen) { toast.error("Feche o restaurante para editar"); return; }
    setEditingCategory(category); setCategoryName(category.name);
    // Load linked products
    const { data: linkedExtras } = await supabase.from("product_extras").select("product_id").eq("extra_category_id", category.id);
    const linkedIds = new Set((linkedExtras || []).map((e: any) => e.product_id as string));
    setSelectedProductIds(linkedIds);
    setOriginalProductIds(new Set(linkedIds));
    setProductSearchQuery("");
    setCategoryDialogOpen(true);
  };

  const openNewCategory = () => {
    if (isRestaurantOpen) { toast.error("Feche o restaurante para adicionar"); return; }
    resetCategoryForm(); setCategoryDialogOpen(true);
  };

  const openEditItem = (item: CategoryItem, categoryId: string) => {
    if (isRestaurantOpen) { toast.error("Feche o restaurante para editar"); return; }
    setEditingItem(item); setSelectedCategoryId(categoryId);
    setItemName(item.name); setItemPrice(item.price.toString()); setItemPdvCode(item.pdv_code || "");
    setItemIngredients([...item.ingredients]); setItemDialogOpen(true);
  };

  const openNewItem = (categoryId: string) => {
    if (isRestaurantOpen) { toast.error("Feche o restaurante para adicionar"); return; }
    resetItemForm(); setSelectedCategoryId(categoryId); setItemDialogOpen(true);
  };

  const resetCategoryForm = () => {
    setCategoryDialogOpen(false); setEditingCategory(null); setCategoryName("");
    setSelectedProductIds(new Set()); setOriginalProductIds(new Set()); setProductSearchQuery("");
  };

  const toggleProductSelection = (productId: string) => {
    const newSet = new Set(selectedProductIds);
    if (newSet.has(productId)) newSet.delete(productId); else newSet.add(productId);
    setSelectedProductIds(newSet);
  };
  const resetItemForm = () => {
    setItemDialogOpen(false); setEditingItem(null); setSelectedCategoryId(null);
    setItemName(""); setItemPrice(""); setItemPdvCode(""); setItemIngredients([]);
    setSelectedStockItem(""); setIngredientQuantity("");
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) newExpanded.delete(categoryId); else newExpanded.add(categoryId);
    setExpandedCategories(newExpanded);
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.items.some(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const calculateItemCost = (ingredients: CategoryItemIngredient[]) => ingredients.reduce((sum, ing) => sum + (ing.quantity * (ing.stock_item_price || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar categorias ou itens..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNewCategory}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
      </div>

      {loading ? (
        <div className="text-center py-16"><p className="text-muted-foreground">Carregando...</p></div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/20">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">{searchQuery ? "Nenhuma categoria encontrada" : "Nenhuma categoria de complementos"}</p>
          <p className="text-sm text-muted-foreground">Crie categorias como "Tamanhos", "Molhos" ou "Acompanhamentos"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <Collapsible open={expandedCategories.has(category.id)} onOpenChange={() => toggleCategory(category.id)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedCategories.has(category.id) ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                        <CardTitle className="text-lg">{category.name}</CardTitle>
                        <span className="text-sm text-muted-foreground">({category.items.length} {category.items.length === 1 ? "item" : "itens"})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEditCategory(category); }}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); if (isRestaurantOpen) { toast.error("Feche o restaurante para excluir"); return; } setDeletingCategory(category); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {category.items.map((item) => {
                        const cost = calculateItemCost(item.ingredients);
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{item.name}</span>
                                <span className="text-primary font-semibold">R$ {item.price.toFixed(2)}</span>
                                {item.pdv_code && <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">PDV: {item.pdv_code}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.ingredients.length > 0 ? (
                                  <>{item.ingredients.map(ing => `${ing.stock_item_name} (${ing.quantity} ${ing.stock_item_unit})`).join(", ")}<span className="ml-2">• Custo: R$ {cost.toFixed(2)}</span></>
                                ) : ("Sem insumos vinculados")}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditItem(item, category.id)}><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { if (isRestaurantOpen) { toast.error("Feche o restaurante para excluir"); return; } handleDeleteItem(item, category.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button variant="outline" className="w-full mt-2" onClick={() => openNewItem(category.id)}><Plus className="h-4 w-4 mr-2" />Adicionar Item</Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria de Complementos"}</DialogTitle>
            <DialogDescription>Categorias agrupam complementos similares (ex: Tamanhos, Molhos)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="category-name">Nome da Categoria *</Label><Input id="category-name" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Ex: Tamanhos, Molhos, Acompanhamentos" /></div>

            <div className="space-y-2">
              <Label>Produtos vinculados ({selectedProductIds.size} selecionados)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produtos..." value={productSearchQuery} onChange={(e) => setProductSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {allProducts
                    .filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()))
                    .map(product => (
                      <label key={product.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                        <span>{product.name}</span>
                      </label>
                    ))}
                </div>
              </ScrollArea>
            </div>

            <Button onClick={handleSaveCategory} className="w-full">{editingCategory ? "Atualizar" : "Criar Categoria"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            <DialogDescription>Adicione um item ao grupo de complementos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="item-name">Nome *</Label>
                <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex: Pequeno" />
              </div>
              <div>
                <Label htmlFor="item-price">Preço (R$)</Label>
                <Input id="item-price" type="number" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label htmlFor="item-pdv-code">Código PDV</Label>
                <Input id="item-pdv-code" value={itemPdvCode} onChange={(e) => setItemPdvCode(e.target.value)} placeholder="Ex: C01" />
              </div>
            </div>

            <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
              <Label>Insumos (opcional)</Label>
              <div className="flex gap-2">
                <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um insumo" /></SelectTrigger>
                  <SelectContent>{stockItems.map((item) => (<SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>))}</SelectContent>
                </Select>
                <Input className="w-24" type="number" step="0.001" placeholder="Qtd" value={ingredientQuantity} onChange={(e) => setIngredientQuantity(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={handleAddIngredient}><Plus className="h-4 w-4" /></Button>
              </div>
              {itemIngredients.length > 0 && (
                <div className="space-y-2">
                  {itemIngredients.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between p-2 bg-background rounded text-sm">
                      <span>{ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveIngredient(ing.id)}>Remover</Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-right">Custo total: R$ {calculateItemCost(itemIngredients).toFixed(2)}</p>
                </div>
              )}
            </div>

            <Button onClick={handleSaveItem} className="w-full">{editingItem ? "Atualizar Item" : "Adicionar Item"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação irá excluir a categoria "{deletingCategory?.name}" e todos os seus {deletingCategory?.items.length || 0} itens. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ComplementosTab;