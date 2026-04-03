import { supabase } from "@/integrations/supabase/client";

/**
 * Generates the next unique PDV code (3-digit, e.g. "001", "002")
 * checking across products, product_extras, and extra_category_items
 * to ensure global uniqueness within a restaurant.
 */
export async function generateNextPdvCode(restaurantId: string): Promise<string> {
  // Fetch all existing PDV codes from all 3 tables in parallel
  const [productsRes, extrasRes, categoryItemsRes] = await Promise.all([
    supabase
      .from("products")
      .select("pdv_code")
      .eq("restaurant_id", restaurantId)
      .not("pdv_code", "is", null),
    supabase
      .from("product_extras")
      .select("pdv_code, product_id, products!inner(restaurant_id)")
      .eq("products.restaurant_id", restaurantId)
      .not("pdv_code", "is", null) as any,
    supabase
      .from("extra_category_items")
      .select("pdv_code, extra_categories!inner(restaurant_id)")
      .eq("extra_categories.restaurant_id", restaurantId)
      .not("pdv_code", "is", null) as any,
  ]);

  const usedCodes = new Set<number>();

  const addCodes = (data: any[] | null) => {
    if (!data) return;
    for (const row of data) {
      const num = parseInt(row.pdv_code, 10);
      if (!isNaN(num)) usedCodes.add(num);
    }
  };

  addCodes(productsRes.data);
  addCodes(extrasRes.data);
  addCodes(categoryItemsRes.data);

  // Find the lowest available number starting from 1
  let next = 1;
  while (usedCodes.has(next)) {
    next++;
  }

  return String(next).padStart(3, "0");
}
