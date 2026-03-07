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
  Receipt,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
      { 
        id: "pedidos-online", 
        label: "Pedidos Online", 
        icon: ShoppingBag,
        hasNotification: hasNewDeliveryOrders
      },
      { 
        id: "pedidos-locais", 
        label: "Pedidos Locais", 
        icon: Utensils,
        hasNotification: (hasNewOrders || hasNewBills)
      },
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
      { id: "notas-fiscais", label: "Notas Fiscais", icon: Receipt },
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
  
  // When no active subscription, only show "modulos"
  const noSubscription = hasActiveSubscription === false;
  const filteredMain = noSubscription 
    ? menuStructure.main.filter(item => item.id === "modulos")
    : menuStructure.main.filter(item => checkAllowed(item.id));
  const filteredConfig = noSubscription ? [] : menuStructure.configSubItems.filter(item => checkAllowed(item.id));

  // Configurações agora fica no menu principal
  const renderConfigMenu = () => (
    <SidebarMenuItem>
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip="Configurações"
            className={`w-full ${isConfigActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
          >
            <Settings className="h-4 w-4" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Configurações</span>
                {configOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent className="pl-4 space-y-1 mt-1">
            {filteredConfig.map((subItem) => (
              <SidebarMenuButton
                key={subItem.id}
                onClick={() => onSectionChange(subItem.id)}
                isActive={activeSection === subItem.id}
                className="w-full text-sm"
              >
                <subItem.icon className="h-4 w-4" />
                <span>{subItem.label}</span>
              </SidebarMenuButton>
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar-background w-60">
      <SidebarContent className="bg-sidebar-background">
        {/* Itens Principais */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2 pt-4">
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                    className="relative"
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                    {item.hasNotification && !collapsed && (
                      <span className="absolute right-2 h-2 w-2 bg-primary rounded-full"></span>
                    )}
                    {item.hasNotification && collapsed && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"></span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Configurações - Menu Expansível */}
              {filteredConfig.length > 0 && renderConfigMenu()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Suporte - Fixo no Rodapé */}
        <SidebarGroup className="mt-auto border-t border-sidebar-border pt-2">
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                tooltip="Falar com Suporte"
                className="text-success hover:text-success hover:bg-success/10"
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
