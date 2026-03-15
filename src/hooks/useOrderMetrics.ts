import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subDays, startOfMonth, endOfMonth, subMonths, startOfYear, startOfDay, endOfDay } from "date-fns";

export type DateRange = "today" | "yesterday" | "7days" | "30days" | "thisMonth" | "lastMonth" | "60days" | "annual";

/** ÚNICA fonte de verdade para status finalizados */
export const FINALIZED_ORDER_STATUSES = ["delivered", "picked_up"];

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
  revenueByMethod: { method: string; total: number }[];
  /** IDs for CMV calculations */
  deliveryOrderIds: string[];
  localOrderIds: string[];
  counterOrderIds: string[];
}

function calcOrderTotal(order: any): number {
  return (order.order_items || []).reduce((sum: number, item: any) => {
    const extras = (item.order_item_extras || []).reduce((s: number, e: any) => s + (e.price_at_order || 0), 0);
    return sum + (item.price_at_order + extras) * item.quantity;
  }, 0);
}

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

export function useOrderMetrics(restaurantId: string, dateRange: DateRange) {
  const [metrics, setMetrics] = useState<OrderMetrics>({
    totalSales: 0, ordersCount: 0, averageTicket: 0,
    localSales: 0, deliverySales: 0, hourlySales: [], revenueByMethod: [],
    deliveryOrderIds: [], localOrderIds: [], counterOrderIds: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const { start, end } = getDateRange(dateRange);

      // Fetch all data sources in parallel
      const [deliveryRes, localBillsRes, counterRes, paymentMethodsRes] = await Promise.all([
        // Delivery orders — only finalized
        supabase.from("orders")
          .select("id, created_at, order_type, delivery_fee, coupon_discount, loyalty_points_used, payment_type, order_items(price_at_order, quantity, order_item_extras(price_at_order))")
          .eq("restaurant_id", restaurantId)
          .eq("order_type", "delivery")
          .in("status", FINALIZED_ORDER_STATUSES)
          .gte("created_at", start).lte("created_at", end),
        // Local bills paid
        supabase.from("bills")
          .select("id, total_amount, payment_method, paid_at, table_id, tables!inner(restaurant_id)")
          .eq("tables.restaurant_id", restaurantId)
          .eq("status", "paid")
          .gte("paid_at", start).lte("paid_at", end),
        // Counter orders paid
        supabase.from("counter_orders")
          .select("id, total_amount, finalized_at, payment_method")
          .eq("restaurant_id", restaurantId).eq("status", "paid")
          .gte("finalized_at", start).lte("finalized_at", end),
        // Payment methods for normalization
        supabase.from("payment_methods")
          .select("id, name, method_type")
          .eq("restaurant_id", restaurantId),
      ]);

      const deliveryOrders = deliveryRes.data || [];
      const paidBills = localBillsRes.data || [];
      const counterOrders = counterRes.data || [];
      const paymentMethods = paymentMethodsRes.data || [];

      // --- Calculate totals ---
      let deliverySales = 0;
      deliveryOrders.forEach(o => { deliverySales += calcDeliveryOrderTotal(o); });
      const deliveryOrderIds = deliveryOrders.map(o => o.id);

      const billsTotal = paidBills.reduce((s, b) => s + Number(b.total_amount), 0);
      const counterTotal = counterOrders.reduce((s, co) => s + (co.total_amount || 0), 0);
      const localSales = billsTotal + counterTotal;
      const totalSales = localSales + deliverySales;

      // Get local order IDs for CMV
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
      const counterOrderIds = counterOrders.map(o => o.id);

      const totalCount = paidBills.length + deliveryOrders.length + counterOrders.length;
      const averageTicket = totalCount > 0 ? totalSales / totalCount : 0;

      // --- Hourly sales (only today) ---
      let hourlySales: { hour: string; total: number }[] = [];
      if (dateRange === "today") {
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
        hourlySales = Array.from(hourlyMap.entries()).map(([hour, total]) => ({ hour, total })).sort((a, b) => a.hour.localeCompare(b.hour));
      }

      // --- Revenue by payment method ---
      const normalizeMethod = (method: string | null | undefined): string | null => {
        if (!method) return null;
        const validTypes = ["cash", "credit", "debit", "pix", "meal_voucher"];
        if (validTypes.includes(method)) return method;
        if (method === "card") return "credit";
        const byId = paymentMethods.find(p => p.id === method);
        if (byId) return byId.method_type;
        const byName = paymentMethods.find(p => p.name.toLowerCase() === method.toLowerCase());
        if (byName) return byName.method_type;
        return null;
      };

      const methodTotals: Record<string, number> = {};
      paidBills.forEach((b: any) => {
        const m = normalizeMethod(b.payment_method) || "Outros";
        methodTotals[m] = (methodTotals[m] || 0) + Number(b.total_amount);
      });
      counterOrders.forEach((co: any) => {
        const m = normalizeMethod(co.payment_method) || "Outros";
        methodTotals[m] = (methodTotals[m] || 0) + Number(co.total_amount);
      });
      deliveryOrders.forEach((o: any) => {
        const m = normalizeMethod(o.payment_type) || "Outros";
        methodTotals[m] = (methodTotals[m] || 0) + calcDeliveryOrderTotal(o);
      });

      const revenueByMethod = Object.entries(methodTotals)
        .filter(([_, total]) => total > 0)
        .map(([method, total]) => ({ method, total }));

      setMetrics({
        totalSales, ordersCount: totalCount, averageTicket,
        localSales, deliverySales, hourlySales, revenueByMethod,
        deliveryOrderIds, localOrderIds, counterOrderIds,
      });
    } catch (err) {
      console.error("Error fetching order metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, dateRange]);

  useEffect(() => {
    setLoading(true);
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, refetch: fetchMetrics };
}
