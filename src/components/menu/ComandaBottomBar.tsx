import { Receipt } from "lucide-react";

interface ComandaBottomBarProps {
  total: number;
  primaryColor: string;
  status?: string;
  isVisible?: boolean;
  hasSubmittedOrders: boolean;
  cartItemCount: number;
  onViewComanda: () => void;
}

export const ComandaBottomBar = ({
  total,
  primaryColor,
  isVisible = true,
  cartItemCount,
  onViewComanda,
}: ComandaBottomBarProps) => {
  const showValue = cartItemCount > 0 && total > 0;

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-[60] bg-background border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-foreground mx-[5px]">
          Enviar Pedido
        </span>

        <button
          onClick={onViewComanda}
          className="flex items-center gap-3 h-12 px-4 rounded-lg flex-shrink-0"
          style={{
            backgroundColor: primaryColor,
            color: "white",
          }}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">Ver Comanda</span>
          </div>
          {showValue && (
            <>
              <div className="h-4 w-px bg-white/30" />
              <span className="text-sm font-semibold whitespace-nowrap">
                R$ {total.toFixed(2)}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
