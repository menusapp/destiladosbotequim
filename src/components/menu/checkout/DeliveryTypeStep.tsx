import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, Store } from "lucide-react";

interface DeliveryTypeStepProps {
  selected: "delivery" | "pickup";
  onSelect: (type: "delivery" | "pickup") => void;
  onBack: () => void;
  onContinue: () => void;
  storeAddress?: string;
}

export const DeliveryTypeStep = ({
  selected,
  onSelect,
  onBack,
  onContinue,
  storeAddress
}: DeliveryTypeStepProps) => {
  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Como deseja receber?</h3>
      
      <div className="grid grid-cols-1 gap-3">
        <Card
          className={`p-4 cursor-pointer transition-all ${
            selected === "delivery" 
              ? "border-primary border-2 bg-primary/5" 
              : "border-muted hover:border-primary/50"
          }`}
          onClick={() => onSelect("delivery")}
        >
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6" />
            <div>
              <p className="font-semibold">Entrega</p>
              <p className="text-sm text-muted-foreground">
                Receba em seu endereço
              </p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            selected === "pickup" 
              ? "border-primary border-2 bg-primary/5" 
              : "border-muted hover:border-primary/50"
          }`}
          onClick={() => onSelect("pickup")}
        >
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6" />
            <div>
              <p className="font-semibold">Retirada</p>
              <p className="text-sm text-muted-foreground">
                Retire na loja
              </p>
              {storeAddress && (
                <p className="text-xs text-muted-foreground mt-1">
                  📍 {storeAddress}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button onClick={onContinue} className="flex-1">
          Continuar
        </Button>
      </div>
    </div>
  );
};
