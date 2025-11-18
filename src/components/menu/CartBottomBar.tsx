import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CartBottomBarProps {
  itemCount: number;
  total: number;
  primaryColor: string;
  onViewCart: () => void;
  label?: string; // "Ver sacola" ou "Ver comanda"
}

export const CartBottomBar = ({
  itemCount,
  total,
  primaryColor,
  onViewCart,
  label = "Ver sacola",
}: CartBottomBarProps) => {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
      <div className="px-3 py-2">
        <Button
          onClick={onViewCart}
          className="w-full h-11 text-sm font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
          style={{
            backgroundColor: primaryColor,
            color: "white",
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
            <div
                className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold"
              >
                {itemCount}
              </div>
              <span className="text-sm">{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">R$ {total.toFixed(2)}</span>
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
        </Button>
      </div>
    </div>
  );
};
