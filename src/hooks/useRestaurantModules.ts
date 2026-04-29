import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Maps sidebar section IDs to subscription module IDs
const SECTION_TO_MODULE: Record<string, string> = {
  "pedidos-online": "delivery",
  "pedidos-locais": "mesas",
  "pedidos": "delivery",
  "pdv": "pdv",
  "mesas-reservas": "mesas",
  "cardapio": "cardapio",
  "caixa": "financeiro",
  "estoque": "estoque",
  "custos": "financeiro",
  "margens": "financeiro",
  "relatorios": "financeiro",
  "clientes": "cardapio",
  "fidelidade": "fidelidade",
  "marketing": "marketing",
  "fiscal": "fiscal",
  "notas-fiscais": "fiscal",
  "config-whatsapp": "whatsapp",
  "config-pagamentos-online": "pagamentos_online",
  "config-regioes": "delivery",
  "integracoes": "delivery",
};

// Sections that are always available (basic config + planos screen)
const ALWAYS_AVAILABLE = [
  "visao-geral",
  "config-dados",
  "config-horario",
  "config-pagamentos",
  "config-impressoras",
  "config-totem",
  "modulos",
  "robo-menus",
];

export function useRestaurantModules(restaurantId: string | null) {
  // null = not loaded yet; [] = loaded but nothing allowed; [..] = loaded with features
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [isDelinquent, setIsDelinquent] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!restaurantId) {
      setAllowedModules(null);
      setHasActiveSubscription(null);
      setLoading(false);
      setLoaded(false);
      return;
    }

    setLoading(true);
    setLoaded(false);
    fetchModules(restaurantId);
  }, [restaurantId]);

  const fetchModules = async (restId: string) => {
    try {
      // IMPORTANT: never use .single()/.maybeSingle() on this query — historical
      // rows (cancelled/suspended) and webhook race conditions can produce more
      // than one match and trigger a 406 that would silently fail-open.
      const [subResult, restResult] = await Promise.all([
        supabase
          .from("restaurant_subscriptions")
          .select("plan_id, status, is_trial, next_payment_at, subscription_plans!restaurant_subscriptions_plan_id_fkey(name, features)")
          .eq("restaurant_id", restId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("restaurants")
          .select("trial_started_at, trial_ends_at, trial_expired")
          .eq("id", restId)
          .maybeSingle(),
      ]);

      if (subResult.error) {
        console.warn("[useRestaurantModules] subscription fetch error:", subResult.error);
      }
      if (restResult.error) {
        console.warn("[useRestaurantModules] restaurant fetch error:", restResult.error);
      }

      const sub = (subResult.data && subResult.data[0]) || null;
      const rest = restResult.data;

      // Trial status from the restaurant row
      let trialIsExpired = false;
      if (rest?.trial_expired) trialIsExpired = true;
      if (rest?.trial_ends_at) {
        setTrialEndsAt(rest.trial_ends_at);
        if (new Date(rest.trial_ends_at) < new Date() && !sub) {
          trialIsExpired = true;
        }
      }
      setTrialExpired(trialIsExpired);

      if (sub && (sub as any).subscription_plans) {
        const plan = (sub as any).subscription_plans as { name?: string; features?: string[] };
        const features = Array.isArray(plan.features) ? plan.features : [];
        setAllowedModules(features);
        setHasActiveSubscription(true);
        setIsTrial((sub as any).is_trial === true);

        if ((sub as any).is_trial && (sub as any).trial_ends_at) {
          const trialEnd = new Date((sub as any).trial_ends_at);
          if (trialEnd < new Date()) setTrialExpired(true);
          setTrialEndsAt((sub as any).trial_ends_at);
        }

        const nextPayment = (sub as any).next_payment_at;
        setIsDelinquent(!!(nextPayment && new Date(nextPayment) < new Date()));
      } else {
        // FAIL-CLOSED: no active subscription => no modules allowed.
        // ALWAYS_AVAILABLE sections (visao-geral, modulos, configs básicas)
        // remain accessible via isSectionAllowed below so the user can reach
        // the plans screen and pay.
        setAllowedModules([]);
        setHasActiveSubscription(false);
        setIsDelinquent(false);
        setIsTrial(false);
      }
    } catch (err) {
      console.warn("[useRestaurantModules] unexpected error:", err);
      // Fail-closed on error
      setAllowedModules([]);
      setHasActiveSubscription(false);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const isSectionAllowed = (sectionId: string): boolean => {
    // Always-available sections never gate on plan
    if (ALWAYS_AVAILABLE.includes(sectionId)) return true;
    // Until we've actually loaded the subscription, fail-closed to avoid
    // a flash of unrestricted UI for paid sections.
    if (!loaded || allowedModules === null) return false;
    const moduleId = SECTION_TO_MODULE[sectionId];
    if (!moduleId) return true; // Sections not in the map are not plan-gated
    return allowedModules.includes(moduleId);
  };

  return {
    allowedModules,
    loading,
    loaded,
    isSectionAllowed,
    hasActiveSubscription,
    isDelinquent,
    isTrial,
    trialEndsAt,
    trialExpired,
  };
}
