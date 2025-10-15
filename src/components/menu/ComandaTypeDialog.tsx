import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Users } from "lucide-react";

interface ComandaTypeDialogProps {
  open: boolean;
  onSelect: (type: 'individual' | 'coletiva') => void;
  restaurantColor?: string;
}

const ComandaTypeDialog = ({
  open,
  onSelect,
  restaurantColor = "#FF6B35"
}: ComandaTypeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Tipo de Comanda</DialogTitle>
          <DialogDescription className="text-center">
            Escolha como deseja fazer seu pedido
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button
            className="w-full h-auto py-6 flex flex-col gap-3 text-white"
            style={{ backgroundColor: restaurantColor }}
            onClick={() => onSelect('individual')}
          >
            <User className="h-8 w-8" />
            <div className="text-center">
              <p className="font-bold text-lg">Comanda Individual</p>
              <p className="text-sm opacity-90 mt-1">
                Apenas você faz pedidos nesta comanda
              </p>
            </div>
          </Button>

          <Button
            className="w-full h-auto py-6 flex flex-col gap-3 text-white"
            style={{ backgroundColor: restaurantColor }}
            onClick={() => onSelect('coletiva')}
          >
            <Users className="h-8 w-8" />
            <div className="text-center">
              <p className="font-bold text-lg">Comanda Coletiva</p>
              <p className="text-sm opacity-90 mt-1">
                Várias pessoas podem fazer pedidos na mesma comanda
              </p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComandaTypeDialog;
