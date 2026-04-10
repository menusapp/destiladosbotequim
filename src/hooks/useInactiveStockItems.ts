import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useInactiveStockItems(restaurantId: string | null) {
  return useQuery({
    queryKey: ["inactive-stock-items", restaurantId],
    enabled: !!restaurantId,
    staleTime: 60_000,
    queryFn: async () => {
      // 1. Fetch inactive stock items
      const { data: inactiveItems } = await supabase
        .from("stock_items")
        .select("id")
        .eq("restaurant_id", restaurantId!)
        .eq("is_active", false);

      if (!inactiveItems || inactiveItems.length === 0) {
        return { disabledProductIds: new Set<string>(), disabledExtraCategoryItemIds: new Set<string>() };
      }

      const inactiveIds = inactiveItems.map((i) => i.id);

      // 2. Fetch product_ingredients linked to inactive stock items
      const { data: productIngredients } = await supabase
        .from("product_ingredients")
        .select("product_id")
        .in("stock_item_id", inactiveIds);

      // 3. Fetch extra_category_item_ingredients linked to inactive stock items
      const { data: extraIngredients } = await supabase
        .from("extra_category_item_ingredients")
        .select("category_item_id")
        .in("stock_item_id", inactiveIds);

      const disabledProductIds = new Set<string>(
        (productIngredients || []).map((pi) => pi.product_id)
      );
      const disabledExtraCategoryItemIds = new Set<string>(
        (extraIngredients || []).map((ei) => ei.category_item_id)
      );

      return { disabledProductIds, disabledExtraCategoryItemIds };
    },
  });
}
