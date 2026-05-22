import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { PDVProductDrawer } from "./PDVProductDrawer";
import { broadcastOrderModified } from "@/lib/broadcastOrderModified";
import { normalizeSearch } from "@/lib/searchNormalize";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  promotional_price?: number | null;
  image_url?: string;
  available: boolean;
  product_extras?: {
    id: string;
    name: string;
    price: number;
    is_required?: boolean;
    min_selection?: number;
    max_selection?: number;
  }[];
}

interface Category {
  id: string;
  name: string;
  products: Product[];
}

interface AddItemsToOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  restaurantId: string;
  onItemsAdded: () => void;
}

export const AddItemsToOrderDrawer = ({
  open,
  onClose,
  orderId,
  restaurantId,
  onItemsAdded,
}: AddItemsToOrderDrawerProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDrawer, setShowProductDrawer] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSearchQuery("");
      setSelectedCategory(null);
    }
  }, [open, restaurantId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("categories")
        .select(`
          id, name, display_order,
          products (
            id, name, description, price, promotional_price, available, image_url,
            product_extras (id, name, price, is_required, min_selection, max_selection, extra_category_id, extra_categories(name))
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("display_order");

      if (error) throw error;

      const filtered = (data || [])
        .map((cat: any) => ({
          ...cat,
          products: (cat.products || []).filter((p: Product) => p.available),
        }))
        .filter((cat: Category) => cat.products.length > 0);

      setCategories(filtered);
      if (filtered.length > 0) setSelectedCategory(filtered[0].id);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (searchQuery.trim()) {
      return categories
        .flatMap((c) => c.products)
        .filter((p) => normalizeSearch(p.name).includes(normalizeSearch(searchQuery)));
    }
    if (selectedCategory) {
      return categories.find((c) => c.id === selectedCategory)?.products || [];
    }
    return categories.flatMap((c) => c.products);
  }, [categories, searchQuery, selectedCategory]);

  const handleProductClick = async (product: Product) => {
    // Open immediately with base extras, then enrich with complement groups
    setSelectedProduct(product);
    setShowProductDrawer(true);
    try {
      const { data: complementGroups } = await supabase
        .from("product_complement_groups")
        .select("extra_category_id, display_order, is_required, min_selection, max_selection, extra_categories(id, name, extra_category_items(id, name, price))")
        .eq("product_id", product.id)
        .order("display_order");

      const complementExtras = (complementGroups || []).flatMap((g: any) => {
        const cat = g.extra_categories;
        if (!cat?.extra_category_items) return [];
        return cat.extra_category_items.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          is_required: g.is_required,
          min_selection: g.min_selection,
          max_selection: g.max_selection,
          extra_category_id: g.extra_category_id,
          extra_category_name: cat.name,
          group_order: g.display_order ?? 9999,
          is_complement: true,
        }));
      });

      const combinedExtras = [
        ...((product.product_extras as any[]) || []),
        ...complementExtras,
      ];

      setSelectedProduct({ ...product, product_extras: combinedExtras as any });
    } catch (e) {
      console.error("Erro ao carregar complementos:", e);
    }
  };

  const handleAddToOrder = async (item: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    notes?: string;
    extras: { extraId: string; name: string; price: number; is_complement?: boolean }[];
  }) => {
    setAdding(true);
    try {
      // Insert order item
      const { data: orderItem, error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: orderId,
          product_id: item.productId,
          quantity: item.quantity,
          price_at_order: item.price,
          notes: item.notes || null,
        })
        .select("id")
        .single();

      if (itemError) throw itemError;

      // Insert extras (complement-group items have no product_extras row, so store as snapshot only)
      if (item.extras.length > 0) {
        const extrasToInsert = item.extras.map((extra) => ({
          order_item_id: orderItem.id,
          product_extra_id: extra.is_complement ? null : extra.extraId,
          price_at_order: extra.price,
          extra_name: extra.name,
        }));

        const { error: extrasError } = await supabase
          .from("order_item_extras")
          .insert(extrasToInsert);

        if (extrasError) {
          console.error("Erro ao inserir adicionais:", extrasError);
          throw extrasError;
        }
      }

      // Stock deduction is handled by DB trigger on status change to delivered/picked_up

      toast.success(`${item.productName} adicionado ao pedido!`);
      // Notify other admin sessions that this order was modified
      broadcastOrderModified({ restaurantId, orderId, action: "item_added" });
      setShowProductDrawer(false);
      setSelectedProduct(null);
      onItemsAdded();
    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      toast.error("Erro ao adicionar item ao pedido");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Adicionar Itens ao Pedido</SheetTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </SheetHeader>

          {/* Categories */}
          {!searchQuery.trim() && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-border scrollbar-hide">
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "secondary"}
                  className="cursor-pointer whitespace-nowrap shrink-0"
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Products */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                Nenhum produto encontrado
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((product) => {
                  const effectivePrice = product.promotional_price ?? product.price;
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                    >
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-20 object-cover rounded-md mb-2"
                        />
                      )}
                      <h4 className="font-medium text-sm text-foreground line-clamp-2">
                        {product.name}
                      </h4>
                      <p className="text-primary font-bold text-sm mt-1">
                        R$ {effectivePrice.toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PDVProductDrawer
        product={selectedProduct}
        open={showProductDrawer}
        onClose={() => {
          setShowProductDrawer(false);
          setSelectedProduct(null);
        }}
        onAddToCart={handleAddToOrder}
      />
    </>
  );
};
