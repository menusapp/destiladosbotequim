import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear, startOfDay, endOfDay } from "date-fns";

export type DateRange = "today" | "yesterday" | "7days" | "30days" | "thisMonth" | "lastMonth" | "60days" | "annual";

/** ÚNICA fonte de verdade para status finalizados */
export const FINALIZED_ORDER_STATUSES = ["delivered", "picked_up"];

/** Status que representam vendas confirmadas (para visão geral) */
export const CONFIRMED_ORDER_STATUSES = ["accepted", "preparing", "ready", "out_for_delivery", "delivered", "picked_up"];

export function getDateRange(range: DateRange): { start: string; end: string } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = subDays(now, 1);
      return { start: startOfDay(y).toISOString(), end: endOfDay(y).toISOString() };
    }
    case "7days":
      return { start: startOfDay(subDays(now, 6)).toISOString(), end: endOfDay(now).toISOString() };
    case "30days":
      return { start: startOfDay(subDays(now, 29)).toISOString(), end: endOfDay(now).toISOString() };
    case "thisMonth":
      return { start: startOfMonth(now).toISOString(), end: endOfMonth(now).toISOString() };
    case "lastMonth": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm).toISOString(), end: endOfMonth(lm).toISOString() };
    }
    case "60days":
      return { start: startOfDay(subDays(now, 59)).toISOString(), end: endOfDay(now).toISOString() };
    case "annual":
      return { start: startOfYear(now).toISOString(), end: endOfDay(now).toISOString() };
  }
}

export interface OrderMetrics {
  totalSales: number;
  ordersCount: number;
  averageTicket: number;
  localSales: number;
  deliverySales: number;
  hourlySales: { hour: string; total: number }[];
  dailySales: { day: string; total: number }[];
  revenueByMethod: { method: string; total: number }[];
  deliveryOrderIds: string[];
  localOrderIds: string[];
  counterOrderIds: string[];
  totemOrderIds: string[];
}

const EMPTY_METRICS: OrderMetrics = {
  totalSales: 0, ordersCount: 0, averageTicket: 0,
  localSales: 0, deliverySales: 0, hourlySales: [], dailySales: [], revenueByMethod: [],
  deliveryOrderIds: [], localOrderIds: [], counterOrderIds: [], totemOrderIds: [],
};

function calcDeliveryOrderTotal(order: any): number {
  let subtotal = 0;
  (order.order_items || []).forEach((item: any) => {
    const extrasTotal = (item.order_item_extras || []).reduce(
      (sum: number, extra: any) => sum + Number(extra.price_at_order || 0), 0
    );
    subtotal += (item.price_at_order * item.quantity) + extrasTotal;
  });
  const deliveryFee = Number(order.delivery_fee || 0);
  const couponDiscount = Number(order.coupon_discount || 0);
  const loyaltyDiscount = Number(order.loyalty_points_used || 0) * 0.01;
  return subtotal + deliveryFee - couponDiscount - loyaltyDiscount;
}

function calcTotemOrderTotal(order: any): number {
  let subtotal = 0;
  (order.order_items || []).forEach((item: any) => {
    const extrasTotal = (item.order_item_extras || []).reduce(
      (sum: number, extra: any) => sum + Number(extra.price_at_order || 0), 0
    );
    subtotal += (item.price_at_order * item.quantity) + extrasTotal;
  });
  return subtotal - Number(order.coupon_discount || 0);
}

