import { supabase } from "@/integrations/supabase/client";

type ProductWithExtras = {
  id: string;
  product_extras?: any[] | null;
};

export async function withProductComplements<T extends ProductWithExtras>(product: T): Promise<T> {
  const { data: complementGroups, error } = await supabase
    .from("product_complement_groups")
    .select("extra_category_id, display_order, is_required, min_selection, max_selection, extra_categories(id, name, extra_category_items(id, name, price, is_active))")
    .eq("product_id", product.id)
    .order("display_order");

  if (error) throw error;

  const complementExtras = (complementGroups || []).flatMap((group: any) => {
    const category = group.extra_categories;
    if (!category?.extra_category_items) return [];

    return category.extra_category_items
      .filter((item: any) => item.is_active !== false)
      .map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        is_required: group.is_required,
        min_selection: group.min_selection,
        max_selection: group.max_selection,
        extra_category_id: group.extra_category_id,
        extra_category_name: category.name,
        extra_categories: { name: category.name },
        group_order: group.display_order ?? 9999,
        is_complement: true,
      }));
  });

  return {
    ...product,
    product_extras: [...(product.product_extras || []), ...complementExtras],
  };
}