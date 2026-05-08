import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, ChevronDown, ChevronUp, X, XCircle, Pencil } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
}

interface NewOrderNotificationProps {
  orderId: string;
  customerName: string;
  total: number;
  orderType: 'local' | 'delivery' | 'balcao';
  tableNumber?: number;
  deliveryType?: 'delivery' | 'pickup';
  items?: OrderItem[];
  onView: () => void;
  onDismiss: () => void;
  onStopSound?: () => void;
  onReject?: (reason: string) => void;
  canManageOrders?: boolean;
}

export const NewOrderNotification = ({
  orderId,
  customerName,
  total,
  orderType,
  tableNumber,
  deliveryType,
  items,
  onView,
  onDismiss,
  onStopSound,
  onReject,
  canManageOrders = true,
}: NewOrderNotificationProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const getTypeLabel = () => {
    if (orderType === 'balcao') return 'Balcão';
    if (orderType === 'local') return `Mesa ${tableNumber || '?'}`;
    if (deliveryType === 'pickup') return 'Retirada';
    return 'Delivery';
  };

  const title = `${getTypeLabel()} — ${customerName}`;
  const canReject = canManageOrders && onReject && (orderType === 'local' || orderType === 'balcao');

  // Compact pill (collapsed)
  if (!expanded) {
    return (
      <div
        onClick={() => setExpanded(true)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 shadow-lg cursor-pointer hover:shadow-xl transition-all w-80"
      >
        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
          <Bell className="w-4 h-4 text-white" />
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

  // Reject confirmation
  if (showRejectConfirm) {
    return (
      <div className="w-80 rounded-xl bg-red-50 border border-red-200 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-red-200">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-semibold text-red-900">Recusar Pedido</p>
          </div>
          <button onClick={() => setShowRejectConfirm(false)} className="p-1 rounded hover:bg-red-100">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3">
          <p className="text-xs text-red-700">{title} — #{orderId.slice(0, 8)}</p>
          <Input
            placeholder="Motivo (opcional)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => {
                onReject?.(rejectReason || "Recusado pelo operador");
                setShowRejectConfirm(false);
              }}
            >
              Confirmar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setShowRejectConfirm(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded card
  return (
    <div className="w-80 rounded-xl bg-orange-50 border border-orange-200 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-white" />
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

      {/* Items preview */}
      {items && items.length > 0 && (
        <div className="px-4 pt-2 space-y-1">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-orange-800">
              <span className="truncate mr-2">{item.quantity}x {item.name}</span>
            </div>
          ))}
          {items.length > 3 && (
            <p className="text-xs text-orange-500">+{items.length - 3} itens</p>
          )}
        </div>
      )}

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
            Ver pedido
          </Button>
          {canReject && (
            <Button
              onClick={() => setShowRejectConfirm(true)}
              size="sm"
              variant="destructive"
              className="gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          )}
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
