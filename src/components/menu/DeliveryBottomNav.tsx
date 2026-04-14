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
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t shadow-lg"
      style={{ backgroundColor: primaryColor, borderColor: "rgba(255,255,255,0.15)" }}
    >
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center gap-1 transition-colors"
              style={{
                color: isActive ? "#ffffff" : "rgba(255,255,255,0.6)",
              }}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={cn("text-xs", isActive ? "font-bold" : "font-normal")}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
