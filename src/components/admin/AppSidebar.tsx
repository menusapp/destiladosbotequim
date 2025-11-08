import { 
  BarChart3, 
  Wallet, 
  Package, 
  ShoppingCart, 
  Settings, 
  DollarSign, 
  TrendingDown, 
  Target, 
  FileText, 
  Warehouse, 
  ShoppingBag, 
  Beef, 
  TableIcon, 
  ClipboardList, 
  Receipt, 
  Truck, 
  MapPin
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  hasNewOrders?: boolean;
  hasNewBills?: boolean;
}

export function AppSidebar({ activeSection, onSectionChange, hasNewOrders, hasNewBills }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const menuStructure = {
    direct: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    ],
    sections: [
      {
        id: "financas",
        label: "Finanças",
        icon: Wallet,
        items: [
          { id: "caixa", label: "Caixa", icon: DollarSign },
          { id: "custos", label: "Custos", icon: TrendingDown },
          { id: "margens", label: "Margens", icon: Target },
          { id: "dre", label: "DRE", icon: FileText },
        ],
      },
      {
        id: "operacoes",
        label: "Operações",
        icon: Package,
        items: [
          { id: "estoque", label: "Estoque", icon: Warehouse },
          { id: "produtos", label: "Produtos", icon: ShoppingBag },
          { id: "ingredientes", label: "Ingredientes", icon: Beef },
        ],
      },
      {
        id: "atendimento",
        label: "Atendimento",
        icon: ShoppingCart,
        items: [
          { id: "mesas", label: "Mesas", icon: TableIcon },
          { id: "pedidos", label: "Pedidos", icon: ClipboardList, hasNotification: hasNewOrders },
          { id: "comandas", label: "Comandas", icon: Receipt, hasNotification: hasNewBills },
          { id: "balcao", label: "Balcão", icon: ShoppingBag },
        ],
      },
      {
        id: "delivery",
        label: "Delivery",
        icon: Truck,
        items: [
          { id: "areas-entrega", label: "Áreas de Entrega", icon: MapPin },
          { id: "delivery-config", label: "Configurações", icon: Settings },
        ],
      },
    ],
    bottom: [
      { id: "configuracoes", label: "Configurações", icon: Settings },
    ],
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {/* Dashboard direto */}
              {menuStructure.direct.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.id)}
                    isActive={activeSection === item.id}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Seções com sub-itens - sempre abertas */}
              {menuStructure.sections.map((section) => (
                <div key={section.id} className="space-y-1">
                  {!collapsed && (
                    <div className="px-2 py-2 mt-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <section.icon className="h-3.5 w-3.5" />
                        <span>{section.label}</span>
                      </div>
                    </div>
                  )}
                  {collapsed && (
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip={section.label} disabled>
                        <section.icon className="h-4 w-4" />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {!collapsed && (
                    <SidebarMenuSub>
                      {section.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.id}>
                          <SidebarMenuSubButton
                            onClick={() => onSectionChange(subItem.id)}
                            isActive={activeSection === subItem.id}
                            className="relative"
                          >
                            <subItem.icon className="h-4 w-4" />
                            <span>{subItem.label}</span>
                            {subItem.id === 'pedidos' && hasNewOrders && (
                              <span className="absolute right-2 h-2 w-2 bg-orange-500 rounded-full"></span>
                            )}
                            {subItem.id === 'comandas' && hasNewBills && (
                              <span className="absolute right-2 h-2 w-2 bg-orange-500 rounded-full"></span>
                            )}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </div>
              ))}

              {/* Configurações no final */}
              <div className="pt-4">
                {menuStructure.bottom.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onSectionChange(item.id)}
                      isActive={activeSection === item.id}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </div>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}