import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/menu";

interface ProductSuggestionsProps {
  restaurantId: string;
  excludeIds: string[];
  primaryColor: string;
  onProductClick?: (product: Product) => void;
}

export const ProductSuggestions = ({
  restaurantId,
  excludeIds,
  primaryColor,
  onProductClick,
}: ProductSuggestionsProps) => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchSuggestions();
  }, [excludeIds]);

  const fetchSuggestions = async () => {
    let query = supabase
      .from("products")
      .select("*, categories!inner(restaurant_id)")
      .eq("categories.restaurant_id", restaurantId)
      .eq("available", true)
      .limit(8);

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data } = await query;

    if (data) {
      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 3);
      setProducts(shuffled);
    }
  };

  if (products.length === 0) return null;

  return (
    <div>
      <h4 className="font-bold text-foreground mb-2 text-sm">Que tal adicionar?</h4>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-2 min-w-[180px] max-w-[200px] p-2 rounded-lg border border-border bg-card cursor-pointer hover:shadow-sm transition-shadow flex-shrink-0"
            onClick={() => onProductClick?.(product)}
          >
            <div className="w-12 h-12 bg-muted rounded-md overflow-hidden flex-shrink-0">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  Foto
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium line-clamp-1">{product.name}</p>
              <p className="text-xs font-bold" style={{ color: primaryColor }}>
                R$ {product.price.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
