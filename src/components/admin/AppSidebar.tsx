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
  MapPin,
  ChevronDown
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
          { id: "pedidos", label: "Pedidos", icon: ClipboardList },
          { id: "comandas", label: "Comandas", icon: Receipt },
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
            <SidebarMenu>
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

              {/* Seções com sub-itens */}
              {menuStructure.sections.map((section) => (
                <Collapsible key={section.id} defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={section.label} className="cursor-pointer">
                        <section.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span>{section.label}</span>
                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </>
                        )}
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
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
                      </CollapsibleContent>
                    )}
                  </SidebarMenuItem>
                </Collapsible>
              ))}

              {/* Configurações no final */}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}