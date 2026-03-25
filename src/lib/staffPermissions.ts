// All available sections in the system
export const ALL_SECTIONS = [
  { id: "pedidos-online", label: "Pedidos Online" },
  { id: "pedidos-locais", label: "Pedidos Locais" },
  { id: "pdv", label: "PDV" },
  { id: "mesas-reservas", label: "Mesas e Reservas" },
  { id: "cardapio", label: "Cardápio" },
  { id: "caixa", label: "Caixa" },
  { id: "estoque", label: "Estoque" },
  { id: "custos", label: "Custos" },
  { id: "margens", label: "Margens" },
  { id: "relatorios", label: "Relatório DRE" },
  { id: "clientes", label: "Clientes" },
  { id: "fidelidade", label: "Fidelidade" },
  { id: "marketing", label: "Marketing" },
  { id: "fiscal", label: "Fiscal" },
  { id: "modulos", label: "Módulos" },
  { id: "config-dados", label: "Dados da Empresa" },
  { id: "config-horario", label: "Horário de Funcionamento" },
  { id: "config-regioes", label: "Regiões de Entrega" },
  { id: "config-pagamentos", label: "Formas de Pagamento" },
  { id: "config-pagamentos-online", label: "Pagamentos Online" },
  { id: "config-impressoras", label: "Impressoras" },
  { id: "config-whatsapp", label: "Automação WhatsApp" },
  { id: "integracoes", label: "Integrações" },
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
  caixa: ["pedidos-online", "pedidos-locais", "pdv", "caixa"],
  garcom: ["pedidos-locais", "mesas-reservas", "pdv"],
  cozinha: ["pedidos-online", "pedidos-locais"],
  atendente: ["pedidos-online", "pedidos-locais", "clientes", "mesas-reservas"],
};

// Check if a staff member can access a section
export function canAccessSection(staffRole: string, allowedSections: string[], sectionId: string): boolean {
  if (staffRole === "admin") return true;
  if (sectionId === "contas") return staffRole === "admin";
  return allowedSections.includes(sectionId);
}
