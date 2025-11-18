import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Product } from "@/types/menu";

interface ProductSuggestionsProps {
  restaurantId: string;
  excludeIds: string[];
  primaryColor: string;
}

export const ProductSuggestions = ({
  restaurantId,
  excludeIds,
  primaryColor,
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
      .limit(12);

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data } = await query;

    if (data) {
      // Embaralhar e pegar apenas 6
      const shuffled = data.sort(() => Math.random() - 0.5).slice(0, 6);
      setProducts(shuffled);
    }
  };

  if (products.length === 0) return null;

  return (
    <div>
      <h4 className="font-bold text-foreground mb-3">Que tal adicionar?</h4>
      <div className="grid grid-cols-3 gap-2">
        {products.map((product) => (
          <Card
            key={product.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
          >
            <CardContent className="p-2">
              <div className="aspect-square bg-muted rounded-lg mb-2 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    🍽️
                  </div>
                )}
              </div>
              <p className="text-xs font-medium line-clamp-2 mb-1">
                {product.name}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: primaryColor }}
              >
                R$ {product.price.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
