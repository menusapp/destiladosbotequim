import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ComandaBottomBarProps {
  total: number;
  primaryColor: string;
  status?: string;
  onViewComanda: () => void;
}

export const ComandaBottomBar = ({
  total,
  primaryColor,
  status,
  onViewComanda,
}: ComandaBottomBarProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
      <div className="px-4 py-3">
        <Button
          onClick={onViewComanda}
          className="w-full h-14 text-base font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
          style={{
            backgroundColor: primaryColor,
            color: "white",
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              <span>Ver comanda</span>
            </div>
            {total > 0 && (
              <span className="text-base font-bold">
                R$ {total.toFixed(2)}
              </span>
            )}
          </div>
        </Button>
      </div>
    </div>
  );
};
