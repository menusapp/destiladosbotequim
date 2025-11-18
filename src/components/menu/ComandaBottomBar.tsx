import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";

interface ComandaBottomBarProps {
  total: number;
  primaryColor: string;
  status?: string;
  isVisible?: boolean;
  hasSubmittedOrders: boolean;
  onViewComanda: () => void;
}

export const ComandaBottomBar = ({
  total,
  primaryColor,
  status,
  isVisible = true,
  hasSubmittedOrders,
  onViewComanda,
}: ComandaBottomBarProps) => {
  const [prevTotal, setPrevTotal] = useState(total);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (total !== prevTotal && total > 0) {
      setShouldAnimate(true);
      setPrevTotal(total);
      
      const timer = setTimeout(() => {
        setShouldAnimate(false);
      }, 600);
      
      return () => clearTimeout(timer);
    }
  }, [total, prevTotal]);

  const leftText = hasSubmittedOrders ? "Pague sua comanda" : "Envie seu pedido";
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.08)] transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Texto dinâmico à esquerda */}
        <span className="text-sm font-medium text-foreground">
          {leftText}
        </span>

        {/* Botão Ver comanda à direita */}
        <button
          onClick={onViewComanda}
          className="flex items-center gap-3 h-12 px-4 rounded-lg transition-all flex-shrink-0"
          style={{
            backgroundColor: primaryColor,
            color: "white",
          }}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            <span className="text-sm font-medium whitespace-nowrap">Ver comanda</span>
          </div>
          <div className="h-4 w-px bg-white/30" />
          <span 
            className={`text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              shouldAnimate ? 'scale-110 animate-pulse' : 'scale-100'
            }`}
          >
            R$ {total.toFixed(2)}
          </span>
        </button>
      </div>
    </div>
  );
};
