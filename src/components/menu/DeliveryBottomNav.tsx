import { UtensilsCrossed, Package, User, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "menu" | "pedidos" | "reservas" | "perfil";

interface DeliveryBottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  primaryColor?: string;
  showReservations?: boolean;
}

export const DeliveryBottomNav = ({
  activeTab,
  onTabChange,
  primaryColor = "#000000",
  showReservations = false,
}: DeliveryBottomNavProps) => {
  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "menu", label: "Menu", icon: UtensilsCrossed },
    { id: "pedidos", label: "Pedidos", icon: Package },
    ...(showReservations ? [{ id: "reservas" as TabId, label: "Reservas", icon: CalendarCheck }] : []),
    { id: "perfil", label: "Perfil", icon: User },
  ];

  const cols = tabs.length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg">
      <div className={`grid h-14`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
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
