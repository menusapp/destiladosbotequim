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

// Sections that are always available (basic config)
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
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [isDelinquent, setIsDelinquent] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [trialExpired, setTrialExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setAllowedModules(null);
      setLoading(false);
      return;
    }

    fetchModules(restaurantId);
  }, [restaurantId]);

  const fetchModules = async (restId: string) => {
    try {
      // Fetch subscription and restaurant trial info in parallel
      const [subResult, restResult] = await Promise.all([
        supabase
          .from("restaurant_subscriptions")
          .select("*, subscription_plans(features)")
          .eq("restaurant_id", restId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("restaurants")
          .select("trial_started_at, trial_ends_at, trial_expired")
          .eq("id", restId)
          .single(),
      ]);

      const sub = subResult.data;
      const rest = restResult.data;

      // Check trial status from restaurant
      if (rest?.trial_expired) {
        setTrialExpired(true);
      }
      if (rest?.trial_ends_at) {
        setTrialEndsAt(rest.trial_ends_at);
        if (new Date(rest.trial_ends_at) < new Date() && !sub) {
          setTrialExpired(true);
        }
      }

      if (sub && sub.subscription_plans) {
        const plan = sub.subscription_plans as any;
        setAllowedModules(plan.features || []);
        setHasActiveSubscription(true);
        setIsTrial((sub as any).is_trial === true);

        // Check if trial is expired
        if ((sub as any).is_trial && (sub as any).trial_ends_at) {
          const trialEnd = new Date((sub as any).trial_ends_at);
          if (trialEnd < new Date()) {
            setTrialExpired(true);
          }
          setTrialEndsAt((sub as any).trial_ends_at);
        }

        // Check delinquency
        const nextPayment = (sub as any).next_payment_at;
        if (nextPayment && new Date(nextPayment) < new Date()) {
          setIsDelinquent(true);
        } else {
          setIsDelinquent(false);
        }
      } else {
        setAllowedModules(null);
        setHasActiveSubscription(false);
        setIsDelinquent(false);
      }
    } catch {
      setAllowedModules(null);
    } finally {
      setLoading(false);
    }
  };

  const isSectionAllowed = (sectionId: string): boolean => {
    if (allowedModules === null) return true;
    if (ALWAYS_AVAILABLE.includes(sectionId)) return true;
    const moduleId = SECTION_TO_MODULE[sectionId];
    if (!moduleId) return true;
    return allowedModules.includes(moduleId);
  };

  return { allowedModules, loading, isSectionAllowed, hasActiveSubscription, isDelinquent, isTrial, trialEndsAt, trialExpired };
}
