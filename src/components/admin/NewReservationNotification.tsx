import { Button } from "@/components/ui/button";
import { CalendarCheck, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NewReservationNotificationProps {
  reservationId: string;
  customerName: string;
  tableName: string;
  date: string;
  time: string;
  partySize: number;
  onView: () => void;
  onDismiss: () => void;
}

/**
 * Notificação compacta de nova reserva.
 *
 * Mostra apenas o essencial em até 3 linhas. Detalhes completos ficam
 * no drawer de reservas, acessível ao clicar em "Ver".
 *
 * O som é controlado globalmente pelo RestaurantAdmin
 * (mesmo MP3 usado para novos pedidos e novas contas).
 */
export const NewReservationNotification = ({
  customerName,
  tableName,
  date,
  time,
  partySize,
  onView,
  onDismiss,
}: NewReservationNotificationProps) => {
  // Hoje / Amanhã / data
  const formatDateLabel = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const target = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (target.getTime() === today.getTime()) return "Hoje";
    if (target.getTime() === tomorrow.getTime()) return "Amanhã";
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
  };

  const dateLabel = formatDateLabel(date);
  const timeLabel = time.slice(0, 5);
  const summary = `${customerName} • ${tableName} • ${dateLabel} ${timeLabel} • ${partySize} ${
    partySize === 1 ? "pessoa" : "pessoas"
  }`;

  return (
    <div className="fixed top-4 right-4 z-[100] w-80 animate-in slide-in-from-top-5">
      <Card className="bg-orange-50 border-orange-200 shadow-2xl dark:bg-orange-950 dark:border-orange-800">
        <div className="flex items-center justify-between px-3 py-2 border-b border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
              <CalendarCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
              🗓️ Nova Reserva
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-orange-100 dark:hover:bg-orange-900"
            aria-label="Dispensar"
          >
            <X className="w-3.5 h-3.5 text-orange-500" />
          </button>
        </div>

        <div className="px-3 py-2 space-y-2">
          <p className="text-sm text-orange-800 dark:text-orange-200 line-clamp-2">
            {summary}
          </p>

          <Button
            onClick={onView}
            size="sm"
            className="w-full h-8 bg-orange-600 hover:bg-orange-700 text-white"
          >
            Ver reserva
          </Button>
        </div>
      </Card>
    </div>
  );
};
