import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, X } from "lucide-react";

interface NewOrderNotificationProps {
  orderId: string;
  customerName: string;
  total: number;
  orderType: 'local' | 'delivery';
  tableNumber?: number;
  deliveryType?: 'delivery' | 'pickup';
  onView: () => void;
  onDismiss: () => void;
  onStopSound?: () => void;
}

export const NewOrderNotification = ({
  orderId,
  customerName,
  total,
  orderType,
  tableNumber,
  deliveryType,
  onView,
  onDismiss,
  onStopSound,
}: NewOrderNotificationProps) => {
  const [expanded, setExpanded] = useState(false);

  const getTypeLabel = () => {
    if (orderType === 'local') return `🍽️ Mesa ${tableNumber || '?'}`;
    if (deliveryType === 'pickup') return '📦 Retirada';
    return '🚚 Delivery';
  };

  const title = `${getTypeLabel()} — ${customerName}`;

  // Compact pill (collapsed)
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 shadow-lg cursor-pointer hover:shadow-xl transition-all w-80 animate-in slide-in-from-right-5"
      >
        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
          <span className="text-white text-sm">🔔</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-900 truncate">{title}</p>
          <p className="text-xs text-orange-600">#{orderId.slice(0, 8)}</p>
        </div>
        <span className="text-sm font-bold text-orange-900 flex-shrink-0">R$ {total.toFixed(2)}</span>
        <ChevronDown className="w-4 h-4 text-orange-400 flex-shrink-0" />
      </div>
    );
  }

  // Expanded card
  return (
    <div className="w-80 rounded-xl bg-orange-50 border border-orange-200 shadow-2xl animate-in slide-in-from-right-5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm">🔔</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-900 truncate">{title}</p>
            <p className="text-xs text-orange-600">#{orderId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(false)} className="p-1 rounded hover:bg-orange-100">
            <ChevronUp className="w-4 h-4 text-orange-500" />
          </button>
          <button onClick={onDismiss} className="p-1 rounded hover:bg-orange-100">
            <X className="w-4 h-4 text-orange-500" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-orange-700">Total</span>
          <span className="text-xl font-bold text-orange-900">R$ {total.toFixed(2)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onView}
            size="sm"
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            Aceitar
          </Button>
          {onStopSound && (
            <Button
              onClick={onStopSound}
              size="sm"
              variant="outline"
              className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              Parar Som
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
