import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Maps sidebar section IDs to subscription module IDs
const SECTION_TO_MODULE: Record<string, string> = {
  "pedidos-online": "delivery",
  "pedidos-locais": "mesas",
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
  // "config-totem" removed — always visible, gated inside component
};

// Sections that are always available (basic config)
const ALWAYS_AVAILABLE = [
  "config-dados",
  "config-horario",
  "config-pagamentos",
  "config-impressoras",
  "modulos",
];

export function useRestaurantModules(restaurantId: string | null) {
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setAllowedModules(null); // null = all access (no plan assigned)
      setLoading(false);
      return;
    }

    fetchModules(restaurantId);
  }, [restaurantId]);

  const fetchModules = async (restId: string) => {
    try {
      const { data: sub } = await supabase
        .from("restaurant_subscriptions")
        .select("*, subscription_plans(features)")
        .eq("restaurant_id", restId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub && sub.subscription_plans) {
        const plan = sub.subscription_plans as any;
        setAllowedModules(plan.features || []);
        setHasActiveSubscription(true);
      } else {
        // No active subscription = full access (default behavior)
        setAllowedModules(null);
        setHasActiveSubscription(false);
      }
    } catch {
      setAllowedModules(null);
    } finally {
      setLoading(false);
    }
  };

  const isSectionAllowed = (sectionId: string): boolean => {
    // If no plan assigned, allow everything
    if (allowedModules === null) return true;
    // Always available sections
    if (ALWAYS_AVAILABLE.includes(sectionId)) return true;
    // Check module mapping
    const moduleId = SECTION_TO_MODULE[sectionId];
    if (!moduleId) return true; // Unmapped sections are allowed
    return allowedModules.includes(moduleId);
  };

  return { allowedModules, loading, isSectionAllowed, hasActiveSubscription };
}
