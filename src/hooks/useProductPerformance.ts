import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDateRange, type DateRange, FINALIZED_ORDER_STATUSES } from "./useOrderMetrics";

export interface ProductPerformanceItem {
  productId: string;
  productName: string;
  categoryName: string;
  price: number;
  totalQuantity: number;
  orderCount: number;
  totalRevenue: number;
  extrasRevenue: number;
  avgPrice: number;
}

export interface ProductPerformanceData {
  products: ProductPerformanceItem[];
  totalQuantitySold: number;
  mostProfitable: ProductPerformanceItem | null;
  avgTicketPerProduct: number;
  topCategory: string;
}

async function fetchProductPerformance(
  restaurantId: string,
  dateRange: DateRange
): Promise<ProductPerformanceData> {
  const { start, end } = getDateRange(dateRange);

  // Fetch delivery orders with items
  const { data: deliveryOrders } = await supabase
    .from("orders")
    .select(
      "id, order_items(id, product_id, quantity, price_at_order, order_item_extras(price_at_order))"
    )
    .eq("restaurant_id", restaurantId)
    .in("status", FINALIZED_ORDER_STATUSES)
    .gte("created_at", start)
    .lte("created_at", end);

  // Fetch local bills to get table_ids, then local orders
  const { data: paidBills } = await supabase
    .from("bills")
    .select("table_id, tables!inner(restaurant_id)")
    .eq("tables.restaurant_id", restaurantId)
    .eq("status", "paid")
    .gt("total_amount", 0)
    .gte("paid_at", start)
    .lte("paid_at", end);

  const tableIds = [...new Set((paidBills || []).map((b: any) => b.table_id))];
  let localOrders: any[] = [];
  if (tableIds.length > 0) {
    const { data } = await supabase
      .from("orders")
      .select(
        "id, order_items(id, product_id, quantity, price_at_order, order_item_extras(price_at_order))"
      )
      .in("table_id", tableIds)
      .eq("order_type", "local")
      .gte("created_at", start)
      .lte("created_at", end);
    localOrders = data || [];
  }

  // Fetch counter orders items
  const { data: counterOrders } = await supabase
    .from("counter_orders")
    .select(
      "id, counter_order_items(id, product_id, quantity, price_at_order, counter_order_item_extras(price_at_order))"
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "paid")
    .gte("finalized_at", start)
    .lte("finalized_at", end);

  // Collect all product_ids
  const allItems: { product_id: string; quantity: number; price_at_order: number; extrasTotal: number }[] = [];

  const processItems = (items: any[], extrasKey = "order_item_extras") => {
    (items || []).forEach((item: any) => {
      if (!item.product_id) return;
      const extrasTotal = (item[extrasKey] || []).reduce(
        (s: number, e: any) => s + Number(e.price_at_order || 0),
        0
      );
      allItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_order: item.price_at_order,
        extrasTotal,
      });
    });
  };

  (deliveryOrders || []).forEach((o: any) => processItems(o.order_items));
  localOrders.forEach((o: any) => processItems(o.order_items));
  (counterOrders || []).forEach((o: any) =>
    processItems(o.counter_order_items, "counter_order_item_extras")
  );

  // Aggregate by product_id
  const productMap = new Map<
    string,
    { qty: number; revenue: number; extras: number; orderIds: Set<string>; prices: number[] }
  >();

  allItems.forEach((item) => {
    const existing = productMap.get(item.product_id) || {
      qty: 0, revenue: 0, extras: 0, orderIds: new Set<string>(), prices: [],
    };
    existing.qty += item.quantity;
    existing.revenue += item.price_at_order * item.quantity;
    existing.extras += item.extrasTotal;
    existing.prices.push(item.price_at_order);
    productMap.set(item.product_id, existing);
  });

  if (productMap.size === 0) {
    return { products: [], totalQuantitySold: 0, mostProfitable: null, avgTicketPerProduct: 0, topCategory: "" };
  }

  // Fetch product names and categories
  const productIds = [...productMap.keys()];
  const { data: productsData } = await supabase
    .from("products")
    .select("id, name, price, category_id, categories(name)")
    .in("id", productIds);

  const productInfo = new Map<string, { name: string; price: number; categoryName: string }>();
  (productsData || []).forEach((p: any) => {
    productInfo.set(p.id, {
      name: p.name,
      price: p.price,
      categoryName: p.categories?.name || "Sem categoria",
    });
  });

  // Build result
  const products: ProductPerformanceItem[] = [];
  let totalQuantitySold = 0;
  const categoryQty = new Map<string, number>();

  productMap.forEach((data, productId) => {
    const info = productInfo.get(productId);
    if (!info) return;
    const totalRev = data.revenue + data.extras;
    const avgPrice = data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : 0;
    products.push({
      productId,
      productName: info.name,
      categoryName: info.categoryName,
      price: info.price,
      totalQuantity: data.qty,
      orderCount: data.prices.length,
      totalRevenue: totalRev,
      extrasRevenue: data.extras,
      avgPrice,
    });
    totalQuantitySold += data.qty;
    categoryQty.set(info.categoryName, (categoryQty.get(info.categoryName) || 0) + data.qty);
  });

  products.sort((a, b) => b.totalQuantity - a.totalQuantity);

  const mostProfitable = products.length > 0
    ? [...products].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]
    : null;

  const avgTicketPerProduct = products.length > 0
    ? products.reduce((s, p) => s + p.totalRevenue, 0) / products.length
    : 0;

  let topCategory = "";
  let topCatQty = 0;
  categoryQty.forEach((qty, cat) => {
    if (qty > topCatQty) { topCatQty = qty; topCategory = cat; }
  });

  return { products, totalQuantitySold, mostProfitable, avgTicketPerProduct, topCategory };
}

export function useProductPerformance(restaurantId: string, dateRange: DateRange) {
  return useQuery({
    queryKey: ["product-performance", restaurantId, dateRange],
    queryFn: () => fetchProductPerformance(restaurantId, dateRange),
    staleTime: 5 * 60 * 1000,
    enabled: !!restaurantId,
  });
}
