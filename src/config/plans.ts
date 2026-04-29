// Central plan configuration — single source of truth for plan-based limits.
// Module gating itself is driven by `subscription_plans.features` in the database
// (see useRestaurantModules). This file only declares limits that are NOT
// represented in the DB (e.g. max staff users per plan).

export type PlanId = "basic" | "intermediate" | "advanced";

export interface PlanLimits {
  id: PlanId;
  name: string;
  price: number;
  /** Maximum number of staff users allowed (Infinity = unlimited). */
  maxUsers: number;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  basic: {
    id: "basic",
    name: "Básico",
    price: 69.9,
    maxUsers: 1,
  },
  intermediate: {
    id: "intermediate",
    name: "Intermediário",
    price: 149.9,
    maxUsers: 5,
  },
  advanced: {
    id: "advanced",
    name: "Avançado",
    price: 249.9,
    maxUsers: Infinity,
  },
};

/**
 * Resolve the canonical PlanId from the plan name returned by the DB
 * (subscription_plans.name). Falls back to "basic" when unrecognized.
 */
export function resolvePlanId(planName?: string | null): PlanId {
  const n = (planName || "").toLowerCase();
  if (n.includes("avanç") || n.includes("avanc")) return "advanced";
  if (n.includes("interm")) return "intermediate";
  return "basic";
}

export function getPlanLimits(planName?: string | null): PlanLimits {
  return PLANS[resolvePlanId(planName)];
}
