import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NewOrderNotificationProps {
  orderId: string;
  customerName: string;
  total: number;
  orderType: 'local' | 'delivery';
  tableNumber?: number;
  deliveryType?: 'delivery' | 'pickup';
  onView: () => void;
  onDismiss: () => void;
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
}: NewOrderNotificationProps) => {
  const typeLabel = orderType === 'local' ? 'Mesa' : 'Online';

  return (
    <div className="w-96 animate-in slide-in-from-top-5">
      <Card className="bg-orange-50 border-orange-200 shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-orange-900">Novo Pedido!</h3>
                <p className="text-sm text-orange-700">
                  {orderType === 'local' 
                    ? `🍽️ Pedido Mesa — Mesa ${tableNumber || '?'}` 
                    : deliveryType === 'pickup' 
                      ? '📦 Pedido Online — Retirada'
                      : '🚚 Pedido Online — Entrega'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-8 w-8 text-orange-700 hover:text-orange-900 hover:bg-orange-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-lg font-semibold text-orange-800">
              Pedido #{orderId.slice(0, 8)} — {typeLabel}
            </p>
            <p className="text-orange-700">{customerName}</p>
            <p className="text-2xl font-bold text-orange-900">
              R$ {total.toFixed(2)}
            </p>
          </div>

          <Button
            onClick={onView}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            VER PEDIDO
          </Button>
        </div>
      </Card>
    </div>
  );
};
