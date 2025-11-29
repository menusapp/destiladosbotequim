import {
  ShoppingBag,
  CreditCard,
  Users2,
  Utensils,
  Warehouse,
  BarChart3,
  Truck,
  TrendingUp,
  Users,
  Settings,
  CircleDollarSign,
  MessageCircle,
  Construction,
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

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  hasNewOrders?: boolean;
  hasNewBills?: boolean;
  hasNewDeliveryOrders?: boolean;
}

export function AppSidebar({ activeSection, onSectionChange, hasNewOrders, hasNewBills, hasNewDeliveryOrders }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

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
      { id: "mesas-comandas", label: "Mesas e Comandas", icon: Users2 },
      { id: "cardapio", label: "Cardápio", icon: Utensils },
      { id: "caixa", label: "Caixa", icon: CircleDollarSign },
      { id: "estoque", label: "Estoque", icon: Warehouse },
      { id: "relatorios", label: "Relatórios", icon: BarChart3 },
    ],
    development: [
      { id: "entregadores", label: "Entregadores", icon: Truck },
      { id: "marketing", label: "Marketing", icon: TrendingUp },
      { id: "clientes", label: "Clientes", icon: Users },
      { id: "configuracoes", label: "Configurações", icon: Settings },
      { id: "modulos", label: "Módulos", icon: Construction },
    ],
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar-background w-60">
      <SidebarContent className="bg-sidebar-background">
        {/* Itens Principais */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2 pt-4">
              {menuStructure.main.map((item) => (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Separador */}
        <div className="my-2 border-t border-sidebar-border" />

        {/* Em Desenvolvimento */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs text-muted-foreground px-4">
              Em Desenvolvimento
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuStructure.development.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                    className="opacity-60"
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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