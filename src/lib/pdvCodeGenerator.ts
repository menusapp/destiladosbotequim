import { supabase } from "@/integrations/supabase/client";

/**
 * Generates the next unique PDV code (3-digit, e.g. "001", "002")
 * checking across products, product_extras, and extra_category_items (complements)
 * to ensure global uniqueness within a restaurant.
 */
export async function generateNextPdvCode(
  restaurantId: string,
  extraReservedCodes?: Iterable<string | number | null | undefined>
): Promise<string> {
  // Get category IDs for this restaurant (needed to query products & product_extras)
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const categoryIds = (categories || []).map((c: any) => c.id);

  const results: any[] = [];

  // extra_category_items
  const eciRes = await supabase
    .from("extra_category_items")
    .select("pdv_code, extra_categories!inner(restaurant_id)")
    .eq("extra_categories.restaurant_id", restaurantId)
    .not("pdv_code", "is", null);
  results.push(eciRes);

  if (categoryIds.length > 0) {
    const prodRes = await supabase
      .from("products")
      .select("pdv_code")
      .in("category_id", categoryIds)
      .not("pdv_code", "is", null);
    results.push(prodRes);

    const { data: productIds } = await supabase
      .from("products")
      .select("id")
      .in("category_id", categoryIds);
    if (productIds && productIds.length > 0) {
      const extrasRes = await supabase
        .from("product_extras")
        .select("pdv_code")
        .in("product_id", productIds.map((p: any) => p.id))
        .not("pdv_code", "is", null);
      results.push(extrasRes);
    }
  }

  const usedCodes = new Set<number>();

  const addCodes = (data: any[] | null) => {
    if (!data) return;
    for (const row of data) {
      const num = parseInt(row.pdv_code, 10);
      if (!isNaN(num)) usedCodes.add(num);
    }
  };

  for (const res of results) {
    addCodes(res.data);
  }

  let next = 1;
  while (usedCodes.has(next)) {
    next++;
  }

  return String(next).padStart(3, "0");
}

/**
 * Collects all existing PDV codes for a restaurant across products, product_extras, and extra_category_items.
 * Returns a Set of numeric codes in use.
 */
export async function getAllUsedPdvCodes(restaurantId: string): Promise<Set<number>> {
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const categoryIds = (categories || []).map((c: any) => c.id);

  const usedCodes = new Set<number>();
  const addCodes = (data: any[] | null) => {
    if (!data) return;
    for (const row of data) {
      const num = parseInt(row.pdv_code, 10);
      if (!isNaN(num)) usedCodes.add(num);
    }
  };

  // extra_category_items
  const { data: eciData } = await supabase
    .from("extra_category_items")
    .select("pdv_code, extra_categories!inner(restaurant_id)")
    .eq("extra_categories.restaurant_id", restaurantId)
    .not("pdv_code", "is", null) as any;
  addCodes(eciData);

  if (categoryIds.length > 0) {
    const { data: productsData } = await supabase
      .from("products")
      .select("id, pdv_code")
      .in("category_id", categoryIds);
    addCodes(productsData);

    const productIds = (productsData || []).map((p: any) => p.id);
    if (productIds.length > 0) {
      const { data: extrasData } = await supabase
        .from("product_extras")
        .select("pdv_code")
        .in("product_id", productIds)
        .not("pdv_code", "is", null);
      addCodes(extrasData);
    }
  }

  return usedCodes;
}

/**
 * Auto-fills empty pdv_codes across products, product_extras, and extra_category_items
 * for a given restaurant. Returns count of codes filled.
 */
export async function autoFillPdvCodes(restaurantId: string): Promise<number> {
  const usedCodes = await getAllUsedPdvCodes(restaurantId);
  let nextCode = 1;
  const getNext = () => {
    while (usedCodes.has(nextCode)) nextCode++;
    const code = String(nextCode).padStart(3, "0");
    usedCodes.add(nextCode);
    nextCode++;
    return code;
  };

  let filledCount = 0;

  // 1. Products with empty pdv_code
  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const categoryIds = (categories || []).map((c: any) => c.id);

  if (categoryIds.length > 0) {
    const { data: productsEmpty } = await supabase
      .from("products")
      .select("id")
      .in("category_id", categoryIds)
      .or("pdv_code.is.null,pdv_code.eq.");

    for (const p of productsEmpty || []) {
      const code = getNext();
      await supabase.from("products").update({ pdv_code: code } as any).eq("id", p.id);
      filledCount++;
    }

    // 2. Product extras with empty pdv_code
    const { data: allProducts } = await supabase
      .from("products")
      .select("id")
      .in("category_id", categoryIds);
    const productIds = (allProducts || []).map((p: any) => p.id);

    if (productIds.length > 0) {
      const { data: extrasEmpty } = await supabase
        .from("product_extras")
        .select("id")
        .in("product_id", productIds)
        .or("pdv_code.is.null,pdv_code.eq.");

      for (const e of extrasEmpty || []) {
        const code = getNext();
        await supabase.from("product_extras").update({ pdv_code: code } as any).eq("id", e.id);
        filledCount++;
      }
    }
  }

  // 3. Extra category items with empty pdv_code
  const { data: ecats } = await supabase
    .from("extra_categories")
    .select("id")
    .eq("restaurant_id", restaurantId);
  const ecatIds = (ecats || []).map((c: any) => c.id);

  if (ecatIds.length > 0) {
    const { data: itemsEmpty } = await supabase
      .from("extra_category_items")
      .select("id")
      .in("category_id", ecatIds)
      .or("pdv_code.is.null,pdv_code.eq.");

    for (const item of itemsEmpty || []) {
      const code = getNext();
      await supabase.from("extra_category_items").update({ pdv_code: code } as any).eq("id", item.id);
      filledCount++;
    }
  }

  return filledCount;
}
