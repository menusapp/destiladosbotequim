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
        return {
          disabledProductIds: new Set<string>(),
          disabledExtraCategoryItemIds: new Set<string>(),
          disabledProductExtraIds: new Set<string>(),
          hiddenProductIdsByRequiredChoices: new Set<string>(),
        };
      }

      const inactiveIds = inactiveItems.map((i) => i.id);

      // 2. Fetch all links in parallel
      const [productIngredientsRes, extraIngredientsRes, productExtraIngredientsRes] = await Promise.all([
        // Fixed product ingredients
        supabase
          .from("product_ingredients")
          .select("product_id")
          .in("stock_item_id", inactiveIds),
        // Extra category item ingredients (complementos de categoria)
        supabase
          .from("extra_category_item_ingredients")
          .select("category_item_id")
          .in("stock_item_id", inactiveIds),
        // Product extra ingredients (variações / extras diretos do produto)
        supabase
          .from("product_extra_ingredients")
          .select("product_extra_id")
          .in("stock_item_id", inactiveIds),
      ]);

      const disabledProductIds = new Set<string>(
        (productIngredientsRes.data || []).map((pi) => pi.product_id)
      );
      const disabledExtraCategoryItemIds = new Set<string>(
        (extraIngredientsRes.data || []).map((ei) => ei.category_item_id)
      );
      const disabledProductExtraIds = new Set<string>(
        (productExtraIngredientsRes.data || []).map((pei) => pei.product_extra_id)
      );

      // 3. If there are disabled product extras, check if any products lose ALL required options
      let hiddenProductIdsByRequiredChoices = new Set<string>();

      if (disabledProductExtraIds.size > 0) {
        // Fetch all product_extras that belong to products with at least one disabled extra
        // We need to know which products have required extras and if all of them are disabled
        const disabledExtraIdsArray = Array.from(disabledProductExtraIds);

        // Get product_ids of disabled extras
        const { data: disabledExtrasInfo } = await supabase
          .from("product_extras")
          .select("id, product_id, is_required, extra_category_id")
          .in("id", disabledExtraIdsArray);

        if (disabledExtrasInfo && disabledExtrasInfo.length > 0) {
          // Get unique product IDs affected
          const affectedProductIds = [...new Set(disabledExtrasInfo.map((e) => e.product_id))];

          // Fetch ALL extras for affected products to check if all required ones in a group are gone
          const { data: allExtrasForProducts } = await supabase
            .from("product_extras")
            .select("id, product_id, is_required, extra_category_id")
            .in("product_id", affectedProductIds)
            .neq("is_active", false);

          if (allExtrasForProducts) {
            // Group by product_id + extra_category_id (required groups)
            const requiredGroups = new Map<string, { total: number; disabled: number }>();

            for (const extra of allExtrasForProducts) {
              if (!extra.is_required) continue;
              const key = `${extra.product_id}::${extra.extra_category_id || "direct"}`;
              if (!requiredGroups.has(key)) {
                requiredGroups.set(key, { total: 0, disabled: 0 });
              }
              const group = requiredGroups.get(key)!;
              group.total++;
              if (disabledProductExtraIds.has(extra.id)) {
                group.disabled++;
              }
            }

            // If ALL options in ANY required group are disabled, hide the product
            // Actually per the user's request: if ALL required variations are gone, product hides
            // Group by product to check
            const productRequiredGroups = new Map<string, { key: string; total: number; disabled: number }[]>();
            for (const [key, group] of requiredGroups) {
              const productId = key.split("::")[0];
              if (!productRequiredGroups.has(productId)) {
                productRequiredGroups.set(productId, []);
              }
              productRequiredGroups.get(productId)!.push({ key, ...group });
            }

            for (const [productId, groups] of productRequiredGroups) {
              // If any required group has ALL its options disabled, hide the product
              const hasFullyDisabledGroup = groups.some((g) => g.total > 0 && g.disabled >= g.total);
              if (hasFullyDisabledGroup) {
                hiddenProductIdsByRequiredChoices.add(productId);
              }
            }
          }
        }
      }

      return {
        disabledProductIds,
        disabledExtraCategoryItemIds,
        disabledProductExtraIds,
        hiddenProductIdsByRequiredChoices,
      };
    },
  });
}
