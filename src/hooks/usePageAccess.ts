import { useRestaurantModules } from "./useRestaurantModules";

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

const ALWAYS_AVAILABLE = [
  "visao-geral",
  "config-dados",
  "config-horario",
  "config-pagamentos",
  "config-impressoras",
  "config-totem",
  "modulos",
  "contas",
  "robo-menus",
];

// Map modules to minimum required plan
const MODULE_TO_PLAN: Record<string, string> = {
  cardapio: "Básico",
  delivery: "Intermediário",
  mesas: "Básico",
  pdv: "Básico",
  financeiro: "Intermediário",
  estoque: "Intermediário",
  fidelidade: "Intermediário",
  marketing: "Avançado",
  fiscal: "Avançado",
  whatsapp: "Avançado",
  pagamentos_online: "Intermediário",
};

export interface PageAccess {
  hasAccess: boolean;
  reason: 'plan' | 'permission' | 'trial_expired' | null;
  currentPlanName: string | null;
  requiredPlanName: string | null;
}

export function usePageAccess(
  sectionId: string,
  restaurantId: string | null,
  staffRole?: string,
  staffAllowedSections?: string[]
): PageAccess {
  const { isSectionAllowed, hasActiveSubscription, isTrial, trialExpired } = useRestaurantModules(restaurantId);

  // Trial expired blocks everything
  if (trialExpired && sectionId !== "modulos") {
    return { hasAccess: false, reason: 'trial_expired', currentPlanName: 'Trial expirado', requiredPlanName: 'Básico' };
  }

  // Always available sections
  if (ALWAYS_AVAILABLE.includes(sectionId)) {
    // Still check staff permission
    if (staffRole && staffRole !== "admin") {
      if (sectionId === "contas") {
        return { hasAccess: false, reason: 'permission', currentPlanName: null, requiredPlanName: null };
      }
      if (staffAllowedSections && !staffAllowedSections.includes(sectionId)) {
        return { hasAccess: false, reason: 'permission', currentPlanName: null, requiredPlanName: null };
      }
    }
    return { hasAccess: true, reason: null, currentPlanName: null, requiredPlanName: null };
  }

  // Check plan access
  if (!isSectionAllowed(sectionId)) {
    const moduleId = SECTION_TO_MODULE[sectionId];
    const requiredPlan = moduleId ? MODULE_TO_PLAN[moduleId] || "Intermediário" : "Intermediário";
    return { hasAccess: false, reason: 'plan', currentPlanName: null, requiredPlanName: requiredPlan };
  }

  // Check staff permission
  if (staffRole && staffRole !== "admin") {
    if (sectionId === "contas") {
      return { hasAccess: false, reason: 'permission', currentPlanName: null, requiredPlanName: null };
    }
    if (staffAllowedSections && !staffAllowedSections.includes(sectionId)) {
      return { hasAccess: false, reason: 'permission', currentPlanName: null, requiredPlanName: null };
    }
  }

  return { hasAccess: true, reason: null, currentPlanName: null, requiredPlanName: null };
}
