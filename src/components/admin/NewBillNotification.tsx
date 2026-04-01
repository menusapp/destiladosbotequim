import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Receipt, ChevronDown, ChevronUp, X } from "lucide-react";

interface NewBillNotificationProps {
  billId: string;
  tableNumber: number;
  total: number;
  customerName?: string;
  onView: () => void;
  onDismiss: () => void;
  onStopSound?: () => void;
}

export const NewBillNotification = ({
  billId,
  tableNumber,
  total,
  customerName,
  onView,
  onDismiss,
  onStopSound,
}: NewBillNotificationProps) => {
  const [expanded, setExpanded] = useState(false);

  const title = `Mesa ${tableNumber} — ${customerName || 'Cliente'}`;

  // Compact pill (collapsed)
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 shadow-lg cursor-pointer hover:shadow-xl transition-all w-80 dark:bg-amber-950 dark:border-amber-800"
      >
        <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
          <Receipt className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 truncate dark:text-amber-100">{title}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Conta solicitada</p>
        </div>
        <span className="text-sm font-bold text-amber-900 flex-shrink-0 dark:text-amber-100">R$ {total.toFixed(2)}</span>
        <ChevronDown className="w-4 h-4 text-amber-400 flex-shrink-0" />
      </div>
    );
  }

  // Expanded card
  return (
    <div className="w-80 rounded-xl bg-amber-50 border border-amber-200 shadow-2xl dark:bg-amber-950 dark:border-amber-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 truncate dark:text-amber-100">{title}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Conta solicitada</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(false)} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900">
            <ChevronUp className="w-4 h-4 text-amber-500" />
          </button>
          <button onClick={onDismiss} className="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900">
            <X className="w-4 h-4 text-amber-500" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-700 dark:text-amber-300">Total</span>
          <span className="text-xl font-bold text-amber-900 dark:text-amber-100">R$ {total.toFixed(2)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onView}
            size="sm"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          >
            Ver Conta
          </Button>
          {onStopSound && (
            <Button
              onClick={onStopSound}
              size="sm"
              variant="outline"
              className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
            >
              Parar Som
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
