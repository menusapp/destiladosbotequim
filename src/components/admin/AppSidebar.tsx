import { BarChart3, Wallet, Package, ShoppingCart, Settings, TrendingUp, Target, Warehouse, TableIcon, Truck } from "lucide-react";
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
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const sections = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "financas", label: "Finanças", icon: Wallet },
    { id: "operacoes", label: "Operações", icon: Package },
    { id: "atendimento", label: "Atendimento", icon: ShoppingCart },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "configuracoes", label: "Configurações", icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(section.id)}
                    isActive={activeSection === section.id}
                    tooltip={section.label}
                  >
                    <section.icon className="h-4 w-4" />
                    {!collapsed && <span>{section.label}</span>}
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