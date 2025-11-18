import { UtensilsCrossed, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliveryBottomNavProps {
  activeTab: "menu" | "pedidos" | "perfil";
  onTabChange: (tab: "menu" | "pedidos" | "perfil") => void;
  primaryColor?: string;
}

export const DeliveryBottomNav = ({
  activeTab,
  onTabChange,
  primaryColor = "#000000",
}: DeliveryBottomNavProps) => {
  const tabs = [
    { id: "menu" as const, label: "Menu", icon: UtensilsCrossed },
    { id: "pedidos" as const, label: "Pedidos", icon: Package },
    { id: "perfil" as const, label: "Perfil", icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg">
      <div className="grid grid-cols-3 h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
              style={isActive ? { color: primaryColor } : undefined}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
