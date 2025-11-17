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
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
      <div className="px-4 py-3">
        <Button
          onClick={onViewCart}
          className="w-full h-14 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
          style={{
            backgroundColor: primaryColor,
            color: "white",
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold"
              >
                {itemCount}
              </div>
              <span>{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>R$ {total.toFixed(2)}</span>
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </Button>
      </div>
      <div className="text-center text-xs text-muted-foreground pb-2">
        Total sem a entrega
      </div>
    </div>
  );
};
