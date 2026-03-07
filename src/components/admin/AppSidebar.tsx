import { useState } from "react";
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
  isSectionAllowed?: (sectionId: string) => boolean;
  hasActiveSubscription?: boolean | null;
}

export function AppSidebar({ activeSection, onSectionChange, hasNewOrders, hasNewBills, hasNewDeliveryOrders, isSectionAllowed, hasActiveSubscription }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [configOpen, setConfigOpen] = useState(activeSection.startsWith("config-"));

  const menuStructure = {
    main: [
      { id: "pedidos-online", label: "Pedidos Online", icon: ShoppingBag, hasNotification: hasNewDeliveryOrders },
      { id: "pedidos-locais", label: "Pedidos Locais", icon: Utensils, hasNotification: (hasNewOrders || hasNewBills) },
      { id: "pdv", label: "PDV", icon: CreditCard },
      { id: "mesas-reservas", label: "Mesas e Reservas", icon: Users2 },
      { id: "cardapio", label: "Cardápio", icon: Utensils },
      { id: "caixa", label: "Caixa", icon: CircleDollarSign },
      { id: "estoque", label: "Estoque", icon: Warehouse },
      { id: "custos", label: "Custos", icon: CircleDollarSign },
      { id: "margens", label: "Margens", icon: TrendingUp },
      { id: "relatorios", label: "Relatórios", icon: BarChart3 },
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "fidelidade", label: "Fidelidade", icon: Gift },
      { id: "marketing", label: "Marketing", icon: Megaphone },
      { id: "fiscal", label: "Fiscal", icon: FileText },
      { id: "modulos", label: "Módulos", icon: Construction },
    ],
    configSubItems: [
      { id: "config-dados", label: "Dados da Empresa", icon: Building2 },
      { id: "config-horario", label: "Horário de Funcionamento", icon: Clock },
      { id: "config-regioes", label: "Regiões de Entrega", icon: MapPin },
      { id: "config-pagamentos", label: "Formas de Pagamento", icon: CreditCard },
      { id: "config-pagamentos-online", label: "Pagamentos Online", icon: Smartphone },
      { id: "config-impressoras", label: "Impressoras", icon: Printer },
      { id: "config-whatsapp", label: "Automação WhatsApp", icon: MessageSquare },
    ],
  };

  const isConfigActive = activeSection.startsWith("config-");
  const checkAllowed = (id: string) => !isSectionAllowed || isSectionAllowed(id);
  
  const noSubscription = hasActiveSubscription === false;
  const filteredMain = noSubscription 
    ? menuStructure.main.filter(item => item.id === "modulos")
    : menuStructure.main.filter(item => checkAllowed(item.id));
  const filteredConfig = noSubscription ? [] : menuStructure.configSubItems.filter(item => checkAllowed(item.id));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar-background w-[240px]">
      <SidebarContent className="bg-sidebar-background">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2 pt-3">
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                    className={`relative h-9 px-3 rounded-button text-[13px] transition-colors ${
                      activeSection === item.id 
                        ? "bg-accent text-accent-foreground font-medium" 
                        : "text-sidebar-foreground hover:bg-muted"
                    }`}
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
              
              {/* Configurações */}
              {filteredConfig.length > 0 && (
                <SidebarMenuItem>
                  <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Configurações"
                        className={`w-full h-9 px-3 rounded-button text-[13px] ${isConfigActive ? "bg-accent text-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-muted"}`}
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
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-muted"
                            }`}
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

        {/* Suporte */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border pt-2">
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                tooltip="Falar com Suporte"
                className="text-green-600 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 h-9 px-3 rounded-button text-[13px]"
              >
                <MessageCircle className="h-4 w-4" />
                {!collapsed && <span>Falar com Suporte</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
