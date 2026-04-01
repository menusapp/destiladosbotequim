import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UtensilsCrossed, ShoppingBag } from "lucide-react";

interface Props {
  primaryColor: string;
  consumptionType: "dine_in" | "takeaway";
  tableNumber: string;
  onChangeType: (t: "dine_in" | "takeaway") => void;
  onChangeTable: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function KioskConsumptionType({ primaryColor, consumptionType, tableNumber, onChangeType, onChangeTable, onBack, onNext }: Props) {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-6 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Como deseja consumir?</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 max-w-lg mx-auto w-full">
        <button
          onClick={() => onChangeType("dine_in")}
          className={`w-full p-8 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
            consumptionType === "dine_in" ? "border-2 shadow-lg" : "border-muted hover:border-muted-foreground/30"
          }`}
          style={consumptionType === "dine_in" ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
        >
          <UtensilsCrossed className="h-16 w-16" style={{ color: consumptionType === "dine_in" ? primaryColor : undefined }} />
          <span className="text-2xl font-bold text-foreground">Comer no local</span>
        </button>

        <button
          onClick={() => onChangeType("takeaway")}
          className={`w-full p-8 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
            consumptionType === "takeaway" ? "border-2 shadow-lg" : "border-muted hover:border-muted-foreground/30"
          }`}
          style={consumptionType === "takeaway" ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
        >
          <ShoppingBag className="h-16 w-16" style={{ color: consumptionType === "takeaway" ? primaryColor : undefined }} />
          <span className="text-2xl font-bold text-foreground">Para viagem</span>
        </button>

        {consumptionType === "dine_in" && (
          <div className="w-full space-y-2">
            <Label className="text-lg">Número da mesa (opcional)</Label>
            <Input
              value={tableNumber}
              onChange={(e) => onChangeTable(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 5"
              className="text-2xl h-16 text-center"
              inputMode="numeric"
              maxLength={3}
            />
          </div>
        )}
      </div>

      <div className="border-t bg-card p-6">
        <div className="max-w-lg mx-auto">
          <Button onClick={onNext} className="w-full h-16 text-xl font-bold rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
            Ir para Pagamento
          </Button>
        </div>
      </div>
    </div>
  );
}
