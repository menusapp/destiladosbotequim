// All available sections in the system
export const ALL_SECTIONS = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "pedidos", label: "Pedidos" },
  { id: "pdv", label: "PDV" },
  { id: "mesas-reservas", label: "Reservas" },
  { id: "cardapio", label: "Cardápio" },
  { id: "estoque", label: "Estoque" },
  { id: "caixa", label: "Caixa" },
  { id: "custos", label: "Custos" },
  { id: "margens", label: "Margens" },
  { id: "relatorios", label: "Relatório DRE" },
  { id: "clientes", label: "Clientes" },
  { id: "fidelidade", label: "Fidelidade" },
  { id: "marketing", label: "Marketing" },
  { id: "robo-menus", label: "Robô Menu's" },
  { id: "integracoes", label: "Integrações" },
  { id: "fiscal", label: "Fiscal" },
  { id: "modulos", label: "Planos" },
  { id: "config-dados", label: "Configurações — Geral" },
  { id: "config-totem", label: "Configurações — Totem" },
  { id: "config-whatsapp", label: "Configurações — WhatsApp" },
  { id: "contas", label: "Contas (Funcionários)" },
] as const;

export type StaffRole = "admin" | "gerente" | "caixa" | "garcom" | "cozinha" | "atendente";

export const STAFF_ROLES: { value: StaffRole; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Acesso total ao sistema + gerenciamento de contas" },
  { value: "gerente", label: "Gerente", description: "Acesso completo exceto Contas e Módulos" },
  { value: "caixa", label: "Caixa", description: "PDV, Caixa, Pedidos Online e Locais" },
  { value: "garcom", label: "Garçom", description: "Pedidos Locais, Mesas e Reservas, PDV" },
  { value: "cozinha", label: "Cozinha", description: "Pedidos Online e Locais (visualização)" },
  { value: "atendente", label: "Atendente", description: "Pedidos, Clientes, Mesas e Reservas" },
];

// Default sections per role (pre-selected when creating a new staff account)
export const ROLE_DEFAULT_SECTIONS: Record<StaffRole, string[]> = {
  admin: ALL_SECTIONS.map(s => s.id),
  gerente: ALL_SECTIONS.map(s => s.id).filter(id => id !== "modulos"),
  caixa: ["visao-geral", "pedidos", "pdv", "caixa"],
  garcom: ["pedidos", "mesas-reservas", "pdv"],
  cozinha: ["pedidos"],
  atendente: ["pedidos", "clientes", "mesas-reservas"],
};

// Check if a staff member can access a section
export function canAccessSection(staffRole: string, allowedSections: string[], sectionId: string): boolean {
  if (staffRole === "admin") return true;
  return allowedSections.includes(sectionId);
}