async function fetchOrderMetrics(restaurantId: string, dateRange: DateRange): Promise<OrderMetrics> {
  const { start, end } = getDateRange(dateRange);

  const [deliveryRes, localBillsRes, counterRes, totemRes, paymentMethodsRes, cashMovementsRes, pdvPaidRes] = await Promise.all([
    supabase.from("orders")
      .select("id, created_at, order_type, delivery_fee, coupon_discount, loyalty_points_used, payment_type, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "delivery")
      .in("status", CONFIRMED_ORDER_STATUSES)
      .gte("created_at", start).lte("created_at", end),
    supabase.from("bills")
      .select("id, total_amount, payment_method, payment_splits, paid_at, table_id, tables!inner(restaurant_id)")
      .eq("tables.restaurant_id", restaurantId)
      .eq("status", "paid")
      .gt("total_amount", 0)
      .gte("paid_at", start).lte("paid_at", end),
    supabase.from("counter_orders")
      .select("id, total_amount, finalized_at, payment_method")
      .eq("restaurant_id", restaurantId).eq("status", "paid")
      .gte("finalized_at", start).lte("finalized_at", end),
    supabase.from("orders")
      .select("id, paid_at, order_type, delivery_type, payment_type, payment_brand, coupon_discount, delivery_fee, loyalty_points_used, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
      .eq("restaurant_id", restaurantId)
      .eq("order_channel", "totem")
      .eq("payment_status", "paid")
      .gte("paid_at", start).lte("paid_at", end),
    supabase.from("payment_methods")
      .select("id, name, method_type")
      .eq("restaurant_id", restaurantId),
    supabase.from("cash_movements")
      .select("id, amount, order_id, bill_id, payment_method, category, created_at")
      .eq("restaurant_id", restaurantId)
      .eq("movement_type", "entrada")
      .gte("created_at", start).lte("created_at", end),
    // PDV paid orders (local/balcao with payment_status=paid, not totem)
    supabase.from("orders")
      .select("id, created_at, paid_at, order_type, payment_type, payment_status, coupon_discount, table_id, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
      .eq("restaurant_id", restaurantId)
      .in("order_type", ["local", "balcao"])
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", start).lte("created_at", end),
  ]);

  const deliveryOrders = deliveryRes.data || [];
  const paidBills = localBillsRes.data || [];
  const counterOrders = counterRes.data || [];
  const totemOrders = totemRes.data || [];
  const paymentMethods = paymentMethodsRes.data || [];
  const cashMovements = cashMovementsRes.data || [];
  const pdvPaidOrders = pdvPaidRes.data || [];

  // Build sets of known IDs from standard queries
  const knownOrderIds = new Set<string>();
  const knownBillIds = new Set<string>();

  deliveryOrders.forEach(o => knownOrderIds.add(o.id));
  totemOrders.forEach(o => knownOrderIds.add(o.id));
  paidBills.forEach(b => knownBillIds.add(b.id));

  // Identify table_ids covered by bills with real amounts
  const billCoveredTableIds = new Set(paidBills.map(b => b.table_id));

  // PDV paid orders NOT already covered by bills or totem
  const pdvUncoveredOrders = pdvPaidOrders.filter(o => {
    // Already counted as totem
    if (knownOrderIds.has(o.id)) return false;
    // If this order's table has a bill with total_amount > 0, it's covered
    if (o.table_id && billCoveredTableIds.has(o.table_id)) return false;
    return true;
  });

  // Calculate PDV uncovered totals
  let pdvPaidLocalTotal = 0;
  const pdvPaidOrderIds: string[] = [];
  pdvUncoveredOrders.forEach(o => {
    const total = calcTotemOrderTotal(o); // same calc: items - coupon
    pdvPaidLocalTotal += total;
    pdvPaidOrderIds.push(o.id);
    knownOrderIds.add(o.id);
  });

  // Find cash_movements entries NOT covered by standard queries
  const uncoveredCashEntries = cashMovements.filter(cm => {
    if (cm.order_id && knownOrderIds.has(cm.order_id)) return false;
    if (cm.bill_id && knownBillIds.has(cm.bill_id)) return false;
    if (!cm.order_id && !cm.bill_id) return false;
    return true;
  });

  let deliverySales = 0;
  deliveryOrders.forEach(o => { deliverySales += calcDeliveryOrderTotal(o); });
  const deliveryOrderIds = deliveryOrders.map(o => o.id);

  const billsTotal = paidBills.reduce((s, b) => s + Number(b.total_amount), 0);
  const counterTotal = counterOrders.reduce((s, co) => s + (co.total_amount || 0), 0);

  let totemLocalSales = 0;
  let totemDeliverySales = 0;
  totemOrders.forEach(o => {
    const total = calcTotemOrderTotal(o);
    if (o.order_type === 'delivery') {
      totemDeliverySales += total;
    } else {
      totemLocalSales += total;
    }
  });
  const totemOrderIds = totemOrders.map(o => o.id);

  // Add uncovered cash entries to the appropriate bucket
  let uncoveredLocalTotal = 0;
  let uncoveredDeliveryTotal = 0;
  const uncoveredOrderIds: string[] = [];
  uncoveredCashEntries.forEach(cm => {
    const amount = Number(cm.amount || 0);
    const isDelivery = cm.category === 'Delivery' || cm.category === 'Totem';
    if (isDelivery) {
      uncoveredDeliveryTotal += amount;
    } else {
      uncoveredLocalTotal += amount;
    }
    if (cm.order_id) {
      uncoveredOrderIds.push(cm.order_id);
      knownOrderIds.add(cm.order_id);
    }
    if (cm.bill_id) knownBillIds.add(cm.bill_id);
  });

  const localSales = billsTotal + counterTotal + totemLocalSales + pdvPaidLocalTotal + uncoveredLocalTotal;
  deliverySales += totemDeliverySales + uncoveredDeliveryTotal;
  const totalSales = localSales + deliverySales;

  const tableIds = [...new Set(paidBills.map(b => b.table_id))];
  let localOrderIds: string[] = [];
  if (tableIds.length > 0) {
    const { data: localOrders } = await supabase
      .from("orders")
      .select("id")
      .in("table_id", tableIds)
      .eq("order_type", "local")
      .gte("created_at", start).lte("created_at", end);
    localOrderIds = (localOrders || []).map(o => o.id);
  }
  // Include PDV paid order IDs in localOrderIds
  localOrderIds = [...localOrderIds, ...pdvPaidOrderIds];
  const counterOrderIds = counterOrders.map(o => o.id);

  const totalCount = paidBills.length + deliveryOrders.length + counterOrders.length + totemOrders.length + pdvUncoveredOrders.length + uncoveredCashEntries.length;
  const averageTicket = totalCount > 0 ? totalSales / totalCount : 0;

  let hourlySales: { hour: string; total: number }[] = [];
  let dailySales: { day: string; total: number }[] = [];
  const isSingleDay = dateRange === "today" || dateRange === "yesterday";

  if (isSingleDay) {
    const hourlyMap = new Map<string, number>();
    for (let h = 6; h <= 23; h++) hourlyMap.set(h.toString().padStart(2, "0") + ":00", 0);
    deliveryOrders.forEach(o => {
      const h = new Date(o.created_at).getHours().toString().padStart(2, "0") + ":00";
      hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcDeliveryOrderTotal(o));
    });
    counterOrders.forEach(co => {
      if (co.finalized_at) {
        const h = new Date(co.finalized_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + (co.total_amount || 0));
      }
    });
    paidBills.forEach(b => {
      if (b.paid_at) {
        const h = new Date(b.paid_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + Number(b.total_amount || 0));
      }
    });
    totemOrders.forEach(o => {
      if (o.paid_at) {
        const h = new Date(o.paid_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcTotemOrderTotal(o));
      }
    });
    uncoveredCashEntries.forEach(cm => {
      if (cm.created_at) {
        const h = new Date(cm.created_at).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + Number(cm.amount || 0));
      }
    });
    pdvUncoveredOrders.forEach(o => {
      const ts = o.paid_at || o.created_at;
      if (ts) {
        const h = new Date(ts).getHours().toString().padStart(2, "0") + ":00";
        hourlyMap.set(h, (hourlyMap.get(h) || 0) + calcTotemOrderTotal(o));
      }
    });
    hourlySales = Array.from(hourlyMap.entries()).map(([hour, total]) => ({ hour, total })).sort((a, b) => a.hour.localeCompare(b.hour));
  } else {
    const dailyMap = new Map<string, number>();
    const startDate = new Date(start);
    const endDate = new Date(end);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    deliveryOrders.forEach(o => {
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) || 0) + calcDeliveryOrderTotal(o));
    });
    counterOrders.forEach(co => {
      if (co.finalized_at) {
        const d = new Date(co.finalized_at).toISOString().slice(0, 10);
        dailyMap.set(d, (dailyMap.get(d) || 0) + (co.total_amount || 0));
      }
    });
    paidBills.forEach(b => {
      if (b.paid_at) {
        const d = new Date(b.paid_at).toISOString().slice(0, 10);
        dailyMap.set(d, (dailyMap.get(d) || 0) + Number(b.total_amount || 0));
      }
    });
    totemOrders.forEach(o => {
      if (o.paid_at) {
        const d = new Date(o.paid_at).toISOString().slice(0, 10);
        dailyMap.set(d, (dailyMap.get(d) || 0) + calcTotemOrderTotal(o));
      }
    });
    uncoveredCashEntries.forEach(cm => {
      if (cm.created_at) {
        const d = new Date(cm.created_at).toISOString().slice(0, 10);
        dailyMap.set(d, (dailyMap.get(d) || 0) + Number(cm.amount || 0));
      }
    });
    pdvUncoveredOrders.forEach(o => {
      const ts = o.paid_at || o.created_at;
      if (ts) {
        const d = new Date(ts).toISOString().slice(0, 10);
        dailyMap.set(d, (dailyMap.get(d) || 0) + calcTotemOrderTotal(o));
      }
    });
    dailySales = Array.from(dailyMap.entries()).map(([day, total]) => ({ day, total })).sort((a, b) => a.day.localeCompare(b.day));
  }

  const normalizeMethod = (method: string | null | undefined): string => {
    if (!method) return "Outros";
    const base = method.split(" - ")[0].trim();
    if (base.startsWith("Crédito") || base.startsWith("Créd")) return "Crédito";
    if (base.startsWith("Débito") || base.startsWith("Déb")) return "Débito";
    if (base.startsWith("Vale")) return "Vale Refeição";
    if (base === "Dinheiro") return "Dinheiro";
    if (base === "PIX") return "PIX";
    if (method === "cash") return "Dinheiro";
    if (method === "pix" || method === "pix_online") return "PIX";
    if (method === "credit" || method === "card" || method === "credit_card_online") return "Crédito";
    if (method === "debit") return "Débito";
    if (method === "meal_voucher" || method === "voucher") return "Vale Refeição";
    if (method === "bank_transfer") return "PIX";
    if (method === "Pago pelo iFood" || method === "ifood_online") return "iFood Online";
    if (method === "employee_credit") return "Crédito Funcionário";
    const byId = paymentMethods.find(p => p.id === method);
    if (byId) return normalizeMethod(byId.method_type);
    const byName = paymentMethods.find(p => p.name.toLowerCase() === method.toLowerCase());
    if (byName) return normalizeMethod(byName.method_type);
    return "Outros";
  };

  const addMethodRevenue = (methodTotals: Record<string, number>, method: string | null | undefined, total: number) => {
    if (!method) {
      methodTotals["Outros"] = (methodTotals["Outros"] || 0) + total;
      return;
    }
    if (method.includes(",")) {
      const parts = method.split(",").map(s => s.trim()).filter(Boolean);
      const perPart = total / (parts.length || 1);
      for (const part of parts) {
        const m = normalizeMethod(part);
        methodTotals[m] = (methodTotals[m] || 0) + perPart;
      }
      return;
    }
    const m = normalizeMethod(method);
    methodTotals[m] = (methodTotals[m] || 0) + total;
  };

  const methodTotals: Record<string, number> = {};
  paidBills.forEach((b: any) => {
    const splits = b.payment_splits;
    if (Array.isArray(splits) && splits.length > 0) {
      for (const split of splits) {
        const m = normalizeMethod(split.display || split.method);
        methodTotals[m] = (methodTotals[m] || 0) + Number(split.amount || 0);
      }
    } else {
      addMethodRevenue(methodTotals, b.payment_method, Number(b.total_amount));
    }
  });
  counterOrders.forEach((co: any) => {
    addMethodRevenue(methodTotals, co.payment_method, Number(co.total_amount));
  });
  deliveryOrders.forEach((o: any) => {
    addMethodRevenue(methodTotals, o.payment_type, calcDeliveryOrderTotal(o));
  });
  totemOrders.forEach((o: any) => {
    addMethodRevenue(methodTotals, o.payment_type, calcTotemOrderTotal(o));
  });
  // Add uncovered cash entries to payment method breakdown
  uncoveredCashEntries.forEach((cm: any) => {
    addMethodRevenue(methodTotals, cm.payment_method, Number(cm.amount || 0));
  });
  // Add PDV paid orders to payment method breakdown
  pdvUncoveredOrders.forEach((o: any) => {
    addMethodRevenue(methodTotals, o.payment_type, calcTotemOrderTotal(o));
  });

  const revenueByMethod = Object.entries(methodTotals)
    .filter(([_, total]) => total > 0)
    .map(([method, total]) => ({ method, total }));

  return {
    totalSales, ordersCount: totalCount, averageTicket,
    localSales, deliverySales, hourlySales, dailySales, revenueByMethod,
    deliveryOrderIds, localOrderIds, counterOrderIds, totemOrderIds,
  };
}

export function useOrderMetrics(restaurantId: string, dateRange: DateRange) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order-metrics", restaurantId, dateRange],
    queryFn: () => fetchOrderMetrics(restaurantId, dateRange),
    staleTime: 2 * 60 * 1000,
    enabled: !!restaurantId,
  });

  const stableRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  return { metrics: data || EMPTY_METRICS, loading: isLoading, refetch: stableRefetch };
}
