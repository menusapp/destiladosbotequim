import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPlanLimits, type PlanLimits } from "@/config/plans";

/**
 * Returns plan limits + a live count of active staff users for the restaurant,
 * derived from the canonical plan name in `subscription_plans`.
 *
 * Used by the Equipe tab to enforce the maxUsers cap (1 / 5 / Infinity) per plan.
 */
export function usePlanLimits(restaurantId: string | null, planName?: string | null) {
  const limits: PlanLimits = getPlanLimits(planName);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setStaffCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_staff", {
      p_restaurant_id: restaurantId,
    });
    if (error) {
      console.warn("[usePlanLimits] failed to load staff", error);
      setStaffCount(0);
    } else {
      const list = Array.isArray(data) ? data : [];
      setStaffCount(list.filter((s: any) => s.is_active !== false).length);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canAddUser = staffCount < limits.maxUsers;
  const remaining = Number.isFinite(limits.maxUsers)
    ? Math.max(0, limits.maxUsers - staffCount)
    : Infinity;

  return {
    limits,
    staffCount,
    loading,
    canAddUser,
    remaining,
    refresh,
  };
}
