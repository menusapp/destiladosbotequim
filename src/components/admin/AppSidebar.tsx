import { useState, Fragment } from "react";
import {
  ShoppingBag,
  CreditCard,
  Users2,
  Utensils,
  Warehouse,
  BarChart3,
  TrendingUp,
  Users,
  Settings,
  CircleDollarSign,
  MessageCircle,
  Construction,
  ChevronDown,
  ChevronRight,
  Building2,
  Clock,
  MapPin,
  Printer,
  MessageSquare,
  Megaphone,
  Gift,
  Smartphone,
  FileText,
  Plug,
  HardDrive,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  hasNewOrders?: boolean;
  hasNewBills?: boolean;
  hasNewDeliveryOrders?: boolean;
  hasNewLocalOrders?: boolean;
  isSectionAllowed?: (sectionId: string) => boolean;
  hasActiveSubscription?: boolean | null;
  staffRole?: string;
  staffAllowedSections?: string[];
  primaryColor?: string;
  onPrefetch?: (sectionId: string) => void;
}

export function AppSidebar({ activeSection, onSectionChange, hasNewOrders, hasNewBills, hasNewDeliveryOrders, hasNewLocalOrders, isSectionAllowed, hasActiveSubscription, staffRole, staffAllowedSections, primaryColor = "#FF6B35", onPrefetch }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [configOpen, setConfigOpen] = useState(activeSection.startsWith("config-"));

  const menuGroups = [
    // Visão Geral
    [
      { id: "visao-geral", label: "Visão Geral", icon: BarChart3 },
    ],
    // Vendas & Operação
    [
      { id: "pedidos", label: "Pedidos", icon: ShoppingBag, hasNotification: (hasNewDeliveryOrders || hasNewOrders || hasNewBills) },
      { id: "pdv", label: "PDV", icon: CreditCard, hasNotification: !!hasNewLocalOrders },
      { id: "mesas-reservas", label: "Reservas", icon: Users2 },
    ],
    // Cardápio & Estoque
    [
      { id: "cardapio", label: "Cardápio", icon: Utensils },
      { id: "estoque", label: "Estoque", icon: Warehouse },
    ],
    // Financeiro
    [
      { id: "caixa", label: "Caixa", icon: CircleDollarSign },
      { id: "custos", label: "Custos", icon: CircleDollarSign },
      { id: "margens", label: "Margens", icon: TrendingUp },
      { id: "relatorios", label: "Relatório DRE", icon: BarChart3 },
    ],
    // Clientes & Engajamento
    [
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "fidelidade", label: "Fidelidade", icon: Gift },
      { id: "marketing", label: "Marketing", icon: Megaphone },
    ],
    // Administrativo
    [
      { id: "integracoes", label: "Integrações", icon: Plug },
      { id: "fiscal", label: "Fiscal", icon: FileText },
      ...(staffRole === "admin" ? [{ id: "contas", label: "Contas", icon: Users }] : []),
      { id: "modulos", label: "Planos", icon: Construction },
    ],
  ];

  const menuStructure = {
    configSubItems: [
      { id: "config-dados", label: "Configurações Gerais", icon: Building2 },
      { id: "config-horario", label: "Horário de Funcionamento", icon: Clock },
      { id: "config-regioes", label: "Regiões de Entrega", icon: MapPin },
      { id: "config-pagamentos", label: "Formas de Pagamento", icon: CreditCard },
      { id: "config-pagamentos-online", label: "Pagamentos Online", icon: Smartphone },
      { id: "config-impressoras", label: "Impressoras", icon: Printer },
      { id: "config-whatsapp", label: "Automação WhatsApp", icon: MessageSquare },
      { id: "config-backup", label: "Backup e Restauração", icon: HardDrive },
    ],
  };

  const isConfigActive = activeSection.startsWith("config-");
  const checkAllowed = (id: string) => !isSectionAllowed || isSectionAllowed(id);
  
  // Staff-based section filtering
  const isStaffAllowed = (id: string) => {
    if (!staffRole || staffRole === "admin") return true;
    if (id === "contas") return false;
    return staffAllowedSections?.includes(id) ?? true;
  };

  const noSubscription = hasActiveSubscription === false;
  const filteredGroups = menuGroups.map(group => {
    const filtered = noSubscription
      ? group.filter(item => item.id === "modulos")
      : group.filter(item => checkAllowed(item.id) && isStaffAllowed(item.id));
    return filtered;
  }).filter(group => group.length > 0);
  const filteredConfig = noSubscription ? [] : menuStructure.configSubItems.filter(item => checkAllowed(item.id) && isStaffAllowed(item.id));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar-background w-[240px]">
      <SidebarContent className="bg-sidebar-background">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2 pt-3">
              {filteredGroups.map((group, groupIndex) => (
                <Fragment key={groupIndex}>
                  {groupIndex > 0 && (
                    <div className="py-1.5 px-3">
                      <div className="h-px bg-sidebar-border" />
                    </div>
                  )}
                  {group.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => onSectionChange(item.id)}
                        isActive={activeSection === item.id}
                        tooltip={item.label}
                        className={`relative h-9 px-3 rounded-button text-[13px] transition-colors ${
                          activeSection === item.id 
                            ? "font-medium" 
                            : "text-sidebar-foreground hover:bg-muted"
                        }`}
                        style={activeSection === item.id ? { backgroundColor: primaryColor, color: '#ffffff' } : undefined}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.label}</span>}
                        {item.hasNotification && !collapsed && (
                          <span className="absolute right-2 h-1.5 w-1.5 bg-primary rounded-full"></span>
                        )}
                        {item.hasNotification && collapsed && (
                          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-primary rounded-full"></span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </Fragment>
              ))}
              
              {/* Configurações */}
              {filteredConfig.length > 0 && (
                <SidebarMenuItem>
                  <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                    <CollapsibleTrigger asChild>
                       <SidebarMenuButton
                        tooltip="Configurações"
                        className={`w-full h-9 px-3 rounded-button text-[13px] ${isConfigActive ? "font-medium" : "text-sidebar-foreground hover:bg-muted"}`}
                        style={isConfigActive ? { backgroundColor: primaryColor, color: '#ffffff' } : undefined}
                      >
                        <Settings className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">Configurações</span>
                            {configOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                        {filteredConfig.map((subItem) => (
                          <SidebarMenuButton
                            key={subItem.id}
                            onClick={() => onSectionChange(subItem.id)}
                            isActive={activeSection === subItem.id}
                           className={`w-full h-8 px-3 rounded-button text-[13px] ${
                              activeSection === subItem.id
                                ? "font-medium"
                                : "text-sidebar-foreground hover:bg-muted"
                            }`}
                            style={activeSection === subItem.id ? { backgroundColor: primaryColor, color: '#ffffff' } : undefined}
                          >
                            <subItem.icon className="h-3.5 w-3.5" />
                            <span>{subItem.label}</span>
                          </SidebarMenuButton>
                        ))}
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
